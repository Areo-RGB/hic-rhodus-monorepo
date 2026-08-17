// Bridge to Android Nearby Connections API

declare global {
  interface Window {
    AndroidNearby?: {
      isNearbySupported: () => boolean;
      checkPermissions: () => boolean;
      requestPermissions: () => void;
      startDisplayMode: (name: string) => void;
      startControllerMode: () => void;
      sendPayload: (jsonString: string) => void;
      stopNearby: () => void;
    };
    onNearbyStatusChanged?: (status: string, details: string) => void;
    onNearbyPayloadReceived?: (jsonString: string) => void;
    onNearbyPermissionsResult?: (granted: boolean) => void;
  }
}

export type NearbyStatus = 
  | 'idle'
  | 'advertising'
  | 'discovering'
  | 'found_device'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'rejected'
  | 'error';

export interface NearbySyncPayload {
  activeCellIndex: number;
  changeCount: number;
  colors?: string[];
  type?: 'flash' | 'reset' | 'shuffle' | 'colors';
}

export const isNearbyAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.AndroidNearby;
};

export const startNearbyDisplay = (displayName = 'HicRhodusDisplay') => {
  if (isNearbyAvailable()) {
    try {
      window.AndroidNearby?.startDisplayMode(displayName);
    } catch (e) {
      console.error('Error starting Nearby Display:', e);
    }
  }
};

export const startNearbyController = () => {
  if (isNearbyAvailable()) {
    try {
      window.AndroidNearby?.startControllerMode();
    } catch (e) {
      console.error('Error starting Nearby Controller:', e);
    }
  }
};

export const sendNearbyPayload = (payload: NearbySyncPayload) => {
  if (isNearbyAvailable()) {
    try {
      window.AndroidNearby?.sendPayload(JSON.stringify(payload));
    } catch (e) {
      console.error('Error sending Nearby payload:', e);
    }
  }
};

export const stopNearbyConnection = () => {
  if (isNearbyAvailable()) {
    try {
      window.AndroidNearby?.stopNearby();
    } catch (e) {
      console.error('Error stopping Nearby:', e);
    }
  }
};

export const requestNearbyPermissions = () => {
  if (isNearbyAvailable()) {
    try {
      window.AndroidNearby?.requestPermissions();
    } catch (e) {
      console.error('Error requesting permissions:', e);
    }
  }
};
