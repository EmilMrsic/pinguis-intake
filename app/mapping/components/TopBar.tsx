"use client";
import { useEffect, useRef, useState } from 'react';
import { onArtifacts, onConnection, onRecording, onBaselineSec, emitConnection } from '../services/SignalBus';
import * as Dev from '../services/DeviceService';
import { emitDiagnostics } from '../services/SignalBus';

type Props = {
  scopeUv?: number;
  onScopeUvChange?: (v:number)=>void;
  notch?: 'off'|50|60|'auto';
  onNotchChange?: (v:'off'|50|60|'auto')=>void;
  raw?: boolean;
  onRawChange?: (v:boolean)=>void;
  impedance?: boolean;
  onImpedanceChange?: (v:boolean)=>void;
  recording?: boolean;
  onToggleRecord?: ()=>void;
};

const SCALE_PRESETS = [10,15,20,30,40,60,70,100];

export default function TopBar({ scopeUv=70, onScopeUvChange, notch='off', onNotchChange, raw=false, onRawChange, impedance=false, onImpedanceChange, recording=false, onToggleRecord }: Props) {
  const [status, setStatus] = useState<'connected'|'simulation'|'disconnected'>('disconnected');
  const [art, setArt] = useState<{blink:boolean; emg:boolean; clip:boolean; pop:boolean}>({ blink:false, emg:false, clip:false, pop:false });
  const [artCount, setArtCount] = useState<{blink:number; emg:number; clip:number; pop:number}>({ blink:0, emg:0, clip:0, pop:0 });
  const [baseline, setBaseline] = useState(0);
  const [scale, setScale] = useState(scopeUv);
  const [notchMode, setNotchMode] = useState<'off'|50|60|'auto'>(notch);
  const [imp, setImp] = useState<boolean>(impedance);
  const [rawMode, setRawModeLocal] = useState<boolean>(raw);
  const [rec, setRec] = useState<boolean>(recording);
  const [simName, setSimName] = useState<string>('');
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [testRows, setTestRows] = useState<Array<{ label:string; id:string; bytesPerSec:number; baudUsed:number|null; idx:number; isBest:boolean }>>([]);

  useEffect(() => onConnection(c => setStatus(c.simulation ? 'simulation' : (c.connected ? 'connected' : 'disconnected'))), []);
  useEffect(() => onArtifacts(a => { setArt(a); setArtCount(prev=>({
    blink: prev.blink + (a.blink?1:0),
    emg: prev.emg + (a.emg?1:0),
    clip: prev.clip + (a.clip?1:0),
    pop: prev.pop + (a.pop?1:0),
  })); }), []);
  useEffect(() => onBaselineSec(s => setBaseline(s)), []);
  useEffect(() => onRecording(r => { setRec(r); }), []);
  useEffect(() => { setScale(scopeUv); }, [scopeUv]);
  useEffect(() => { setNotchMode(notch); }, [notch]);
  useEffect(() => { setImp(impedance); }, [impedance]);

  const pill = status==='connected' ? (selectedLabel ? `Connected — ${selectedLabel}` : 'Connected') : status==='simulation' ? 'Simulation' : 'No Amplifier';
  const pillClass = status==='connected' ? 'bg-emerald-600' : status==='simulation' ? 'bg-sky-600' : 'bg-slate-600';
  const [menuOpen, setMenuOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement|null>(null);
  const menuRef = useRef<HTMLDivElement|null>(null);

  useEffect(() => { setSelectedLabel(selectedLabel); }, [selectedLabel]);

  async function handleConnect() {
    try {
      const serial = (navigator as any)?.serial;
      const port = await serial?.requestPort?.();
      if (!port) return;
      await Dev.connectWithPort(port);
      setStatus('connected');
      emitConnection({ connected:true, simulation:false });
      try {
        const info = port.getInfo?.()||{}; const label = buildPortLabel(port);
        setSelectedLabel(label);
        emitDiagnostics({ portId: `${info.usbVendorId||''}:${info.usbProductId||''}` });
      } catch {}
    } catch {}
    setMenuOpen(false);
  }
  async function handleDisconnect() {
    try { await Dev.disconnect(); setStatus('disconnected'); emitConnection({ connected:false, simulation:false }); } catch {}
    setMenuOpen(false);
  }
  async function handleUploadSim(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    try { await (await import('../services/DeviceService')).startSimulationFromEDF(f); setStatus('simulation'); setSimName(f.name); emitConnection({ connected:true, simulation:true }); } catch {}
    setMenuOpen(false);
    try { (e.target as HTMLInputElement).value = ''; } catch {}
  }

  // Close on outside mousedown; keep open when interacting inside
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!menuOpen) return;
      const el = menuRef.current; if (!el) return;
      if (!el.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [menuOpen]);

  return (
    <div className="flex items-center justify-between gap-4 py-2 whitespace-nowrap">
      {/* Left: breadcrumb + mode pill */}
      <div className="flex items-center gap-3 min-w-0 relative">
        <div className="text-sm text-slate-700 font-medium">Brain Map ▸ Testing</div>
        <button className={`text-xs text-white rounded-full px-2 py-1 ${pillClass}`} onClick={()=>setMenuOpen(o=>!o)}>{pill} ▾</button>
        {menuOpen && (
          <div ref={menuRef} className="absolute left-0 top-full mt-1 z-50 w-72 rounded-md border bg-white shadow-lg p-1 text-sm backdrop-blur-0" onMouseDown={(e)=>e.stopPropagation()}>
            <button className="block w-full text-left px-2 py-1 rounded hover:bg-slate-50" onClick={async()=>{
              try {
                const serial = (navigator as any)?.serial; if (!serial) return;
                // get granted ports and pick best automatically
                const granted = await serial.getPorts?.() || [];
                let port = null as any;
                if (granted.length >= 1) {
                  const chosen = await Dev.choosePort(granted);
                  if (chosen.port && chosen.result && chosen.result.bytesPerSec > 0) {
                    port = chosen.port;
                    try { console.log('[Serial] Auto-selected granted port bytes/sec:', chosen.result.bytesPerSec, 'baud', chosen.result.baudUsed); } catch {}
                  }
                }
                if (!port) {
                  port = await serial.requestPort?.();
                  if (!port) return;
                }
                try { const info = port.getInfo?.()||{}; const label = buildPortLabel(port); console.log('[Serial] Chooser/auto selected:', label, info); setSelectedLabel(label); } catch {}
                await Dev.connectWithPort(port);
                setStatus('connected');
                emitConnection({ connected:true, simulation:false });
                try { const info = port.getInfo?.()||{}; const id = `${info.usbVendorId||''}:${info.usbProductId||''}`; const label = buildPortLabel(port); emitDiagnostics({ portId: id }); console.log('[Serial] Connected to:', label, id); } catch {}
              } catch (e:any) {
                console.error('[Serial] Connect failed:', e);
                const msg = String(e?.message||e||'');
                if (/already open|invalid state|busy/i.test(msg)) {
                  try { emitDiagnostics({ errors: 'E_BUSY: Port in use by another app (close Synapse/Terminal).' }); } catch {}
                } else {
                  try { emitDiagnostics({ errors: msg }); } catch {}
                }
              }
              setMenuOpen(false);
            }}>Connect (WebSerial)</button>
            <button className="block w-full text-left px-2 py-1 rounded hover:bg-slate-50" onClick={async()=>{
              try {
                setTesting(true); setTestRows([]);
                const serial = (navigator as any)?.serial; if (!serial) return;
                const ports = await serial.getPorts?.() || [];
                const rows: Array<{ label:string; id:string; bytesPerSec:number; baudUsed:number|null; idx:number; isBest:boolean }> = [];
                let bestIdx = -1; let bestBps = -1;
                for (let i=0;i<ports.length;i++) {
                  const p = ports[i];
                  const res = await Dev.probePort(p);
                  const info = p.getInfo?.()||{}; const id = `${info.usbVendorId||''}:${info.usbProductId||''}`;
                  const label = buildPortLabel(p) + ` #${i+1}`;
                  rows.push({ label, id, bytesPerSec: res.bytesPerSec, baudUsed: res.baudUsed, idx:i, isBest:false });
                  if (res.bytesPerSec > bestBps) { bestBps = res.bytesPerSec; bestIdx = i; }
                }
                if (bestIdx>=0 && bestBps>0) rows[bestIdx].isBest = true;
                setTestRows(rows);
              } catch (e) {
                console.error('[Serial] Test Ports failed', e);
              } finally {
                setTesting(false);
              }
            }}>Test Ports</button>
            <button className="block w-full text-left px-2 py-1 rounded hover:bg-slate-50" onClick={()=>uploadRef.current?.click()}>Simulation: Upload EDF…</button>
            <button className="block w-full text-left px-2 py-1 rounded hover:bg-slate-50" onClick={handleDisconnect}>Disconnect</button>
            <button className="block w-full text-left px-2 py-1 rounded hover:bg-slate-50" onClick={async()=>{
              try {
                const serial = (navigator as any)?.serial; const list = await serial?.getPorts?.();
                let forgot = false; for (const p of (list||[])) { if (p.forget) { try { await p.forget(); forgot = true; } catch {} } }
                if (!forgot) alert('To forget: Chrome Settings → Site Settings → Serial ports → Clear permissions.');
                setSelectedLabel('');
              } catch {}
              setMenuOpen(false);
            }}>Forget permissions</button>
            <input ref={uploadRef} type="file" accept=".edf,.EDF" className="hidden" onChange={handleUploadSim} />

            {(testing || testRows.length>0) && (
              <div className="mt-1 border-t pt-1">
                <div className="px-2 py-1 text-[11px] text-slate-600">Port probe results</div>
                {testing && <div className="px-2 py-1 text-xs text-slate-700">Testing…</div>}
                {!testing && testRows.length>0 && (
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-2 py-1">Port</th>
                          <th className="text-left px-2 py-1">VID:PID</th>
                          <th className="text-right px-2 py-1">Baud</th>
                          <th className="text-right px-2 py-1">Bytes/sec (2.5s)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {testRows.map((r, i) => (
                          <tr key={i} className={`border-t ${r.isBest?'bg-emerald-50':''}`}>
                            <td className="px-2 py-1">{r.label}</td>
                            <td className="px-2 py-1">{r.id || '—'}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{r.baudUsed || '—'}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{r.bytesPerSec}</td>
                            <td className="px-2 py-1 text-right">
                              {r.isBest && r.bytesPerSec>0 ? (
                                <button className="text-xs border rounded px-2 py-0.5" onClick={async()=>{
                                  try {
                                    const serial = (navigator as any)?.serial; if (!serial) return;
                                    const ports = await serial.getPorts?.() || [];
                                    const port = ports[r.idx]; if (!port) return;
                                    await Dev.connectWithPort(port);
                                    setStatus('connected');
                                    emitConnection({ connected:true, simulation:false });
                                    try { const info = port.getInfo?.()||{}; const id = `${info.usbVendorId||''}:${info.usbProductId||''}`; const label = buildPortLabel(port); setSelectedLabel(label); emitDiagnostics({ portId: id }); } catch {}
                                    setMenuOpen(false);
                                  } catch (e) { console.error(e); }
                                }}>Use this</button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {testRows.every(r=>r.bytesPerSec===0) && (
                      <div className="px-2 py-1 text-xs text-rose-600">No bytes on either port.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center: baseline ring + artifact chips with counters */}
      <div className="flex items-center gap-3 mx-auto">
        <div className="relative h-6 w-6">
          <svg viewBox="0 0 36 36" className="h-6 w-6">
            <path d="M18 2 a 16 16 0 1 1 0 32 a 16 16 0 1 1 0 -32" fill="none" stroke="#e5e7eb" strokeWidth="4" />
            <path d="M18 2 a 16 16 0 1 1 0 32 a 16 16 0 1 1 0 -32" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray={`${Math.min(100, baseline/30*100)} 100`} />
          </svg>
        </div>
        {status==='simulation' && simName && (
          <div className="text-xs text-slate-600 truncate max-w-[220px]">Simulating: {simName}</div>
        )}
        {!!selectedLabel && (
          <div className="text-[11px] text-slate-600 truncate max-w-[260px]">Selected: {selectedLabel}</div>
        )}
        <div className="flex items-center gap-1 text-xs">
          <span className={`rounded px-1.5 py-0.5 ${art.blink?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-600'}`}>Blink {artCount.blink||0}</span>
          <span className={`rounded px-1.5 py-0.5 ${art.emg?'bg-rose-100 text-rose-800':'bg-slate-100 text-slate-600'}`}>EMG {artCount.emg||0}</span>
          <span className={`rounded px-1.5 py-0.5 ${art.clip?'bg-red-100 text-red-800':'bg-slate-100 text-slate-600'}`}>Clip {artCount.clip||0}</span>
          <span className={`rounded px-1.5 py-0.5 ${art.pop?'bg-purple-100 text-purple-800':'bg-slate-100 text-slate-600'}`}>Pop {artCount.pop||0}</span>
        </div>
      </div>
      {/* Right: controls row */}
      <div className="flex items-center gap-3 text-sm">
        {/* Scale controls */}
        <div className="flex items-center gap-1">
          <button className="border rounded px-2 py-1" onClick={()=>{ const next = SCALE_PRESETS[Math.max(0, SCALE_PRESETS.findIndex(v=>v===scale)-1)] ?? scale; setScale(next); onScopeUvChange?.(next); }}>−</button>
          <select className="border rounded px-2 py-1" value={scale} onChange={e=>{ const v=Number(e.target.value); setScale(v); onScopeUvChange?.(v); }}>
            {SCALE_PRESETS.map(v=> <option key={v} value={v}>{v} µV</option>)}
          </select>
          <button className="border rounded px-2 py-1" onClick={()=>{ const next = SCALE_PRESETS[Math.min(SCALE_PRESETS.length-1, SCALE_PRESETS.findIndex(v=>v===scale)+1)] ?? scale; setScale(next); onScopeUvChange?.(next); }}>+</button>
        </div>
        {/* Notch */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Notch</span>
          <select className="border rounded px-2 py-1" value={String(notchMode)} onChange={e=>{ const v=(e.target.value as any); setNotchMode(v); onNotchChange?.(v); }}>
            <option value="off">Off</option>
            <option value="auto">Auto</option>
            <option value="50">50</option>
            <option value="60">60</option>
          </select>
        </div>
        {/* RAW toggle */}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={rawMode} onChange={e=>{ setRawModeLocal(e.target.checked); onRawChange?.(e.target.checked); }} /> RAW (±500 µV)
        </label>
        {/* Impedance */}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={imp} onChange={e=>{ setImp(e.target.checked); onImpedanceChange?.(e.target.checked); }} /> Impedance Check
        </label>
        {/* Record / Stop */}
        <button className={`rounded px-3 py-1 text-white ${rec?'bg-red-600':'bg-slate-900'}`} onClick={()=>{ const n=!rec; setRec(n); onToggleRecord?.(); }}>{rec?'Stop Map':'Record'}</button>
      </div>
    </div>
  );
}

function buildPortLabel(port:any): string {
  try {
    const info = port?.getInfo?.() || {};
    const vid = info.usbVendorId != null ? info.usbVendorId.toString(16) : '';
    const pid = info.usbProductId != null ? info.usbProductId.toString(16) : '';
    if (vid || pid) return `USB ${vid}:${pid}`;
  } catch {}
  return 'Port';
}


