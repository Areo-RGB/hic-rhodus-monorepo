import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  isNearbyAvailable,
  startNearbyController,
  sendNearbyPayload,
  stopNearbyConnection,
  requestNearbyPermissions,
  NearbyStatus
} from '../lib/nearby';
import {
  Play,
  Square,
  LayoutGrid,
  List,
  Shuffle,
  RotateCcw,
  Radio,
  RefreshCw,
  ShieldCheck,
  Zap,
  Sliders,
  Clock,
  Sparkles,
  Volume2,
  VolumeX
} from 'lucide-react';

const DEFAULT_COLORS = ['#facc15', '#ef4444', '#3b82f6', '#22c55e'];

function clampInteger(value: string | number, min: number, max: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export default function RhodusController() {
  const [activeTab, setActiveTab] = useState<'pad' | 'auto' | 'system'>('pad');
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);

  // Sequence configuration (spec: paul-react RhodusApp custom settings)
  const [intervalMs, setIntervalMs] = useState(1000);
  const [targetFlashes, setTargetFlashes] = useState(15);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [manualHoldDuration, setManualHoldDuration] = useState(500);

  // Runtime
  const [isActive, setIsActive] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [currentCountdown, setCurrentCountdown] = useState(3);
  const [changeCount, setChangeCount] = useState(0);
  const [activeCellIndex, setActiveCellIndex] = useState(-1);
  const [lastActionTime, setLastActionTime] = useState<string>('Ready');

  // Connection & telemetry
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>('idle');
  const [nearbyDetails, setNearbyDetails] = useState('');
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [logs, setLogs] = useState<{ id: string; time: string; tag: 'P2P' | 'SEQ' | 'MAN'; msg: string }[]>([]);

  const flashTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);
  const manualResetTimer = useRef<number | null>(null);
  const changeCountRef = useRef(changeCount);
  const isActiveRef = useRef(isActive);
  const colorsRef = useRef(colors);

  useEffect(() => { changeCountRef.current = changeCount; }, [changeCount]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { colorsRef.current = colors; }, [colors]);

  const addLog = (tag: 'P2P' | 'SEQ' | 'MAN', msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ id: Math.random().toString(36).substring(2, 9), time, tag, msg }, ...prev].slice(0, 60));
  };

  const playHapticTone = (freq = 440, type: OscillatorType = 'sine', duration = 0.08) => {
    if (!soundFeedback) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch { /* AudioContext restricted */ }
  };

  const broadcastState = useCallback((cellIndex: number, count: number, currentColors = colorsRef.current) => {
    setLastActionTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    sendNearbyPayload({ activeCellIndex: cellIndex, changeCount: count, colors: currentColors });
  }, []);

  const initNearby = useCallback(() => {
    startNearbyController();
    addLog('P2P', 'Nearby discovery started for Displays');
  }, []);

  useEffect(() => {
    initNearby();
    window.onNearbyStatusChanged = (status: string, details: string) => {
      setNearbyStatus(status as NearbyStatus);
      setNearbyDetails(details);
      addLog('P2P', `Status: ${status} ${details ? `(${details})` : ''}`);
    };
    return () => { stopNearbyConnection(); window.onNearbyStatusChanged = undefined; };
  }, [initNearby]);

  const stopSequence = useCallback(() => {
    if (flashTimer.current !== null) { window.clearTimeout(flashTimer.current); flashTimer.current = null; }
    if (countdownTimer.current !== null) { window.clearTimeout(countdownTimer.current); countdownTimer.current = null; }
    if (manualResetTimer.current !== null) { window.clearTimeout(manualResetTimer.current); manualResetTimer.current = null; }
    setIsActive(false); isActiveRef.current = false; setIsCountingDown(false);
    setActiveCellIndex(-1);
    broadcastState(-1, changeCountRef.current);
    // Clear countdown on Display as well (spec: same visual on both)
    sendNearbyPayload({ activeCellIndex: -1, changeCount: changeCountRef.current, colors: colorsRef.current, countdown: null });
    addLog('SEQ', 'Sequence stopped / reset');
    playHapticTone(300, 'square', 0.12);
  }, [broadcastState]);

  const reshuffleColors = () => {
    const shuffled = [...colorsRef.current].sort(() => Math.random() - 0.5);
    setColors(shuffled);
    broadcastState(activeCellIndex, changeCount, shuffled);
    addLog('MAN', 'Colors reshuffled');
    playHapticTone(580, 'triangle', 0.1);
  };

  const resetDefaultColors = () => {
    setColors(DEFAULT_COLORS);
    broadcastState(activeCellIndex, changeCount, DEFAULT_COLORS);
    addLog('MAN', 'Reset to standard HUD palette');
    playHapticTone(520, 'triangle', 0.1);
  };

  const nextColor = (currentLastColorIndex: number) => {
    const arr = colorsRef.current;
    const offset = 1 + Math.floor(Math.random() * (arr.length - 1));
    const nextIdx = currentLastColorIndex < 0 ? Math.floor(Math.random() * arr.length) : (currentLastColorIndex + offset) % arr.length;
    setActiveCellIndex(nextIdx);
    setChangeCount(prev => {
      const nextCount = prev + 1;
      broadcastState(nextIdx, nextCount);
      addLog('SEQ', `Flash #${nextCount} → Q${nextIdx + 1} (${arr[nextIdx]})`);
      return nextCount;
    });
    playHapticTone(600 + nextIdx * 120, 'sine', 0.06);
    return nextIdx;
  };

  const scheduleNextFlash = (currentLastColorIndex: number) => {
    if (!isActiveRef.current) return;
    flashTimer.current = window.setTimeout(() => {
      flashTimer.current = null;
      if (!isActiveRef.current) return;
      if (targetFlashes > 0 && changeCountRef.current >= targetFlashes) {
        stopSequence();
        addLog('SEQ', `Sequence completed: reached target of ${targetFlashes} flashes`);
        playHapticTone(880, 'sine', 0.2);
        return;
      }
      const nextIdx = nextColor(currentLastColorIndex);
      if (isActiveRef.current) scheduleNextFlash(nextIdx);
    }, intervalMs);
  };

  const startSequence = () => {
    if (shuffleEnabled) {
      const shuffled = [...colorsRef.current].sort(() => Math.random() - 0.5);
      setColors(shuffled);
      broadcastState(activeCellIndex, changeCount, shuffled);
      addLog('MAN', 'Shuffle vor Start — Farben neu gemischt');
    }
    if (countdownSeconds > 0) {
      setIsCountingDown(true);
      setCurrentCountdown(countdownSeconds);
      addLog('SEQ', `Pre-run countdown initiated (${countdownSeconds}s)`);
      // Broadcast initial countdown to Display (spec: same giant number on both devices)
      sendNearbyPayload({ activeCellIndex: -1, changeCount: changeCountRef.current, colors: colorsRef.current, countdown: countdownSeconds });
      let current = countdownSeconds;
      playHapticTone(440, 'sine', 0.08);
      const runCountDown = () => {
        countdownTimer.current = window.setTimeout(() => {
          current -= 1;
          if (current > 0) {
            setCurrentCountdown(current);
            sendNearbyPayload({ activeCellIndex: -1, changeCount: changeCountRef.current, colors: colorsRef.current, countdown: current });
            playHapticTone(440, 'sine', 0.08);
            runCountDown();
          } else {
            setIsCountingDown(false);
            sendNearbyPayload({ activeCellIndex: -1, changeCount: changeCountRef.current, colors: colorsRef.current, countdown: null });
            playHapticTone(880, 'sine', 0.15);
            beginActualSequence();
          }
        }, 1000);
      };
      runCountDown();
    } else {
      // No countdown — ensure Display clears any stale countdown
      sendNearbyPayload({ activeCellIndex: -1, changeCount: changeCountRef.current, colors: colorsRef.current, countdown: null });
      beginActualSequence();
    }
  };

  const beginActualSequence = () => {
    setIsActive(true); isActiveRef.current = true;
    setChangeCount(0); changeCountRef.current = 0;
    addLog('SEQ', `Auto-sequence started: ${intervalMs}ms, target: ${targetFlashes > 0 ? targetFlashes : '∞'}`);
    flashTimer.current = window.setTimeout(() => {
      if (!isActiveRef.current) return;
      const nextIdx = nextColor(-1);
      scheduleNextFlash(nextIdx);
    }, intervalMs);
  };

  const handleManualTrigger = (index: number) => {
    if (isActive) stopSequence();
    if (manualResetTimer.current) clearTimeout(manualResetTimer.current);
    setActiveCellIndex(index);
    const newCount = changeCount + 1;
    setChangeCount(newCount);
    broadcastState(index, newCount);
    addLog('MAN', `Manual trigger: Q${index + 1} (${colors[index]})`);
    playHapticTone(700 + index * 100, 'triangle', 0.08);
    manualResetTimer.current = window.setTimeout(() => {
      setActiveCellIndex(-1);
      broadcastState(-1, newCount);
    }, manualHoldDuration);
  };

  const runTestPattern = () => {
    if (isActive) stopSequence();
    addLog('MAN', 'Running test pattern sweep (1→2→3→4)');
    [0, 1, 2, 3].forEach((idx) => {
      setTimeout(() => { setActiveCellIndex(idx); broadcastState(idx, idx + 1); playHapticTone(500 + idx * 100, 'sine', 0.05); }, idx * 300);
    });
    setTimeout(() => { setActiveCellIndex(-1); broadcastState(-1, 4); }, 1300);
  };

  const p2pBadgeClass = nearbyStatus === 'connected'
    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
    : nearbyStatus === 'discovering'
      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70';

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050507] text-white font-mono select-none overflow-hidden relative">
      {/* Spec: paυl-react countdown — full-screen giant number, transparent overlay */}
      {isCountingDown && (
        <div className="countdown" aria-live="assertive">
          <span key={currentCountdown}>{currentCountdown}</span>
        </div>
      )}
      {/* Header */}
      <header className="flex-none bg-[#0d0d12] border-b border-[#1f1f28] px-3.5 py-2.5 sm:px-5 sm:py-3 z-30">
        <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-md shadow-purple-900/40 ring-1 ring-white/20">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white">HIC RHODUS</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-wider">CONTROLLER</span>
              </div>
              <p className="text-[10px] text-white/40 leading-none mt-0.5 hidden sm:block">HUD Reflex &amp; Flash Commander · {intervalMs}ms · {targetFlashes}×</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px]">
            <button onClick={() => setActiveTab('system')} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${p2pBadgeClass}`} title="P2P Status — zu Diagnose">
              <Radio size={12} className={nearbyStatus === 'connected' ? 'text-emerald-400' : nearbyStatus === 'discovering' ? 'text-amber-400' : ''} />
              <span className="font-bold tracking-wider uppercase text-[10px]">{nearbyStatus === 'connected' ? 'P2P' : nearbyStatus === 'discovering' ? 'P2P SEARCH' : 'P2P'}</span>
            </button>
            <button onClick={() => setSoundFeedback(!soundFeedback)} className="p-1.5 text-white/40 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors" title={soundFeedback ? 'Sound: On' : 'Sound: Off'}>
              {soundFeedback ? <Volume2 size={14} className="text-purple-400" /> : <VolumeX size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-5 relative">
        <div className="max-w-4xl mx-auto h-full flex flex-col gap-4 sm:gap-5">

          {/* PAD — manual-only, no duplicate sequence config */}
          {activeTab === 'pad' && (
            <div className="flex-1 flex flex-col justify-between gap-4 max-w-xl mx-auto w-full">
              {/* Compact status — single row, balanced padding */}
              <div className="flex items-center justify-between bg-[#101017] border border-[#22222f] rounded-2xl px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2"><span className="text-white/40 uppercase tracking-wider text-[10px]">Flashes:</span><span className="font-bold text-white text-sm">{changeCount}</span></div>
                <div className="flex items-center gap-2"><span className="text-white/40 uppercase tracking-wider text-[10px]">Aktiv:</span><span className={`font-bold px-2.5 py-1 rounded-full text-[11px] leading-none ${activeCellIndex >= 0 ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/40'}`}>{activeCellIndex >= 0 ? `Q${activeCellIndex + 1}` : '—'}</span></div>
                <div className="flex items-center gap-2"><span className="text-white/40 uppercase tracking-wider text-[10px]">P2P:</span><span className={`text-[11px] font-bold tracking-wide ${nearbyStatus === 'connected' ? 'text-emerald-400' : nearbyStatus === 'discovering' ? 'text-amber-400' : 'text-white/30'}`}>{nearbyStatus}</span></div>
              </div>

              <div className="flex-1 flex items-center justify-center my-auto min-h-[260px] max-h-[400px]">
                <div className="grid grid-cols-2 grid-rows-2 gap-2.5 w-full aspect-square max-w-[360px] p-3 bg-[#0a0a0e] border border-[#1c1c27] rounded-[28px] shadow-xl">
                  {colors.map((color, idx) => {
                    const isSelected = activeCellIndex === idx;
                    return (
                      <button key={idx} onPointerDown={() => handleManualTrigger(idx)} className={`rounded-2xl transition-all duration-100 relative flex flex-col items-center justify-between p-3 select-none active:scale-95 shadow-lg group overflow-hidden ${isSelected ? 'ring-4 ring-white shadow-2xl scale-[1.02]' : 'hover:opacity-90'}`} style={{ backgroundColor: color, filter: isSelected ? 'brightness(1.15)' : 'brightness(0.85)' }}>
                        <div className="w-full flex items-center justify-between">
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-white border border-white/20">Q{idx + 1}</span>
                          <span className="text-[10px] font-bold text-black/70 group-hover:text-black transition-colors uppercase">{idx === 0 ? 'TL' : idx === 1 ? 'TR' : idx === 2 ? 'BL' : 'BR'}</span>
                        </div>
                        <div className="my-auto flex flex-col items-center">
                          {isSelected ? <span className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-white font-black text-xs tracking-widest animate-pulse border border-white/40">FLASHING</span> : <span className="text-black/50 font-black text-2xl group-hover:text-black/80 transition-colors">{idx + 1}</span>}
                        </div>
                        <div className="w-full text-center"><span className="text-[9px] font-bold text-black/60 bg-white/30 backdrop-blur-sm px-1.5 py-0.5 rounded uppercase tracking-wider">TAP TO FLASH</span></div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10px] text-white/40 text-center tracking-wider uppercase leading-relaxed">Tippen löst sofort aus · Farben &amp; Timing in Automatik</p>
            </div>
          )}

          {/* AUTOMATIK — spec: paul-react/RhodusApp custom settings (stepper + toggle) */}
          {activeTab === 'auto' && (
            <div className="max-w-xl mx-auto w-full space-y-4">
              <div className="bg-[#0f0f16] border border-[#222230] rounded-2xl p-5 flex flex-col gap-0">
                <div className="flex items-center justify-between gap-3 pb-3">
                  <div className="flex items-center gap-2"><Sliders size={18} className="text-purple-400" /><h2 className="text-xs font-bold tracking-widest uppercase text-white">Auto-Sequenz</h2></div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase leading-none border ${isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse' : isCountingDown ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/10 text-white/40 border-white/10'}`}>{isActive ? 'RUNNING' : isCountingDown ? `COUNTDOWN (${currentCountdown})` : 'STANDBY'}</span>
                </div>
                {isActive && targetFlashes > 0 && (
                  <div className="space-y-2 pb-4">
                    <div className="flex justify-between text-[11px] text-white/60"><span>Fortschritt</span><span className="font-bold text-purple-400 tabular-nums">{changeCount} / {targetFlashes} ({Math.round((changeCount / targetFlashes) * 100)}%)</span></div>
                    <div className="w-full bg-[#181822] h-2.5 rounded-full overflow-hidden border border-white/5"><div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-200" style={{ width: `${Math.min(100, (changeCount / targetFlashes) * 100)}%` }} /></div>
                  </div>
                )}

                <section className="setting">
                  <div className="setting-head">
                    <label htmlFor="intervalInput">Intervall</label>
                    <output id="intervalOutput" className="value" htmlFor="intervalInput">{intervalMs}ms</output>
                  </div>
                  <div className="stepper">
                    <button id="intervalMinus" className="icon-button" type="button" title="100ms verringern" aria-label="Intervall um 100 Millisekunden verringern" onClick={() => setIntervalMs(prev => Math.max(50, prev - 100))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
                    </button>
                    <input id="intervalInput" className="number-input" type="number" inputMode="numeric" min={50} max={5000} step={50} value={intervalMs} onChange={e => setIntervalMs(parseInt(e.target.value) || 0)} onBlur={() => setIntervalMs(clampInteger(intervalMs, 50, 5000))} aria-label="Intervall in Millisekunden" />
                    <button id="intervalPlus" className="icon-button" type="button" title="100ms erhöhen" aria-label="Intervall um 100 Millisekunden erhöhen" onClick={() => setIntervalMs(prev => Math.min(5000, prev + 100))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>
                </section>

                <section className="setting">
                  <div className="setting-head">
                    <label htmlFor="targetInput">Farbwechsel Anzahl</label>
                    <output id="targetOutput" className="value" htmlFor="targetInput">{targetFlashes}</output>
                  </div>
                  <div className="stepper">
                    <button id="targetMinus" className="icon-button" type="button" title="1 verringern" aria-label="Anzahl um eins verringern" onClick={() => setTargetFlashes(prev => Math.max(1, prev - 1))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
                    </button>
                    <input id="targetInput" className="number-input" type="number" inputMode="numeric" min={1} max={1000} step={1} value={targetFlashes} onChange={e => setTargetFlashes(parseInt(e.target.value) || 0)} onBlur={() => setTargetFlashes(clampInteger(targetFlashes, 1, 1000))} aria-label="Anzahl der Farbwechsel" />
                    <button id="targetPlus" className="icon-button" type="button" title="1 erhöhen" aria-label="Anzahl um eins erhöhen" onClick={() => setTargetFlashes(prev => Math.min(1000, prev + 1))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>
                </section>

                <section className="setting">
                  <div className="setting-head">
                    <label id="shuffleLabel" htmlFor="shuffleToggle">Shuffle</label>
                    <output id="shuffleOutput" className="value">{shuffleEnabled ? 'An' : 'Aus'}</output>
                  </div>
                  <button id="shuffleToggle" className="toggle-button" type="button" role="switch" aria-checked={shuffleEnabled} aria-labelledby="shuffleLabel shuffleOutput" onClick={() => setShuffleEnabled(v => !v)}>
                    <span id="shuffleToggleText" className="toggle-copy">Positionen vor dem Start mischen</span>
                    <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb"></span></span>
                  </button>
                </section>

                <section className="setting">
                  <div className="setting-head">
                    <label htmlFor="countdownInput">Countdown</label>
                    <output id="countdownOutput" className="value" htmlFor="countdownInput">{countdownSeconds}s</output>
                  </div>
                  <div className="stepper">
                    <button id="countdownMinus" className="icon-button" type="button" title="1 Sekunde verringern" aria-label="Countdown um eine Sekunde verringern" onClick={() => setCountdownSeconds(prev => Math.max(0, prev - 1))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
                    </button>
                    <input id="countdownInput" className="number-input" type="number" inputMode="numeric" min={0} max={60} step={1} value={countdownSeconds} onChange={e => setCountdownSeconds(parseInt(e.target.value) || 0)} onBlur={() => setCountdownSeconds(clampInteger(countdownSeconds, 0, 60))} aria-label="Countdown-Dauer in Sekunden" />
                    <button id="countdownPlus" className="icon-button" type="button" title="1 Sekunde erhöhen" aria-label="Countdown um eine Sekunde erhöhen" onClick={() => setCountdownSeconds(prev => Math.min(60, prev + 1))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>
                </section>

                <section className="setting">
                  <div className="setting-head">
                    <label htmlFor="holdInput">Haltedauer</label>
                    <output id="holdOutput" className="value" htmlFor="holdInput">{manualHoldDuration}ms</output>
                  </div>
                  <div className="stepper">
                    <button className="icon-button" type="button" title="50ms verringern" aria-label="Haltedauer verringern" onClick={() => setManualHoldDuration(prev => Math.max(150, prev - 50))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
                    </button>
                    <input id="holdInput" className="number-input" type="number" inputMode="numeric" min={150} max={2000} step={50} value={manualHoldDuration} onChange={e => setManualHoldDuration(parseInt(e.target.value) || 0)} onBlur={() => setManualHoldDuration(clampInteger(manualHoldDuration, 150, 2000))} aria-label="Haltedauer in Millisekunden" />
                    <button className="icon-button" type="button" title="50ms erhöhen" aria-label="Haltedauer erhöhen" onClick={() => setManualHoldDuration(prev => Math.min(2000, prev + 50))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>
                </section>
              </div>
              <div className="flex gap-3">
                <button onClick={reshuffleColors} className="flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-wider bg-[#101018] border border-[#222230] text-white/70 hover:text-white flex items-center justify-center gap-2 transition-colors"><Shuffle size={14} /> Mischen</button>
                <button onClick={resetDefaultColors} className="flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-wider bg-[#101018] border border-[#222230] text-white/70 hover:text-white flex items-center justify-center gap-2 transition-colors"><RotateCcw size={14} /> Standard</button>
              </div>
            </div>
          )}

          {/* SYSTEM — merged P2P + Log, no redundant Sync tab */}
          {activeTab === 'system' && (
            <div className="max-w-xl mx-auto w-full space-y-4 sm:space-y-5">
              <div className="bg-[#0f0f16] border border-[#222230] rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Radio size={16} className="text-emerald-400" /><h3 className="text-xs font-bold tracking-widest uppercase">Nearby P2P (Offline)</h3></div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${nearbyStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : nearbyStatus === 'discovering' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 text-white/40'}`}>{nearbyStatus}</span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">Direkt über Bluetooth &amp; Wi-Fi Direct — ohne Internet oder Router. Stelle sicher, dass Bluetooth &amp; Standort-nahe Geräte erlaubt sind.</p>
                {nearbyDetails && <div className="bg-[#151520] border border-[#272738] rounded-xl p-2.5 text-xs text-white/70">Status: {nearbyDetails}</div>}
                <div className="flex gap-2 pt-1">
                  <button onClick={initNearby} className="flex-1 py-2.5 bg-[#1b1b26] hover:bg-[#252535] text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors"><RefreshCw size={14} /> Neu suchen</button>
                  <button onClick={requestNearbyPermissions} className="px-4 py-2.5 bg-[#1b1b26] hover:bg-[#252535] text-white/80 text-xs font-bold uppercase rounded-xl border border-white/10 flex items-center justify-center gap-1.5 transition-colors" title="Berechtigungen anfordern"><ShieldCheck size={14} /> Rechte</button>
                </div>
                <button onClick={runTestPattern} className="w-full py-2.5 bg-[#151520] hover:bg-[#1e1e2a] text-white/90 text-xs font-bold uppercase tracking-wider rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors"><Sparkles size={14} /> Test Sweep (1→2→3→4)</button>
              </div>

              <div className="bg-[#0f0f16] border border-[#222230] rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">Protokoll</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30">Letzte Aktion: {lastActionTime}</span>
                    <button onClick={() => setLogs([])} className="text-[10px] text-white/40 hover:text-white uppercase font-bold px-2 py-1 bg-white/5 rounded border border-white/10">Leeren</button>
                  </div>
                </div>
                <div className="bg-[#09090e] border border-[#1c1c28] rounded-xl p-2 overflow-y-auto space-y-1.5 font-mono text-xs max-h-[32vh] sm:max-h-[36vh]">
                  {logs.length === 0 ? <div className="h-full flex items-center justify-center text-white/30 text-xs uppercase tracking-wider py-10">Keine Aktionen protokolliert</div> : logs.map(log => (
                    <div key={log.id} className="flex items-start gap-2.5 py-1 px-2 rounded bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                      <span className="text-white/30 text-[10px] pt-0.5 shrink-0">{log.time}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase shrink-0 ${log.tag === 'P2P' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : log.tag === 'SEQ' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>{log.tag}</span>
                      <span className="text-white/80 text-[11px] break-all">{log.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Global sequence control — single source, no duplication across tabs */}
      <div className="flex-none bg-[#0a0a0f] border-t border-[#1f1f28] p-3 sm:p-4">
        <div className="max-w-xl mx-auto">
          {isActive && targetFlashes > 0 && activeTab !== 'auto' && (
            <div className="mb-2 flex justify-between text-[11px] text-white/60"><span>Fortschritt</span><span className="font-bold text-purple-400 tabular-nums">{changeCount} / {targetFlashes}</span></div>
          )}
          {isActive && targetFlashes > 0 && activeTab !== 'auto' && (
            <div className="w-full bg-[#181822] h-1.5 rounded-full overflow-hidden border border-white/5 mb-3"><div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-200" style={{ width: `${Math.min(100, (changeCount / targetFlashes) * 100)}%` }} /></div>
          )}
          <button onClick={isActive || isCountingDown ? stopSequence : startSequence} className={`w-full py-3.5 sm:py-4 px-4 rounded-2xl text-[11px] sm:text-xs font-black tracking-wide uppercase flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-[0.98] leading-none whitespace-nowrap ${isActive || isCountingDown ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'}`}>
            {isCountingDown ? <><Clock className="animate-spin shrink-0" size={16} /> Start in {currentCountdown}s — Abbrechen</> : isActive ? <><Square size={16} className="shrink-0" /> Stoppen ({changeCount}/{targetFlashes > 0 ? targetFlashes : '∞'})</> : <><Play size={16} className="shrink-0" /> Sequenz starten · {intervalMs}ms · {targetFlashes}×</>}
          </button>
          {isCountingDown && <p className="text-center text-[10px] text-amber-400 mt-2.5 tracking-wider uppercase animate-pulse">Countdown läuft — Display bereithalten</p>}
        </div>
      </div>

      {/* Mobile footer nav — bottom-anchored, thumb-friendly */}
      <nav className="flex-none bg-[#09090d]/95 backdrop-blur-xl border-t border-[#1f1f28] px-1 sm:px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex max-w-xl mx-auto">
          {[
            { id: 'pad' as const, label: 'Pad', icon: LayoutGrid, badge: null },
            { id: 'auto' as const, label: 'Automatik', icon: Sliders, badge: null },
            { id: 'system' as const, label: 'Diagnose', icon: List, badge: logs.length ? String(logs.length) : null },
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl mx-1 min-h-[56px] transition-all ${active ? 'text-purple-400' : 'text-white/40 hover:text-white/70 active:text-white/90'}`}
              >
                <span className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all ${active ? 'bg-purple-500/15 ring-1 ring-purple-500/30' : 'bg-transparent'}`}>
                  <tab.icon size={18} className={active ? 'text-purple-400' : ''} />
                  {tab.badge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-black leading-none border-2 border-[#09090d]">{tab.badge}</span>
                  )}
                </span>
                <span className={`text-[10px] font-black tracking-widest uppercase leading-none ${active ? 'text-purple-400' : 'text-white/50'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
