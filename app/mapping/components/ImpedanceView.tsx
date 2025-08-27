"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { getImpedance } from '../services/DeviceService';
import { onBandRms } from '../services/SignalBus';
import { onSamples } from '../services/DeviceService';

type Row = { label: string; value: number; state: 'green'|'amber'|'red' };

export default function ImpedanceView({ labels }: { labels: string[] }) {
  const [mode, setMode] = useState<'impedance'|'quality'>('impedance');
  const latestBandsRef = useRef<number[][]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const fifoRef = useRef<number[][]>([]); // per-channel recent samples
  const fsRef = useRef<number>(256);
  const unsubRef = useRef<null | (()=>void)>(null);

  useEffect(() => onBandRms(r => { latestBandsRef.current = r; }), []);

  // Collect a sliding window of raw samples for Goertzel (50/60 Hz)
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = onSamples((f) => {
      const chans = f.chans || [];
      if (fifoRef.current.length < chans.length) fifoRef.current = Array.from({length: chans.length}, (_,i)=> fifoRef.current[i] || []);
      for (let i=0;i<chans.length;i++) {
        const arr = fifoRef.current[i];
        arr.push(chans[i]||0);
        if (arr.length > 1024) arr.splice(0, arr.length-1024);
      }
      // crude fs estimate by assuming called every sample; fall back to 256
      fsRef.current = 256;
    });
    return () => { try { unsubRef.current?.(); } catch {} };
  }, []);

  useEffect(() => {
    let timer: any; let mounted = true;
    async function poll() {
      try {
        const vals = await getImpedance();
        if (!mounted) return;
        const next: Row[] = labels.map((l) => {
          const v = Math.max(0, Math.round((vals[l] ?? 0)));
          const state: Row['state'] = v < 5 ? 'green' : (v <= 10 ? 'amber' : 'red');
          return { label: l, value: v, state };
        });
        setRows(next); setMode('impedance');
      } catch {
        // Fallback: line-noise ratio via Goertzel at 50/60 Hz
        function goertzel(samples:number[], freq:number, fs:number): number {
          const w = 2*Math.PI*freq/fs; const cos = Math.cos(w), sin = Math.sin(w);
          let s_prev=0, s_prev2=0;
          for (let i=0;i<samples.length;i++) {
            const s = samples[i] + 2*cos*s_prev - s_prev2;
            s_prev2 = s_prev; s_prev = s;
          }
          const real = s_prev - s_prev2 * cos;
          const imag = s_prev2 * sin;
          return Math.sqrt(real*real + imag*imag);
        }
        const fs = fsRef.current || 256;
        const next: Row[] = labels.map((l, i) => {
          const window = fifoRef.current[i] || [];
          const samp = window.length>0 ? window.slice(-512) : [];
          const line = Math.max(goertzel(samp, 50, fs), goertzel(samp, 60, fs));
          let total = 0; for (let k=0;k<samp.length;k++) total += (samp[k]||0)*(samp[k]||0);
          const rms = Math.sqrt(total/Math.max(1,samp.length));
          const ratio = line / (line + rms + 1e-6);
          const q = Math.round(100*(1 - Math.max(0, Math.min(1, ratio))));
          const state: Row['state'] = q >= 80 ? 'green' : (q >= 60 ? 'amber' : 'red');
          return { label: l, value: q, state };
        });
        if (!mounted) return;
        setRows(next); setMode('quality');
      }
      timer = setTimeout(poll, 1200);
    }
    poll();
    return () => { mounted = false; try { clearTimeout(timer); } catch {} };
  }, [labels]);

  const dot = (s: Row['state']) => s==='green' ? '#22c55e' : s==='amber' ? '#f59e0b' : '#ef4444';

  const valueHeader = mode === 'impedance' ? 'Value (kΩ)' : 'Contact Quality (%) — Line noise ratio';

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="rounded border overflow-auto" style={{ maxHeight: 480 }}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-2 font-medium">Electrode</th>
              <th className="text-left p-2 font-medium">{valueHeader}</th>
              <th className="text-left p-2 font-medium">State</th>
              <th className="text-right p-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t">
                <td className="p-2">{r.label}</td>
                <td className="p-2 tabular-nums">{r.value}</td>
                <td className="p-2"><span className="inline-flex items-center gap-1 text-xs"><span className="inline-block rounded-full" style={{ width:8, height:8, backgroundColor: dot(r.state) }} />{r.state.toUpperCase()}</span></td>
                <td className="p-2 text-right"><button className="text-xs border rounded px-2 py-1">Re-test</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Head Map</div>
          <button className="text-xs border rounded px-2 py-1" onClick={()=>{ /* trigger immediate re-poll */ const rowsNow = rows.map(r=>({ ...r })); setRows(rowsNow); }}>
            Re-test All
          </button>
        </div>
        <div className="rounded border grid place-items-center" style={{ height: 380 }}>
          <div className="text-xs text-muted-foreground">Head map placeholder with colored dots</div>
          <div className="text-[10px] text-slate-500 mt-2">Mode: {mode==='impedance'?'Impedance (kΩ)':'Quality (%)'}</div>
        </div>
      </div>
    </div>
  );
}


