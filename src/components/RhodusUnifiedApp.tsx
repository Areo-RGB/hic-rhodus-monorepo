import RhodusApp from "./RhodusApp";
import RhodusDuoDisplay from "./RhodusDuoDisplay";
import RhodusDuoController from "./RhodusDuoController";
import RoleSelector from "./RoleSelector";
import { useDeviceRole } from "../hooks/useDeviceRole";

export default function RhodusUnifiedApp() {
  const { role, setRole, clearRole } = useDeviceRole();
  if (role === null) return <RoleSelector onSelect={setRole} />;
  return (
    <div className="h-full w-full relative">
      <button onClick={clearRole} className="absolute right-2 top-2 z-50 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white/40 hover:text-white">↻ Rolle</button>
      {role==="local" && <RhodusApp />}
      {role==="display" && <RhodusDuoDisplay />}
      {role==="controller" && <RhodusDuoController />}
    </div>
  );
}
