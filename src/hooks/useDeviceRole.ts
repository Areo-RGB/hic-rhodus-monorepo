import { useEffect, useState, useCallback } from "react";
import { isNearbyAvailable, startUnifiedMode, stopNearbyConnection, NearbyStatus } from "../lib/nearby";
export type DeviceRole = "local" | "display" | "controller" | null;
declare global { interface Window { AndroidDevice?: { isTablet: () => boolean } } }
const LS_KEY = "rhodus-role";
export function useDeviceRole() {
  const [role, setRole] = useState<DeviceRole>(() => {
    const qp = new URLSearchParams(window.location.search).get("role");
    if (qp === "display" || qp === "controller" || qp === "local") return qp;
    const saved = localStorage.getItem(LS_KEY) as DeviceRole | null;
    if (saved) return saved;
    return null; // show selector
  });
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>("idle");
  useEffect(() => {
    if (!role) return;
    localStorage.setItem(LS_KEY, role);
    if (role !== "local") startUnifiedMode();
    const prev = window.onNearbyStatusChanged;
    window.onNearbyStatusChanged = (s: string, d: string) => { setNearbyStatus(s as NearbyStatus); prev?.(s, d); };
    return () => { stopNearbyConnection(); window.onNearbyStatusChanged = prev; };
  }, [role]);
  const switchRole = useCallback((r: DeviceRole) => {
    if (r) localStorage.setItem(LS_KEY, r);
    else localStorage.removeItem(LS_KEY);
    setRole(r);
  }, []);
  const clearRole = useCallback(() => switchRole(null), [switchRole]);
  return { role, setRole: switchRole, clearRole, nearbyStatus, isNearby: isNearbyAvailable() };
}
