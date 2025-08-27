"use client";
import { useEffect, useMemo, useState } from 'react';
import { onRxInfo } from '../services/SignalBus';

type Zone = readonly [string, string] | null;

function ActiveZoneCard({ zone }: { zone: Zone }) {
  const isActive = !!zone;
  const [a,b] = zone || ['—','—'];
  const bandText = useMemo(() => {
    if (!zone) return '—';
    const key = `${zone[0]}/${zone[1]}` as const;
    if (key==='C3/C4') return 'SMR 12–15 Hz';
    if (key==='O1/O2' || key==='P3/P4') return 'Alpha 8–12 Hz';
    if (key==='F3/F4' || key==='Fz/Cz') return 'Theta 4–7 Hz';
    if (key==='T3/T4') return 'Theta 4–7 Hz';
    return '—';
  }, [zone]);
  return (
    <div className="rounded-xl border p-3 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Active Zone</div>
        {isActive && <span className="text-[10px] rounded-full bg-sky-100 text-sky-700 px-2 py-0.5">Selected</span>}
      </div>
      <div className="text-2xl font-semibold tracking-wide">{a} <span className="text-slate-400">/</span> {b}</div>
      <div className="text-xs text-muted-foreground">{bandText}</div>
      <div className="rounded-lg border grid place-items-center" style={{ width:200, height:200 }}>
        <div className="text-xs text-muted-foreground">Brain image overlay (reserved)</div>
      </div>
    </div>
  );
}

export default function LeftPanel({ connectionGood = true, lastArtifact = '', active, onSelect, connected = false, simulation = false, recording = false }: { connectionGood?: boolean; lastArtifact?: string; active: Zone; onSelect: (z: Zone)=>void; connected?: boolean; simulation?: boolean; recording?: boolean }) {
  const [chCount, setChCount] = useState<number>(19);
  useEffect(() => onRxInfo(i => setChCount(i.channels)), []);
  return (
    <div className="space-y-4 text-sm">
      <ActiveZoneCard zone={active} />
      <ConnectionStatusBlock good={connectionGood} last={lastArtifact} />
      <ZonesList active={active} onTest={(z)=>onSelect(z)} connected={connected} simulation={simulation} recording={recording} chCount={chCount} />
    </div>
  );
}

function ZonesList({ active, onTest, connected, simulation, recording, chCount }: { active: Zone; onTest: (z: Zone) => void; connected:boolean; simulation:boolean; recording:boolean; chCount:number }) {
  const rows: { label: readonly [string,string]; band: string }[] = [
    { label:['Fz','Cz'] as const, band:'Theta 4–7' },
    { label:['F3','F4'] as const, band:'Alpha 8–12' },
    { label:['C3','C4'] as const, band:'SMR 12–15' },
    { label:['P3','P4'] as const, band:'Alpha 8–12' },
    { label:['T3','T4'] as const, band:'Beta 13–30' },
    { label:['O1','O2'] as const, band:'Alpha 8–12' },
  ];
  const allowed = (label: readonly [string,string]) => {
    const idx = (name:string) => {
      const order = ['Fp1','Fp2','F7','F3','Fz','F4','F8','T3','C3','Cz','C4','T4','T5','P3','Pz','P4','T6','O1','O2'];
      return order.indexOf(name);
    };
    return idx(label[0]) < chCount && idx(label[1]) < chCount;
  };
  const isActive = (z: readonly [string,string]) => active && active[0]===z[0] && active[1]===z[1];
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Zones</div>
      {rows.filter(r=>allowed(r.label)).map((r) => {
        const activeRow = isActive(r.label);
        const label = simulation ? (activeRow ? 'Viewing' : 'View') : (recording ? (activeRow ? 'Viewing' : 'View') : (activeRow ? 'Testing' : 'Test'));
        return (
          <div key={r.label.join('/')} className={`flex items-center justify-between rounded border p-2 ${activeRow?'border-sky-400 bg-sky-50':'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <div className="font-medium">{r.label[0]}/{r.label[1]}</div>
              <span className="text-[10px] rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">{r.band}</span>
            </div>
            <button
              className={`rounded px-2 py-1 text-xs ${activeRow ? 'bg-slate-900 text-white' : 'border'}`}
              aria-pressed={activeRow}
              onClick={()=>onTest(r.label)}
            >
              {label}
            </button>
          </div>
        );
      })}
      <div className="text-[10px] text-slate-500">{chCount}ch device</div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block rounded-full" style={{ width:8, height:8, backgroundColor: color }} />;
}

function ConnectionStatusBlock({ good, last }: { good:boolean; last?: string }) {
  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="flex items-center gap-2">
        <Dot color={good ? '#22c55e' : '#f59e0b'} />
        <div className="text-sm font-medium">{good ? 'Connections Good' : 'Needs Attention'}</div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-700">
        <Dot color="#64748b" />
        <div>Artifact Detected: <span className="font-medium">{last || 'None'}</span></div>
      </div>
    </div>
  );
}


