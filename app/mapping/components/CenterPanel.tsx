"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import ScopePlaceholder from './ScopePlaceholder';
import Oscilloscope from './Oscilloscope';
import { LABELS } from '../config/labels';
import { onArtifacts, onConnection } from '../services/SignalBus';
import ImpedanceView from './ImpedanceView';

export default function CenterPanel({ scaleUv = 70, recording = false, showDemoBanner = true, impedanceMode = false, activeZone = null, rawMode = false, notchHz = 0 }: { scaleUv?: number; recording?: boolean; showDemoBanner?: boolean; impedanceMode?: boolean; activeZone?: readonly [string,string] | null; rawMode?: boolean; notchHz?: number }) {
  const [banner, setBanner] = useState<boolean>(!!showDemoBanner);
  const [lastArt, setLastArt] = useState<{blink:boolean; emg:boolean; clip:boolean; pop:boolean}>({ blink:false, emg:false, clip:false, pop:false });
  const [counts, setCounts] = useState<{blink:number;emg:number;clip:number;pop:number}>({ blink:0, emg:0, clip:0, pop:0 });
  const [conn, setConn] = useState<{connected:boolean; simulation:boolean}>({ connected:false, simulation:false });
  const scopeWrapRef = useRef<HTMLDivElement|null>(null);
  const chips = useMemo(() => ([
    { key:'blink', label:'Blink', color:'bg-amber-100 text-amber-800' },
    { key:'emg', label:'EMG', color:'bg-rose-100 text-rose-800' },
    { key:'clip', label:'Clip', color:'bg-red-100 text-red-800' },
    { key:'pop', label:'Pop', color:'bg-purple-100 text-purple-800' },
  ] as const), []);
  useEffect(() => onArtifacts(a => {
    setLastArt(a);
    setCounts(prev => ({
      blink: prev.blink + (a.blink?1:0),
      emg: prev.emg + (a.emg?1:0),
      clip: prev.clip + (a.clip?1:0),
      pop: prev.pop + (a.pop?1:0),
    }));
  }), []);
  useEffect(() => onConnection(c => setConn(c)), []);
  useEffect(() => {
    if (conn.connected) setBanner(false);
  }, [conn.connected]);
  useEffect(() => {
    if (activeZone && scopeWrapRef.current) {
      try { scopeWrapRef.current.scrollIntoView({ behavior:'smooth', block:'center' }); } catch {}
    }
  }, [activeZone]);
  const segments = useMemo(() => {
    // 5 static random segments across a 100% width timeline
    const widths = [18,22,15,25,20];
    return widths.map((w,i)=>({ width:`${w}%`, key:i }));
  }, []);
  const title = recording ? 'Recording…' : (conn.connected ? 'Live' : 'Testing Connections…');
  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
        <div className="flex items-center justify-between px-1 py-2">
          <div className="text-sm font-medium text-slate-800">{title}</div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className="text-muted-foreground">Scale</span>
            <div className="rounded border px-2 py-0.5 bg-white">{scaleUv} µV</div>
          </div>
        </div>
        {banner && !conn.connected && (
          <div className="mx-1 mb-2 rounded border border-sky-300 bg-sky-50 text-sky-900 px-3 py-2 text-xs flex items-start justify-between">
            <div>No Amplifier Connected. Signals are for demonstration purposes only.</div>
            <button className="ml-3 text-sky-800 hover:text-sky-900" onClick={()=>setBanner(false)}>×</button>
          </div>
        )}
      </div>

      <div ref={scopeWrapRef} className="transition-opacity duration-200">
        {impedanceMode ? (
          <ImpedanceView labels={LABELS as unknown as string[]} />
        ) : activeZone ? (
          conn.connected ? (
            <Oscilloscope labels={LABELS as unknown as string[]} fullScaleUv={scaleUv} zone={activeZone} rawMode={rawMode} notchHz={notchHz||0} />
          ) : (
            <ScopePlaceholder mode={'test'} activeZone={activeZone} fullScaleUv={scaleUv} gridSpanUv={Math.min(scaleUv*0.9, 100)} labels={LABELS as unknown as string[]} />
          )
        ) : !conn.connected ? (
          // Idle/skeleton while not connected
          <ScopePlaceholder mode={'idle'} activeZone={null} fullScaleUv={scaleUv} gridSpanUv={Math.min(scaleUv*0.9, 100)} labels={LABELS as unknown as string[]} />
        ) : (
          // Render live oscilloscope when not in test mode
          <Oscilloscope labels={LABELS as unknown as string[]} fullScaleUv={scaleUv} rawMode={rawMode} notchHz={notchHz||0} />
        )}
      </div>

      {/* Artifact strip */}
      <div className="sticky bottom-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-t p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            {chips.map(c => (
              <span key={c.key} className={`rounded px-2 py-0.5 ${c.color}`}>{c.label} {counts[c.key as keyof typeof counts] || 0}</span>
            ))}
          </div>
          <div className="flex-1 ml-3 h-2 rounded bg-slate-100 overflow-hidden">
            <div className="flex h-full">
              {segments.map((s,i)=> (
                <div key={s.key} style={{ width: s.width }} className={`${i%2===0?'bg-sky-200':'bg-emerald-200'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


