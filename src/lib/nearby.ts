// Unified bridge — supports single APK auto role detection
declare global {
  interface Window {
    AndroidNearby?: {
      isNearbySupported: () => boolean;
      checkPermissions: () => boolean;
      requestPermissions: () => void;
      startDisplayMode: (name: string) => void;
      startControllerMode: () => void;
      startUnifiedMode?: (name: string) => void;
      sendPayload: (jsonString: string) => void;
      stopNearby: () => void;
    };
    onNearbyStatusChanged?: (status: string, details: string) => void;
    onNearbyPayloadReceived?: (jsonString: string) => void;
  }
}
export type NearbyStatus = 'idle'|'advertising'|'discovering'|'found_device'|'connecting'|'connected'|'disconnected'|'rejected'|'error';
export interface NearbySyncPayload { activeCellIndex:number; changeCount:number; colors?:string[]; countdown?:number|null; }
export const isNearbyAvailable = () => typeof window !== 'undefined' && !!window.AndroidNearby;
export const startNearbyDisplay = (n='HicRhodusDisplay') => isNearbyAvailable() && window.AndroidNearby?.startDisplayMode(n);
export const startNearbyController = () => isNearbyAvailable() && window.AndroidNearby?.startControllerMode();
export const startUnifiedMode = (n='HicRhodusUnified') => {
  if (!isNearbyAvailable()) return;
  if (window.AndroidNearby?.startUnifiedMode) window.AndroidNearby.startUnifiedMode(n);
  else window.AndroidNearby?.startDisplayMode(n); // fallback pre-update
};
export const sendNearbyPayload = (p: NearbySyncPayload) => { try{ window.AndroidNearby?.sendPayload(JSON.stringify(p)); }catch{} };
export const stopNearbyConnection = () => window.AndroidNearby?.stopNearby();
export const requestNearbyPermissions = () => window.AndroidNearby?.requestPermissions();
