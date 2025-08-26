"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getImpedance } from '../services/DeviceService';

function colorFor(k: number) { if (k<=10) return 'bg-emerald-500'; if (k<=20) return 'bg-amber-500'; return 'bg-red-500'; }

export default function ImpedancePanel() {
  const [vals, setVals] = useState<Record<string, number>>({});
  const [overrides, setOverrides] = useState<Record<string,string>>({});

  async function refresh() { setVals(await getImpedance()); }
  useEffect(()=>{ void refresh(); },[]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Impedance (kΩ)</div>
        <Button size="sm" variant="outline" onClick={refresh}>Refresh</Button>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {Object.entries(vals).map(([ch,v]) => (
          <div key={ch} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${colorFor(v)}`} />
            <div className="text-sm w-10">{ch}</div>
            <div className="text-sm tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">Override reason (optional):</div>
      <textarea className="w-full border rounded p-2 text-sm" rows={2} placeholder="Reason for override…" onChange={e=>setOverrides({ ...overrides, all: e.target.value })} />
    </div>
  );
}


