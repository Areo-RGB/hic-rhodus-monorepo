import { DeviceRole } from "../hooks/useDeviceRole";
export default function RoleSelector({ onSelect }: { onSelect: (r: DeviceRole) => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-black p-6 text-white">
      <h1 className="text-2xl font-black uppercase tracking-tight">Rolle wählen</h1>
      <div className="grid w-full max-w-sm gap-3">
        <button onClick={() => onSelect("display")} className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-5 text-left hover:bg-purple-500/20">
          <div className="font-bold text-purple-400">Display (Tablet)</div><div className="text-xs text-white/50">Zeigt das 2×2 Gitter</div>
        </button>
        <button onClick={() => onSelect("controller")} className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-5 text-left hover:bg-blue-500/20">
          <div className="font-bold text-blue-400">Controller (Phone)</div><div className="text-xs text-white/50">Steuert das Training</div>
        </button>
        <button onClick={() => onSelect("local")} className="rounded-xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10">
          <div className="font-bold">Solo / Local</div><div className="text-xs text-white/50">Eigenständig ohne Duo</div>
        </button>
      </div>
      <p className="text-[11px] text-white/30">?role=display|controller überschreibt die Auswahl</p>
    </div>
  );
}
