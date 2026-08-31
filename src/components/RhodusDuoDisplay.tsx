import React, { useEffect, useState } from 'react';
import { 
  isNearbyAvailable, 
  startNearbyDisplay, 
  stopNearbyConnection, 
  NearbyStatus, 
  NearbySyncPayload 
} from '../lib/nearby';
import { X, Wifi, Radio, ShieldCheck } from 'lucide-react';

const DEFAULT_COLORS = ['#facc15', '#ef4444', '#3b82f6', '#22c55e'];

function getContrastTextColor(hexColor: string): string {
  if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
  let hex = hexColor.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#ffffff';

  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return '#ffffff';

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 130 ? '#000000' : '#ffffff';
}

export default function RhodusDuoDisplay({ onExit }: { onExit?: () => void }) {
  const [activeCellIndex, setActiveCellIndex] = useState(-1);
  const [changeCount, setChangeCount] = useState(0);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  
  // Connection states
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>('idle');
  const [nearbyDetails, setNearbyDetails] = useState('');
  const [showConnectionBar, setShowConnectionBar] = useState(true);

  // Setup Nearby Connections (Offline P2P)
  useEffect(() => {
    // Start advertising Display
    startNearbyDisplay('HicRhodusDisplay');

    window.onNearbyStatusChanged = (status: string, details: string) => {
      setNearbyStatus(status as NearbyStatus);
      setNearbyDetails(details);
    };

    window.onNearbyPayloadReceived = (jsonString: string) => {
      try {
        const payload = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        if (payload) {
          if (payload.activeCellIndex !== undefined) {
            setActiveCellIndex(payload.activeCellIndex);
          }
          if (payload.changeCount !== undefined) {
            setChangeCount(payload.changeCount);
          }
          if (payload.colors && Array.isArray(payload.colors) && payload.colors.length === 4) {
            setColors(payload.colors);
          }
          if (payload.countdown !== undefined) {
            setCountdownValue(payload.countdown);
          } else if (payload.activeCellIndex !== undefined && payload.activeCellIndex !== -1) {
            // Any flash implicitly clears stale countdown (fallback if null payload lost)
            setCountdownValue(null);
          }
        }
      } catch (e) {
        console.error('Failed to parse Nearby payload:', e);
      }
    };

    return () => {
      stopNearbyConnection();
      window.onNearbyStatusChanged = undefined;
      window.onNearbyPayloadReceived = undefined;
    };
  }, []);

  return (
    <div className="flex h-full w-full bg-[#000000] text-white font-mono select-none overflow-hidden relative">
      {/* Top Header / Exit & Status Bar */}
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        {onExit && (
          <button
            onClick={onExit}
            className="pointer-events-auto p-2.5 bg-black/60 hover:bg-black/90 rounded-full transition-colors text-white/70 hover:text-white backdrop-blur-md border border-white/10 shadow-lg"
            title="Schließen"
          >
            <X size={22} />
          </button>
        )}

        {/* Live Multi-Connection Indicator */}
        <div 
          onClick={() => setShowConnectionBar(!showConnectionBar)}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-xs shadow-lg cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Radio size={14} className={nearbyStatus === 'connected' ? 'text-emerald-400 animate-pulse' : nearbyStatus === 'advertising' ? 'text-amber-400 animate-pulse' : 'text-white/40'} />
            <span className={nearbyStatus === 'connected' ? 'text-emerald-400 font-bold' : 'text-white/60'}>
              {nearbyStatus === 'connected' ? 'Nearby P2P' : nearbyStatus === 'advertising' ? 'P2P Sucht...' : 'P2P Offline'}
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1 hic-rhodus-app relative">
        <div className="color-grid">
          {colors.map((color, index) => (
            <div 
              key={index} 
              className={`color-cell ${activeCellIndex === index ? 'active' : ''}`} 
              style={{ backgroundColor: color }}
            >
              {activeCellIndex === index && changeCount > 0 && (
                <div 
                  className="cell-number" 
                  style={{ color: getContrastTextColor(color) }}
                >
                  {changeCount}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
      {countdownValue !== null && countdownValue > 0 && (
        <div className="countdown" aria-live="assertive">
          <span key={countdownValue}>{countdownValue}</span>
        </div>
      )}
    </div>
  );
}
