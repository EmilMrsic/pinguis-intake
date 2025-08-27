"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as Dev from '../services/DeviceService';
import { CONFIG } from '../config';
import { onSamples } from '../services/DeviceService';
import { emitConnection } from '../services/SignalBus';

type Props = { notch: number; onNotchChange: (n:number)=>void; scopeUv: number; onScopeUvChange: (n:number)=>void };
export default function DevicePanel({ notch, onNotchChange, scopeUv, onScopeUvChange }: Props) {
  const [info, setInfo] = useState<{model?:string; serial?:string; sampleRate:number}|null>(null);
  const [connected, setConnected] = useState(false);
  const [scale, setScale] = useState(1);
  const [fs, setFs] = useState(CONFIG.samplingRateHz);
  const [simulating, setSimulating] = useState(false);
  const PRESETS = [10,15,20,30,40,60,70,100];
  const [suggestHz, setSuggestHz] = useState<50|60|null>(null);
  const [scanning, setScanning] = useState(false);

  function storageKey() {
    const id = info?.serial || info?.model || 'global';
    return `scope_fs_${id}`;
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey()) || localStorage.getItem('scope_fs_global');
      const fsUv = saved ? parseInt(saved, 10) : NaN;
      if (!Number.isNaN(fsUv) && fsUv > 0 && fsUv !== scopeUv) onScopeUvChange(fsUv);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.model, info?.serial]);

  async function onConnect() {
    const rv = await Dev.connect();
    setInfo(rv); setConnected(true);
    setFs(rv.sampleRate||CONFIG.samplingRateHz);
    // Auto line-noise scan (5 s)
    void runAutoNotchScan(rv.sampleRate||CONFIG.samplingRateHz);
    try { emitConnection({ connected:true, simulation:false }); } catch {}
  }
  async function onDisconnect() { await Dev.disconnect(); setConnected(false); setInfo(null); try { emitConnection({ connected:false, simulation:false }); } catch {} }
  async function onSimUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const rv = await (await import('../services/DeviceService')).startSimulationFromEDF(f);
    setInfo(rv); setConnected(true); setSimulating(true);
    try { emitConnection({ connected:true, simulation:true }); } catch {}
  }

  return (
    <div className="space-y-3">
      {suggestHz && (
        <div className="flex items-center gap-2 text-xs rounded border px-2 py-1 bg-slate-50">
          <div>Enable {suggestHz} Hz Notch?</div>
          <Button size="sm" onClick={()=>{ onNotchChange(suggestHz); setSuggestHz(null); }}>Apply</Button>
          <Button size="sm" variant="outline" onClick={()=>setSuggestHz(null)}>Dismiss</Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        {!connected ? <Button onClick={onConnect}>Connect</Button> : <Button variant="outline" onClick={onDisconnect}>Disconnect</Button>}
        {info && <span className="text-sm text-muted-foreground">{info.model} • {info.serial} • {info.sampleRate} Hz</span>}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label className="border rounded px-2 py-1 cursor-pointer">
          <input type="file" accept=".edf,.EDF" className="hidden" onChange={onSimUpload} />
          Upload EDF (Simulation)
        </label>
        {simulating && <span className="text-xs text-muted-foreground">Simulating</span>}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div>Scale</div>
        {PRESETS.map(p => (
          <Button key={p} size="sm" variant={scopeUv===p?'default':'outline'} onClick={()=>{ setScale(1); onScopeUvChange(p); try { localStorage.setItem(storageKey(), String(p)); localStorage.setItem('scope_fs_global', String(p)); } catch {} }}>
            {p} µV
          </Button>
        ))}
        <div className="ml-4">Notch</div>
        <Button size="sm" variant={notch===50?'default':'outline'} onClick={()=>onNotchChange(50)}>50 Hz</Button>
        <Button size="sm" variant={notch===60?'default':'outline'} onClick={()=>onNotchChange(60)}>60 Hz</Button>
        <div className="ml-4">Fs</div>
        <Button size="sm" variant={fs===256?'default':'outline'} onClick={()=>{ setFs(256); }}>{'256 Hz'}</Button>
      </div>
    </div>
  );
}

// --- Helpers ---
function goertzelMag(samples: number[], fs: number, f0: number): number {
  const w = 2*Math.PI*f0/fs; const cw = Math.cos(w); const sw = Math.sin(w); const coeff = 2*cw;
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i=0;i<samples.length;i++) { s0 = samples[i] + coeff*s1 - s2; s2 = s1; s1 = s0; }
  const real = s1 - s2*cw; const imag = s2*sw; const mag = Math.sqrt(real*real + imag*imag);
  // Normalize roughly by N/2 to get amplitude-like scale
  return mag / (samples.length/2);
}

async function runAutoNotchScan(fs: number) {
  // Collect up to 5 s of multi-channel samples
  try {
    (this as any).setScanning?.(true);
  } catch {}
  const seconds = 5; const targetCount = Math.max(1, Math.floor(fs*seconds));
  const buf: number[][] = [];
  let count = 0; let unsub: null | (()=>void) = null;
  try {
    await new Promise<void>((resolve) => {
      unsub = onSamples((frame) => {
        const chans = frame.chans;
        if (buf.length < chans.length) for (let i=buf.length;i<chans.length;i++) buf[i] = [];
        for (let i=0;i<chans.length;i++) buf[i].push(chans[i] || 0);
        count++;
        if (count >= targetCount) resolve();
      });
    });
  } catch {}
  try { unsub?.(); } catch {}
  // Analyze: estimate 50 and 60 vs alpha (8,10,12 averaged)
  const ratios: { f:50|60; r:number }[] = [];
  for (const f of [50,60] as const) {
    let noise = 0; let alpha = 0; let chN = 0;
    for (let ch=0; ch<buf.length; ch++) {
      const s = buf[ch] || []; if (!s.length) continue; chN++;
      noise += goertzelMag(s, fs, f);
      const a = (goertzelMag(s, fs, 8) + goertzelMag(s, fs, 10) + goertzelMag(s, fs, 12)) / 3;
      alpha += a;
    }
    noise = noise/(chN||1); alpha = alpha/(chN||1);
    const r = alpha>1e-6 ? (noise/alpha) : 1; ratios.push({ f, r });
  }
  const worst = ratios.sort((a,b)=>b.r - a.r)[0];
  const thr = Math.pow(10, -30/20); // ~0.0316
  if (worst && worst.r > thr) {
    try { (this as any).setSuggestHz?.(worst.f); } catch {}
  }
  try { (this as any).setScanning?.(false); } catch {}
}


