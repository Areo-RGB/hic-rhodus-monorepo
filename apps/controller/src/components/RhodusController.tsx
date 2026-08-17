import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ref, update, onValue } from 'firebase/database';
import { rtdb } from '../lib/firebase';
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
  Cloud, 
  RefreshCw, 
  ShieldCheck, 
  WifiOff,
  Zap,
  Sliders,
  Timer,
  CheckCircle2,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Smartphone,
  Eye,
  AlertCircle
} from 'lucide-react';

const DEFAULT_COLORS = ['#facc15', '#ef4444', '#3b82f6', '#22c55e'];
const QUADRANT_NAMES = ['TOP-LEFT (1)', 'TOP-RIGHT (2)', 'BOTTOM-LEFT (3)', 'BOTTOM-RIGHT (4)'];

type SyncMode = 'hybrid' | 'nearby' | 'firebase';
type FlashMode = 'auto' | 'manual';

export default function RhodusController() {
  const [activeTab, setActiveTab] = useState<'control' | 'sequence' | 'sync' | 'log'>('control');
  const [roomId, setRoomId] = useState('444');
  const [syncMode, setSyncMode] = useState<SyncMode>('hybrid');
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  
  // Sequence configurations
  const [intervalMs, setIntervalMs] = useState(1000);
  const [targetFlashes, setTargetFlashes] = useState(15);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [manualHoldDuration, setManualHoldDuration] = useState(500);

  // Runtime states
  const [isActive, setIsActive] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [currentCountdown, setCurrentCountdown] = useState(3);
  const [changeCount, setChangeCount] = useState(0);
  const [activeCellIndex, setActiveCellIndex] = useState(-1);
  const [lastActionTime, setLastActionTime] = useState<string>('Ready');

  // Connection & telemetry
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>('idle');
  const [nearbyDetails, setNearbyDetails] = useState('');
  const [firebaseConnected, setFirebaseConnected] = useState(true);
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [logs, setLogs] = useState<{ id: string; time: string; tag: 'P2P' | 'CLOUD' | 'SEQ' | 'MAN'; msg: string }[]>([]);

  // Refs for timer precision
  const flashTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);
  const manualResetTimer = useRef<number | null>(null);
  const changeCountRef = useRef(changeCount);
  const isActiveRef = useRef(isActive);
  const colorsRef = useRef(colors);
  const syncModeRef = useRef(syncMode);
  const roomIdRef = useRef(roomId);

  useEffect(() => { changeCountRef.current = changeCount; }, [changeCount]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { colorsRef.current = colors; }, [colors]);
  useEffect(() => { syncModeRef.current = syncMode; }, [syncMode]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const addLog = (tag: 'P2P' | 'CLOUD' | 'SEQ' | 'MAN', msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ id: Math.random().toString(36).substring(2, 9), time, tag, msg }, ...prev].slice(0, 60));
  };

  // Play subtle web audio beep for tactile feedback
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
    } catch {
      // Audio context might be restricted before interaction
    }
  };

  // Broadcast state to Firebase & Nearby
  const broadcastState = useCallback((cellIndex: number, count: number, currentColors = colorsRef.current) => {
    const mode = syncModeRef.current;
    const currentRoom = roomIdRef.current || '444';
    setLastActionTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    // 1. Firebase Online Sync
    if (mode === 'hybrid' || mode === 'firebase') {
      try {
        update(ref(rtdb, `rooms/${currentRoom}`), {
          activeCellIndex: cellIndex,
          changeCount: count,
          colors: currentColors,
          updatedAt: Date.now()
        }).catch(err => {
          console.warn('Firebase sync error:', err);
        });
      } catch (e) {
        console.warn('Firebase broadcast error:', e);
      }
    }

    // 2. Nearby Connections Offline P2P
    if (mode === 'hybrid' || mode === 'nearby') {
      sendNearbyPayload({
        activeCellIndex: cellIndex,
        changeCount: count,
        colors: currentColors
      });
    }
  }, []);

  // Initialize Nearby Connections for Controller
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

    return () => {
      stopNearbyConnection();
      window.onNearbyStatusChanged = undefined;
    };
  }, [initNearby]);

  // Sync Room with Firebase Realtime Database
  useEffect(() => {
    const currentRoom = roomId || '444';
    try {
      const roomRef = ref(rtdb, `rooms/${currentRoom}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        setFirebaseConnected(true);
        const data = snapshot.val();
        if (data && data.colors && Array.isArray(data.colors) && data.colors.length === 4) {
          setColors(data.colors);
        } else {
          // Initialize default room state if not present
          update(ref(rtdb, `rooms/${currentRoom}`), {
            colors: DEFAULT_COLORS,
            activeCellIndex: -1,
            changeCount: 0,
            updatedAt: Date.now()
          });
          setColors(DEFAULT_COLORS);
        }
      }, (err) => {
        console.warn('Firebase listener err:', err);
        setFirebaseConnected(false);
      });

      return () => {
        unsubscribe();
      };
    } catch (e) {
      console.warn('Firebase setup err:', e);
      setFirebaseConnected(false);
    }
  }, [roomId]);

  // Stop sequence and clear timers
  const stopSequence = useCallback(() => {
    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
    if (countdownTimer.current !== null) {
      window.clearTimeout(countdownTimer.current);
      countdownTimer.current = null;
    }
    if (manualResetTimer.current !== null) {
      window.clearTimeout(manualResetTimer.current);
      manualResetTimer.current = null;
    }
    setIsActive(false);
    isActiveRef.current = false;
    setIsCountingDown(false);
    setActiveCellIndex(-1);
    broadcastState(-1, changeCountRef.current);
    addLog('SEQ', 'Sequence stopped / reset');
    playHapticTone(300, 'square', 0.12);
  }, [broadcastState]);

  // Shuffle colors
  const reshuffleColors = () => {
    const shuffled = [...colorsRef.current].sort(() => Math.random() - 0.5);
    setColors(shuffled);
    broadcastState(activeCellIndex, changeCount, shuffled);
    addLog('MAN', 'Colors reshuffled');
    playHapticTone(580, 'triangle', 0.1);
  };

  // Reset default colors
  const resetDefaultColors = () => {
    setColors(DEFAULT_COLORS);
    broadcastState(activeCellIndex, changeCount, DEFAULT_COLORS);
    addLog('MAN', 'Reset to standard HUD palette');
    playHapticTone(520, 'triangle', 0.1);
  };

  // Next color picker logic (no consecutive repeat)
  const nextColor = (currentLastColorIndex: number) => {
    const colorArray = colorsRef.current;
    const offset = 1 + Math.floor(Math.random() * (colorArray.length - 1));
    const nextIdx = currentLastColorIndex < 0 
      ? Math.floor(Math.random() * colorArray.length)
      : (currentLastColorIndex + offset) % colorArray.length;
      
    setActiveCellIndex(nextIdx);
    setChangeCount(prev => {
      const nextCount = prev + 1;
      broadcastState(nextIdx, nextCount);
      addLog('SEQ', `Flash #${nextCount} → Quadrant ${nextIdx + 1} (${colorArray[nextIdx]})`);
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
      if (isActiveRef.current) {
        scheduleNextFlash(nextIdx);
      }
    }, intervalMs);
  };

  const startSequence = () => {
    if (countdownSeconds > 0) {
      setIsCountingDown(true);
      setCurrentCountdown(countdownSeconds);
      addLog('SEQ', `Pre-run countdown initiated (${countdownSeconds}s)`);
      
      let current = countdownSeconds;
      playHapticTone(440, 'sine', 0.08);

      const runCountDown = () => {
        countdownTimer.current = window.setTimeout(() => {
          current -= 1;
          if (current > 0) {
            setCurrentCountdown(current);
            playHapticTone(440, 'sine', 0.08);
            runCountDown();
          } else {
            setIsCountingDown(false);
            playHapticTone(880, 'sine', 0.15);
            beginActualSequence();
          }
        }, 1000);
      };
      runCountDown();
    } else {
      beginActualSequence();
    }
  };

  const beginActualSequence = () => {
    setIsActive(true);
    isActiveRef.current = true;
    setChangeCount(0);
    changeCountRef.current = 0;
    addLog('SEQ', `Auto-sequence started: ${intervalMs}ms interval, target: ${targetFlashes > 0 ? targetFlashes : '∞'}`);
    
    flashTimer.current = window.setTimeout(() => {
      if (!isActiveRef.current) return;
      const nextIdx = nextColor(-1);
      scheduleNextFlash(nextIdx);
    }, intervalMs);
  };

  // Manual Trigger
  const handleManualTrigger = (index: number) => {
    if (isActive) {
      stopSequence();
    }
    if (manualResetTimer.current) {
      clearTimeout(manualResetTimer.current);
    }
    
    setActiveCellIndex(index);
    const newCount = changeCount + 1;
    setChangeCount(newCount);
    broadcastState(index, newCount);
    addLog('MAN', `Manual trigger: Quadrant ${index + 1} (${colors[index]})`);
    playHapticTone(700 + index * 100, 'triangle', 0.08);

    manualResetTimer.current = window.setTimeout(() => {
      setActiveCellIndex(-1);
      broadcastState(-1, newCount);
    }, manualHoldDuration);
  };

  // Instant Blackout
  const handleInstantBlackout = () => {
    if (isActive) stopSequence();
    setActiveCellIndex(-1);
    broadcastState(-1, changeCount);
    addLog('MAN', 'Blackout command sent to Display');
    playHapticTone(220, 'square', 0.1);
  };

  // Test Pattern Sweep
  const runTestPattern = () => {
    if (isActive) stopSequence();
    addLog('MAN', 'Running test pattern sweep (1→2→3→4)');
    [0, 1, 2, 3].forEach((idx) => {
      setTimeout(() => {
        setActiveCellIndex(idx);
        broadcastState(idx, idx + 1);
        playHapticTone(500 + idx * 100, 'sine', 0.05);
      }, idx * 300);
    });
    setTimeout(() => {
      setActiveCellIndex(-1);
      broadcastState(-1, 4);
    }, 1300);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050507] text-white font-mono select-none overflow-hidden">
      {/* HUD Header Bar */}
      <header className="flex-none bg-[#0d0d12] border-b border-[#1f1f28] px-3.5 py-2.5 sm:px-5 sm:py-3 z-30">
        <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
          {/* Logo & Role Identity */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-md shadow-purple-900/40 ring-1 ring-white/20">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white">HIC RHODUS</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                  CONTROLLER
                </span>
              </div>
              <p className="text-[10px] text-white/40 leading-none mt-0.5 hidden sm:block">
                HUD Reflex & Flash Commander
              </p>
            </div>
          </div>

          {/* Connection Status Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px]">
            {/* Nearby P2P Badge */}
            <button 
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                nearbyStatus === 'connected' 
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
                  : nearbyStatus === 'discovering'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
              }`}
              title="P2P Status"
            >
              <Radio size={12} className={nearbyStatus === 'connected' ? 'text-emerald-400' : nearbyStatus === 'discovering' ? 'text-amber-400' : ''} />
              <span className="font-bold tracking-wider uppercase text-[10px]">
                {nearbyStatus === 'connected' ? 'P2P' : nearbyStatus === 'discovering' ? 'P2P SEARCH' : 'P2P'}
              </span>
            </button>

            {/* Firebase Cloud Badge */}
            <button 
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                firebaseConnected 
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' 
                  : 'bg-red-500/15 border-red-500/40 text-red-300'
              }`}
              title="Cloud Room"
            >
              <Cloud size={12} className={firebaseConnected ? 'text-blue-400' : 'text-red-400'} />
              <span className="font-bold tracking-wider uppercase text-[10px]">
                #{roomId}
              </span>
            </button>

            {/* Audio Feedback Toggle */}
            <button 
              onClick={() => setSoundFeedback(!soundFeedback)}
              className="p-1.5 text-white/40 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors"
              title={soundFeedback ? "Sound: On" : "Sound: Off"}
            >
              {soundFeedback ? <Volume2 size={14} className="text-purple-400" /> : <VolumeX size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Segment Tabs */}
      <nav className="flex-none bg-[#09090d] border-b border-[#1f1f28] px-2 sm:px-6">
        <div className="flex max-w-7xl mx-auto">
          <button
            onClick={() => setActiveTab('control')}
            className={`flex-1 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'control'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-white/40 hover:text-white/80'
            }`}
          >
            <LayoutGrid size={14} /> Pad
          </button>
          <button
            onClick={() => setActiveTab('sequence')}
            className={`flex-1 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'sequence'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-white/40 hover:text-white/80'
            }`}
          >
            <Sliders size={14} /> Auto-Engine
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex-1 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'sync'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-white/40 hover:text-white/80'
            }`}
          >
            <Radio size={14} /> Sync & Rooms
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`flex-1 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'log'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-white/40 hover:text-white/80'
            }`}
          >
            <List size={14} /> Log
            {logs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-white/10 text-white/70">
                {logs.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 relative">
        <div className="max-w-4xl mx-auto h-full flex flex-col justify-between gap-4">

          {/* TAB 1: MANUAL CONTROL PAD */}
          {activeTab === 'control' && (
            <div className="flex-1 flex flex-col justify-between gap-3 max-w-xl mx-auto w-full">
              {/* Quick Status Pill Bar */}
              <div className="flex items-center justify-between bg-[#101017] border border-[#22222f] rounded-xl px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-white/40 uppercase tracking-wider text-[10px]">Flashes:</span>
                  <span className="font-bold text-white text-sm">{changeCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 uppercase tracking-wider text-[10px]">Active Quad:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${activeCellIndex >= 0 ? 'bg-purple-600 text-white' : 'text-white/30'}`}>
                    {activeCellIndex >= 0 ? `Q${activeCellIndex + 1}` : 'NONE'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 uppercase tracking-wider text-[10px]">Speed:</span>
                  <span className="font-bold text-purple-400">{intervalMs}ms</span>
                </div>
              </div>

              {/* 4-Quadrant Tactile Interactive Pad */}
              <div className="flex-1 flex items-center justify-center my-auto min-h-[260px] max-h-[420px]">
                <div className="grid grid-cols-2 grid-rows-2 gap-3 w-full aspect-square max-w-[360px] p-2 bg-[#09090e] border border-[#1c1c27] rounded-3xl shadow-2xl">
                  {colors.map((color, idx) => {
                    const isSelected = activeCellIndex === idx;
                    return (
                      <button
                        key={idx}
                        onPointerDown={() => handleManualTrigger(idx)}
                        className={`rounded-2xl transition-all duration-100 relative flex flex-col items-center justify-between p-3 select-none active:scale-95 shadow-lg group overflow-hidden ${
                          isSelected ? 'ring-4 ring-white shadow-2xl scale-[1.02]' : 'hover:opacity-90'
                        }`}
                        style={{
                          backgroundColor: color,
                          filter: isSelected ? 'brightness(1.15)' : 'brightness(0.85)',
                        }}
                      >
                        {/* Quadrant Number Top Corner */}
                        <div className="w-full flex items-center justify-between">
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-white border border-white/20">
                            Q{idx + 1}
                          </span>
                          <span className="text-[10px] font-bold text-black/70 group-hover:text-black transition-colors uppercase">
                            {idx === 0 ? 'TL' : idx === 1 ? 'TR' : idx === 2 ? 'BL' : 'BR'}
                          </span>
                        </div>

                        {/* Center Indicator */}
                        <div className="my-auto flex flex-col items-center">
                          {isSelected ? (
                            <span className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-white font-black text-xs tracking-widest animate-pulse border border-white/40">
                              FLASHING
                            </span>
                          ) : (
                            <span className="text-black/50 font-black text-2xl group-hover:text-black/80 transition-colors">
                              {idx + 1}
                            </span>
                          )}
                        </div>

                        {/* Bottom Color Name */}
                        <div className="w-full text-center">
                          <span className="text-[9px] font-bold text-black/60 bg-white/30 backdrop-blur-sm px-1.5 py-0.5 rounded uppercase tracking-wider">
                            TAP TO FLASH
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fast Action Row */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleInstantBlackout}
                  className="py-3 px-2 rounded-xl text-[11px] font-black tracking-widest uppercase flex items-center justify-center gap-1.5 bg-[#14141d] border border-[#262635] text-white/70 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
                >
                  <Square size={13} /> Blackout
                </button>
                <button
                  onClick={reshuffleColors}
                  className="py-3 px-2 rounded-xl text-[11px] font-black tracking-widest uppercase flex items-center justify-center gap-1.5 bg-[#14141d] border border-[#262635] text-white/70 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
                >
                  <Shuffle size={13} /> Shuffle
                </button>
                <button
                  onClick={runTestPattern}
                  className="py-3 px-2 rounded-xl text-[11px] font-black tracking-widest uppercase flex items-center justify-center gap-1.5 bg-[#14141d] border border-[#262635] text-white/70 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
                >
                  <Sparkles size={13} /> Test Sweep
                </button>
              </div>

              {/* Sequence Quick-Launcher */}
              <button
                onClick={isActive ? stopSequence : startSequence}
                className={`w-full py-4 rounded-2xl text-sm font-black tracking-widest uppercase flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-98 ${
                  isActive || isCountingDown
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
                }`}
              >
                {isCountingDown ? (
                  <span className="flex items-center gap-2">
                    <Clock className="animate-spin" size={18} /> STARTING IN {currentCountdown}s (CANCEL)
                  </span>
                ) : isActive ? (
                  <span className="flex items-center gap-2">
                    <Square size={16} /> STOP AUTO SEQUENCE ({changeCount}/{targetFlashes > 0 ? targetFlashes : '∞'})
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Play size={16} /> START AUTOMATION ({intervalMs}ms • {targetFlashes} FLASHES)
                  </span>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: AUTOMATION & SEQUENCE ENGINE */}
          {activeTab === 'sequence' && (
            <div className="max-w-xl mx-auto w-full space-y-4">
              {/* Sequence State Card */}
              <div className="bg-[#0f0f16] border border-[#222230] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders size={18} className="text-purple-400" />
                    <h2 className="text-xs font-bold tracking-widest uppercase text-white">Auto-Sequence Configuration</h2>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    isActive 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse' 
                      : isCountingDown
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {isActive ? 'RUNNING' : isCountingDown ? `COUNTDOWN (${currentCountdown})` : 'STANDBY'}
                  </span>
                </div>

                {/* Progress bar when running */}
                {isActive && targetFlashes > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-white/60">
                      <span>Progress</span>
                      <span className="font-bold text-purple-400">{changeCount} / {targetFlashes} ({Math.round((changeCount / targetFlashes) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-[#181822] h-2.5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-200"
                        style={{ width: `${Math.min(100, (changeCount / targetFlashes) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Interval Presets & Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold tracking-wider uppercase text-white/60">
                      Flash Pace / Intervall: <span className="text-purple-400 font-bold">{intervalMs} ms</span>
                    </label>
                    <span className="text-[10px] text-white/40">
                      ({(1000 / intervalMs).toFixed(1)} Flashes/sec)
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {[350, 500, 750, 1000, 1500].map(preset => (
                      <button
                        key={preset}
                        onClick={() => setIntervalMs(preset)}
                        className={`py-2 rounded-xl text-[10px] font-bold transition-all ${
                          intervalMs === preset
                            ? 'bg-purple-600 text-white border border-purple-400 shadow-md'
                            : 'bg-[#181824] text-white/60 hover:text-white border border-[#28283a]'
                        }`}
                      >
                        {preset}ms
                      </button>
                    ))}
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    min="200"
                    max="3000"
                    step="50"
                    value={intervalMs}
                    onChange={e => setIntervalMs(parseInt(e.target.value))}
                    className="w-full accent-purple-500 bg-[#1a1a26] rounded-lg h-2 cursor-pointer mt-1"
                  />
                </div>

                {/* Target Flash Count */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold tracking-wider uppercase text-white/60">
                    Zielanzahl Farbwechsel (Target Flashes)
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[5, 10, 15, 25, 50].map(count => (
                      <button
                        key={count}
                        onClick={() => setTargetFlashes(count)}
                        className={`py-2 rounded-xl text-[10px] font-bold transition-all ${
                          targetFlashes === count
                            ? 'bg-purple-600 text-white border border-purple-400 shadow-md'
                            : 'bg-[#181824] text-white/60 hover:text-white border border-[#28283a]'
                        }`}
                      >
                        {count}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-run Countdown Delay */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold tracking-wider uppercase text-white/60">
                    Start-Countdown Verzögerung
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 2, 3, 5].map(sec => (
                      <button
                        key={sec}
                        onClick={() => setCountdownSeconds(sec)}
                        className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                          countdownSeconds === sec
                            ? 'bg-indigo-600 text-white border border-indigo-400'
                            : 'bg-[#181824] text-white/60 hover:text-white border border-[#28283a]'
                        }`}
                      >
                        {sec === 0 ? 'Keiner' : `${sec} Sek.`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Start/Stop Button */}
              <button
                onClick={isActive ? stopSequence : startSequence}
                className={`w-full py-4 rounded-2xl text-sm font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all shadow-xl ${
                  isActive || isCountingDown
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                    : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-600/30'
                }`}
              >
                {isCountingDown ? (
                  <>Abbrechen ({currentCountdown}s)</>
                ) : isActive ? (
                  <><Square size={16} /> Sequenz Beenden</>
                ) : (
                  <><Play size={16} /> Sequenz Jetzt Starten</>
                )}
              </button>

              {/* Palette Actions */}
              <div className="flex gap-2">
                <button
                  onClick={reshuffleColors}
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-[#101018] border border-[#222230] text-white/70 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Shuffle size={13} /> Raster Neu Mischen
                </button>
                <button
                  onClick={resetDefaultColors}
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-[#101018] border border-[#222230] text-white/70 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={13} /> Standard Farbraster
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SYNC, P2P & ROOMS */}
          {activeTab === 'sync' && (
            <div className="max-w-xl mx-auto w-full space-y-4">
              {/* Sync Mode Selector */}
              <div className="bg-[#0f0f16] border border-[#222230] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-white/60">Übertragungsmodus</h3>
                  <span className="text-[10px] text-purple-400 font-bold uppercase">{syncMode}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setSyncMode('hybrid'); addLog('P2P', 'Sync mode changed to HYBRID (P2P + Cloud)'); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                      syncMode === 'hybrid'
                        ? 'border-purple-500 bg-purple-500/15 text-white shadow-lg'
                        : 'border-[#222230] bg-[#14141d] text-white/50 hover:text-white'
                    }`}
                  >
                    <Radio size={16} className={syncMode === 'hybrid' ? 'text-purple-400' : ''} />
                    <span className="text-[11px] font-black">Hybrid</span>
                    <span className="text-[9px] text-white/40">P2P + Cloud</span>
                  </button>

                  <button
                    onClick={() => { setSyncMode('nearby'); addLog('P2P', 'Sync mode changed to NEARBY OFFLINE'); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                      syncMode === 'nearby'
                        ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-lg'
                        : 'border-[#222230] bg-[#14141d] text-white/50 hover:text-white'
                    }`}
                  >
                    <WifiOff size={16} className={syncMode === 'nearby' ? 'text-emerald-400' : ''} />
                    <span className="text-[11px] font-black">Nearby</span>
                    <span className="text-[9px] text-white/40">Offline Direct</span>
                  </button>

                  <button
                    onClick={() => { setSyncMode('firebase'); addLog('CLOUD', 'Sync mode changed to FIREBASE CLOUD ONLY'); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                      syncMode === 'firebase'
                        ? 'border-blue-500 bg-blue-500/15 text-white shadow-lg'
                        : 'border-[#222230] bg-[#14141d] text-white/50 hover:text-white'
                    }`}
                  >
                    <Cloud size={16} className={syncMode === 'firebase' ? 'text-blue-400' : ''} />
                    <span className="text-[11px] font-black">Cloud RTDB</span>
                    <span className="text-[9px] text-white/40">Internet Room</span>
                  </button>
                </div>
              </div>

              {/* Nearby Connections (Offline P2P) Card */}
              <div className="bg-[#0f0f16] border border-[#222230] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio size={16} className="text-emerald-400" />
                    <h3 className="text-xs font-bold tracking-widest uppercase">Nearby Connections (Offline P2P)</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    nearbyStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : nearbyStatus === 'discovering'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {nearbyStatus}
                  </span>
                </div>

                <p className="text-xs text-white/60 leading-relaxed">
                  Verbindet sich direkt über Bluetooth Low Energy & Wi-Fi Direct mit dem Display-Gerät — ganz ohne Internetzugang oder Router.
                </p>

                {nearbyDetails && (
                  <div className="bg-[#151520] border border-[#272738] rounded-xl p-2.5 text-xs text-white/70">
                    Statusmeldung: {nearbyDetails}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={initNearby}
                    className="flex-1 py-2.5 bg-[#1b1b26] hover:bg-[#252535] text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw size={14} /> Display Neu Suchen
                  </button>
                  <button
                    onClick={requestNearbyPermissions}
                    className="px-4 py-2.5 bg-[#1b1b26] hover:bg-[#252535] text-white/80 text-xs font-bold uppercase rounded-xl border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
                    title="Berechtigungen anfordern"
                  >
                    <ShieldCheck size={14} /> Rechte
                  </button>
                </div>
              </div>

              {/* Firebase Cloud Realtime Room */}
              <div className="bg-[#0f0f16] border border-[#222230] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud size={16} className="text-blue-400" />
                    <h3 className="text-xs font-bold tracking-widest uppercase">Firebase Realtime Room</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    firebaseConnected ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {firebaseConnected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/50 uppercase tracking-wider font-bold">Raumnummer (Room PIN)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roomId}
                      onChange={e => setRoomId(e.target.value.trim())}
                      placeholder="444"
                      className="flex-1 bg-[#151520] border border-[#28283a] rounded-xl px-3 py-2 text-white font-mono font-bold text-center tracking-widest focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => broadcastState(activeCellIndex, changeCount)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase rounded-xl transition-colors"
                    >
                      Sync Ping
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EVENT LOG & TELEMETRY */}
          {activeTab === 'log' && (
            <div className="max-w-xl mx-auto w-full h-full flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">Live Telemetrie-Stream</span>
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] text-white/40 hover:text-white uppercase font-bold px-2 py-1 bg-white/5 rounded border border-white/10"
                >
                  Log Leeren
                </button>
              </div>

              <div className="flex-1 bg-[#09090e] border border-[#1c1c28] rounded-2xl p-3 overflow-y-auto space-y-1.5 font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs uppercase tracking-wider py-12">
                    Keine Aktionen protokolliert
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="flex items-start gap-2.5 py-1 px-2 rounded bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                      <span className="text-white/30 text-[10px] pt-0.5">{log.time}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                        log.tag === 'P2P' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        log.tag === 'CLOUD' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        log.tag === 'SEQ' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {log.tag}
                      </span>
                      <span className="text-white/80 text-[11px] break-all">{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer Info */}
      <footer className="flex-none bg-[#0a0a0f] border-t border-[#181822] px-4 py-2 text-[10px] text-white/30 flex items-center justify-between">
        <span>HIC RHODUS CONTROLLER</span>
        <span>Letzte Aktion: {lastActionTime}</span>
      </footer>
    </div>
  );
}
