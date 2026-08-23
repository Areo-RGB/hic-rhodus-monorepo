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
  X, 
  Play, 
  Square, 
  Settings, 
  LayoutGrid, 
  List, 
  Shuffle, 
  RotateCcw,
  Radio,
  RefreshCw,
  ShieldCheck,
  WifiOff
} from 'lucide-react';

const DEFAULT_COLORS = ['#facc15', '#ef4444', '#3b82f6', '#22c55e'];

export default function RhodusDuoController({ onExit }: { onExit: () => void }) {
  const [activeTab, setActiveTab] = useState<'settings' | 'grid' | 'connection' | 'log'>('settings');
  const [intervalMs, setIntervalMs] = useState(1000);
  const [targetFlashes, setTargetFlashes] = useState(10);
  const [colors, setColors] = useState(DEFAULT_COLORS);

  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>('idle');
  const [nearbyDetails, setNearbyDetails] = useState('');

  const [isActive, setIsActive] = useState(false);
  const [changeCount, setChangeCount] = useState(0);
  const [activeCellIndex, setActiveCellIndex] = useState(-1);
  const [logs, setLogs] = useState<{time: string, msg: string}[]>([]);

  const flashTimer = useRef<number | null>(null);
  const changeCountRef = useRef(changeCount);
  const isActiveRef = useRef(isActive);
  const colorsRef = useRef(colors);

  useEffect(() => { changeCountRef.current = changeCount; }, [changeCount]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { colorsRef.current = colors; }, [colors]);

  const addLog = (msg: string) => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg }, ...prev].slice(0, 50));
  };

  // Broadcast to Nearby Connections
  const broadcastState = (cellIndex: number, count: number, currentColors = colorsRef.current) => {
    sendNearbyPayload({
      activeCellIndex: cellIndex,
      changeCount: count,
      colors: currentColors
    });
  };

  // Setup Nearby Connections for Controller
  const initNearby = () => {
    startNearbyController();
    addLog('Nearby P2P discovery started');
  };

  useEffect(() => {
    initNearby();

    window.onNearbyStatusChanged = (status: string, details: string) => {
      setNearbyStatus(status as NearbyStatus);
      setNearbyDetails(details);
      addLog(`Nearby: ${status} ${details ? `(${details})` : ''}`);
    };

    return () => {
      stopNearbyConnection();
      window.onNearbyStatusChanged = undefined;
    };
  }, []);

  // Reset display state when leaving
  useEffect(() => {
    return () => {
      broadcastState(-1, 0);
    };
  }, []);

  const reshuffleColors = () => {
    const shuffled = [...colorsRef.current].sort(() => Math.random() - 0.5);
    setColors(shuffled);
    broadcastState(-1, 0, shuffled);
    addLog('Grid reshuffled');
  };

  const resetDefaultColors = () => {
    setColors(DEFAULT_COLORS);
    broadcastState(-1, 0, DEFAULT_COLORS);
    addLog('Grid reset to default colors');
  };

  const stopSequence = useCallback(() => {
    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
    setIsActive(false);
    isActiveRef.current = false;
    setActiveCellIndex(-1);
    broadcastState(-1, 0);
    addLog('Sequence stopped');
  }, []);

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
      addLog(`Flash ${nextCount} at index ${nextIdx}`);
      return nextCount;
    });
    return nextIdx;
  };

  const scheduleNextFlash = (currentLastColorIndex: number) => {
    if (!isActiveRef.current) return;
    
    flashTimer.current = window.setTimeout(() => {
      flashTimer.current = null;
      if (!isActiveRef.current) return;
      
      if (changeCountRef.current >= targetFlashes) {
        stopSequence();
        addLog('Sequence complete');
        return;
      }
      
      const nextIdx = nextColor(currentLastColorIndex);
      if (isActiveRef.current) {
        scheduleNextFlash(nextIdx);
      }
    }, intervalMs);
  };

  const startSequence = () => {
    setIsActive(true);
    isActiveRef.current = true;
    setChangeCount(0);
    changeCountRef.current = 0;
    addLog(`Starting sequence: ${targetFlashes} flashes, ${intervalMs}ms interval`);
    
    flashTimer.current = window.setTimeout(() => {
      if (!isActiveRef.current) return;
      const nextIdx = nextColor(-1);
      scheduleNextFlash(nextIdx);
    }, intervalMs);
  };

  const handleManualGridClick = (index: number) => {
    if (isActive) stopSequence();
    setActiveCellIndex(index);
    broadcastState(index, 1);
    addLog(`Manual flash at index ${index}`);
    
    setTimeout(() => {
      setActiveCellIndex(-1);
      broadcastState(-1, 0);
    }, 500);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0c] text-white font-mono">
      {/* Top Header */}
      <header className="flex items-center justify-between p-4 border-b border-[#222226] bg-[#111115]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-widest uppercase text-purple-400">Duo Controller</h1>
          
          {/* Quick status pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/40 border border-white/10 rounded-full text-[11px]">
            <Radio size={12} className={nearbyStatus === 'connected' ? 'text-emerald-400' : nearbyStatus === 'discovering' ? 'text-amber-400 animate-pulse' : 'text-white/40'} />
            <span className={nearbyStatus === 'connected' ? 'text-emerald-400 font-bold' : 'text-white/60'}>
              {nearbyStatus === 'connected' ? 'P2P Online' : nearbyStatus === 'discovering' ? 'P2P Suche...' : 'P2P'}
            </span>
          </div>
        </div>

        <button onClick={onExit} className="p-2 text-white/50 hover:text-white transition-colors" title="Beenden">
          <X size={20} />
        </button>
      </header>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#222226] bg-[#111115]">
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'settings' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-white/40 hover:text-white/80'}`}
        >
          <Settings size={14} /> Auto
        </button>
        <button 
          onClick={() => setActiveTab('grid')}
          className={`flex-1 py-3 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'grid' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-white/40 hover:text-white/80'}`}
        >
          <LayoutGrid size={14} /> Manual
        </button>
        <button 
          onClick={() => setActiveTab('connection')}
          className={`flex-1 py-3 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'connection' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-white/40 hover:text-white/80'}`}
        >
          <Radio size={14} /> Sync
        </button>
        <button 
          onClick={() => setActiveTab('log')}
          className={`flex-1 py-3 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'log' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-white/40 hover:text-white/80'}`}
        >
          <List size={14} /> Log
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="bg-[#111115] border border-[#222226] rounded-2xl p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-white/50">Intervall (ms)</label>
                <input 
                  type="number" 
                  value={intervalMs}
                  onChange={e => setIntervalMs(parseInt(e.target.value) || 1000)}
                  className="w-full bg-[#0a0a0c] border border-[#222226] rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold tracking-widest uppercase text-white/50">Ziel-Farbwechsel</label>
                <input 
                  type="number" 
                  value={targetFlashes}
                  onChange={e => setTargetFlashes(parseInt(e.target.value) || 10)}
                  className="w-full bg-[#0a0a0c] border border-[#222226] rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              onClick={isActive ? stopSequence : startSequence}
              className={`w-full py-4 rounded-2xl text-sm font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${
                isActive 
                  ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30'
                  : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/25'
              }`}
            >
              {isActive ? <><Square size={16} /> Sequenz Stoppen</> : <><Play size={16} /> Sequenz Starten</>}
            </button>

            {!isActive && (
              <div className="flex gap-3">
                <button
                  onClick={reshuffleColors}
                  className="flex-1 py-3.5 rounded-2xl text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 bg-[#111115] border border-[#222226] text-white hover:bg-white/5 transition-colors"
                >
                  <Shuffle size={15} /> Neu Mischen
                </button>
                <button
                  onClick={resetDefaultColors}
                  className="flex-1 py-3.5 rounded-2xl text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 bg-[#111115] border border-[#222226] text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <RotateCcw size={15} /> Zurücksetzen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Manual Grid Tab */}
        {activeTab === 'grid' && (
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full max-w-md aspect-square">
              {colors.map((color, idx) => (
                <button
                  key={idx}
                  onPointerDown={() => handleManualGridClick(idx)}
                  className="rounded-2xl transition-all active:scale-95 relative flex items-center justify-center font-bold text-lg text-white shadow-lg overflow-hidden"
                  style={{ 
                    backgroundColor: color,
                    opacity: activeCellIndex === idx ? 1 : 0.6,
                    outline: activeCellIndex === idx ? '4px solid #ffffff' : '2px solid rgba(255,255,255,0.1)',
                    outlineOffset: '-4px'
                  }}
                >
                  {activeCellIndex === idx && (
                    <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs tracking-widest">
                      AKTIV
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/40 tracking-wider uppercase text-center">
              Feld antippen, um es sofort auf dem Display aufleuchten zu lassen
            </p>
          </div>
        )}

        {/* Connection & Offline Sync Tab */}
        {activeTab === 'connection' && (
          <div className="max-w-md mx-auto space-y-6">
            {/* Nearby Connections Details Card */}
            <div className="bg-[#111115] border border-[#222226] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio size={18} className="text-emerald-400" />
                  <h3 className="text-xs font-bold tracking-widest uppercase">Nearby Connections (Offline P2P)</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
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
                Verbindet zwei Android-Geräte direkt über Bluetooth & Wi-Fi Direct — funktioniert komplett ohne Internetverbindung oder WLAN-Router!
              </p>

              {nearbyDetails && (
                <div className="bg-[#0a0a0c] border border-[#222226] rounded-xl p-3 text-xs text-white/70">
                  Status: {nearbyDetails}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={initNearby}
                  className="flex-1 py-3 bg-[#1d1d24] hover:bg-[#252530] text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw size={14} /> Display Neu Suchen
                </button>

                <button
                  onClick={requestNearbyPermissions}
                  className="px-4 py-3 bg-[#1d1d24] hover:bg-[#252530] text-white/80 text-xs font-bold uppercase rounded-xl border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
                  title="Berechtigungen anfordern"
                >
                  <ShieldCheck size={14} /> Rechte
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'log' && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-xs font-bold tracking-widest uppercase">
                Keine Aktivität bisher
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="bg-[#111115] border border-[#222226] rounded-lg px-4 py-3 flex gap-4 text-xs">
                  <span className="text-purple-400 font-bold">{log.time}</span>
                  <span className="text-white/80">{log.msg}</span>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
