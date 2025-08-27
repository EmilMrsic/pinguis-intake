"use client";
import { useEffect, useState } from 'react';
import { onDiagnostics, onArtifacts } from '../services/SignalBus';

export default function DiagnosticsPane() {
  const [diag, setDiag] = useState<Record<string,string>>({});
  const [art, setArt] = useState<{blink:number;emg:number;clip:number;pop:number}>({ blink:0, emg:0, clip:0, pop:0 });
  useEffect(() => onDiagnostics(d => {
    setDiag(prev => ({ ...prev, ...(d as any) }));
  }), []);
  useEffect(() => onArtifacts(a => {
    setArt(prev => ({
      blink: prev.blink + (a.blink?1:0),
      emg: prev.emg + (a.emg?1:0),
      clip: prev.clip + (a.clip?1:0),
      pop: prev.pop + (a.pop?1:0),
    }));
  }), []);
  const items: Array<{ key: string; label: string; value?: string }> = [
    { key:'portId', label: 'Port ID' },
    { key:'baud', label: 'Baud' },
    { key:'dtr', label: 'DTR' },
    { key:'rts', label: 'RTS' },
    { key:'bytesSec', label: 'Bytes/sec' },
    { key:'chunksSec', label: 'Chunks/sec' },
    { key:'framesSec', label: 'Frames/sec' },
    { key:'fs', label: 'Measured Fs' },
    { key:'decode', label: 'Decode Mode' },
    { key:'clipPct', label: 'Clip %' },
    { key:'asciiPct', label: 'ASCII % (first 256)' },
    { key:'streamType', label: 'Stream type' },
    { key:'blink', label: 'Blink count' },
    { key:'emg', label: 'EMG count' },
    { key:'clip', label: 'Clip count' },
    { key:'pop', label: 'Pop count' },
    { key:'errors', label: 'Errors' },
  ];
  const [open, setOpen] = useState(true);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Diagnostics</div>
        <div className="flex items-center gap-2">
          <button className="text-xs border rounded px-2 py-1" onClick={()=>{
            try {
              const payload:any = { ...diag, artifacts: art };
              const s = JSON.stringify(payload, null, 2);
              navigator.clipboard?.writeText(s);
            } catch {}
          }}>Copy diagnostics</button>
          <button className="text-xs border rounded px-2 py-1" onClick={()=>setOpen(o=>!o)}>{open?'Hide':'Show'}</button>
        </div>
      </div>
      {open && (
        <div className="rounded border divide-y">
          {items.map((it) => (
            <div key={it.label} className="flex items-center justify-between px-2 py-1 text-xs">
              <div className="text-slate-600">{it.label}</div>
              <div className="font-mono text-slate-800">{(it.key in art) ? String((art as any)[it.key]) : (diag[it.key] || '—')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


