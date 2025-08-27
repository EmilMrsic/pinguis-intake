"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
// import { useRouter } from 'next/navigation';
import DevicePanel from './components/DevicePanel';
import ImpedancePanel from './components/ImpedancePanel';
import RecordingConsole from './components/RecordingConsole';
import Oscilloscope from './components/Oscilloscope';
import RecordMap from './components/RecordMap';
import ReviewSave from './components/ReviewSave';
import { searchClients, getClientIntake, getClientById, getClientFromIntake } from './services/DataService';
import { CONFIG } from './config';
import { LABELS } from './config/labels';
import { ZONES } from './config/labels';
import SessionLogPanel from './components/SessionLogPanel';
import { onConnection } from './services/SignalBus';
import TopBar from './components/TopBar';
import EEGAppShell from './components/EEGAppShell';
import LeftPanel from './components/LeftPanel';
import CenterPanel from './components/CenterPanel';
import SessionDrawer from './components/SessionDrawer';
import DiagnosticsPane from './components/DiagnosticsPane';

firebaseClient();

export default function MappingPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any|null>(null);
  const [intakeStatus, setIntakeStatus] = useState<{status:string; lastIntakeAt?:string}|null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scopeUv, setScopeUv] = useState<number>(70);
  const [notchHz, setNotchHz] = useState<number>(CONFIG.notchHz);
  const [zone, setZone] = useState<null | readonly [string,string]>(null);
  const [frontalAlt, setFrontalAlt] = useState(false); // F bands toggle
  const [impedanceMode, setImpedanceMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [notchMode, setNotchMode] = useState<'off'|50|60|'auto'>('off');
  const [rawMode, setRawMode] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [activeZone, setActiveZone] = useState<readonly [string,string] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conn, setConn] = useState<{ connected:boolean; simulation:boolean }>({ connected:false, simulation:false });
  const [diagOpen, setDiagOpen] = useState(false);
  const autoRawDoneRef = useRef<boolean>(false);
  const autoRawTimerRef = useRef<any>(null);
  const prevScaleRef = useRef<number>(scopeUv);
  const prevNotchRef = useRef<'off'|50|60|'auto'>(notchMode);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUserEmail(u?.email ?? null));
    return () => { try { unsub(); } catch {} };
  }, []);

  // Keyboard shortcuts: [ ] for scale, 1..6 zones, Space for Record
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '[') {
        e.preventDefault();
        const presets = [10,15,20,30,40,60,70,100];
        const i = presets.findIndex(v=>v===scopeUv);
        const next = presets[Math.max(0, i-1)] ?? scopeUv;
        setScopeUv(next);
      } else if (e.key === ']') {
        e.preventDefault();
        const presets = [10,15,20,30,40,60,70,100];
        const i = presets.findIndex(v=>v===scopeUv);
        const next = presets[Math.min(presets.length-1, i+1)] ?? scopeUv;
        setScopeUv(next);
      } else if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const zones: readonly [string,string][] = [
          ['Fz','Cz'], ['F3','F4'], ['C3','C4'], ['P3','P4'], ['T3','T4'], ['O1','O2']
        ];
        const idx = Number(e.key)-1;
        setActiveZone(zones[idx] || null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setActiveZone(null);
      } else if (e.code === 'Space') {
        e.preventDefault();
        setRecording(r => !r);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scopeUv]);

  // Preselect client when deep-linked via intakeId or clientId and start local session
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const clientId = url.searchParams.get('clientId');
        const intakeId = url.searchParams.get('intakeId');
        if (intakeId) {
          const picked = await getClientFromIntake(intakeId);
          if (picked) {
            setSelected(picked);
            setSessionId('local');
            try { const s = await getClientIntake(picked.id); setIntakeStatus(s); } catch {}
            return;
          }
        }
        if (clientId) {
          let found = await getClientById(clientId);
          if (!found) {
            const res = await searchClients("");
            found = res.find((r:any) => r.id === clientId) || null;
          }
          const picked = found || { id: clientId, firstName: '', lastName: '' };
          setSelected(picked);
          setSessionId('local');
          try { const s = await getClientIntake(picked.id); setIntakeStatus(s); } catch {}
        }
      } catch {}
    })();
  }, []);

  // Track connection state for UI logic (e.g., Zones button label)
  useEffect(() => {
    const off = onConnection(c => setConn(c));
    return () => { try { off(); } catch {} };
  }, []);

  // Auto-enable RAW for 5s on first live connect, then revert
  useEffect(() => {
    if (conn.connected && !conn.simulation && !autoRawDoneRef.current) {
      autoRawDoneRef.current = true;
      prevScaleRef.current = scopeUv;
      prevNotchRef.current = notchMode;
      setRawMode(true);
      setScopeUv(500);
      setNotchMode('off');
      try { clearTimeout(autoRawTimerRef.current); } catch {}
      autoRawTimerRef.current = setTimeout(() => {
        setRawMode(false);
        setScopeUv(prevScaleRef.current);
        setNotchMode(prevNotchRef.current);
      }, 5000);
    }
    return () => { try { clearTimeout(autoRawTimerRef.current); } catch {} };
  }, [conn.connected]);

  async function doSearch() {
    try {
      const items = await searchClients(q);
      setResults(items);
    } catch { setResults([]); }
  }
  async function pick(client:any) {
    setSelected(client);
    const s = await getClientIntake(client.id);
    setIntakeStatus(s);
  }
  async function startMap() {
    if (!selected) return;
    // Start local session immediately; persistence will be handled server-side later
    setSessionId('local');
  }

  const gateReason = useMemo(() => {
    // Gate removed per request: allow immediate start when a client is selected
    if (!selected) return 'Select a client';
    return null;
  }, [selected]);

  return (
    <main className="p-0">
      <EEGAppShell
        top={<TopBar
          scopeUv={scopeUv}
          onScopeUvChange={setScopeUv}
          notch={notchMode}
          onNotchChange={(v)=>{ setNotchMode(v); if (v===50||v===60) setNotchHz(v); if (v==='off') setNotchHz(CONFIG.notchHz); }}
          raw={rawMode}
          onRawChange={(v)=>{ setRawMode(v); import('./services/DeviceService').then(m=>m.setRawMode(v)); if (v) { setScopeUv(500); setNotchMode('off'); setNotchHz(CONFIG.notchHz); } }}
          impedance={impedanceMode}
          onImpedanceChange={setImpedanceMode}
          recording={recording}
          onToggleRecord={()=>{ setRecording(r=>{ const next=!r; if (r && !next) setDrawerOpen(true); return next; }); }}
        />}
        left={<LeftPanel active={activeZone} onSelect={setActiveZone} connectionGood={true} lastArtifact={''} connected={conn.connected} simulation={conn.simulation} recording={recording} />}
        center={<>
          <div className="flex items-center justify-end mb-2">
            <button className="text-xs border rounded px-2 py-1" onClick={()=>setDiagOpen(o=>!o)}>{diagOpen?'Hide':'Show'} Diagnostics</button>
          </div>
          <CenterPanel scaleUv={scopeUv} recording={recording} impedanceMode={impedanceMode} showDemoBanner={showInfoBanner} activeZone={activeZone} rawMode={rawMode} notchHz={notchHz} />
        </>}
        right={diagOpen ? <DiagnosticsPane /> : undefined}
      />
      <SessionDrawer
        open={drawerOpen}
        onClose={()=>{ setDrawerOpen(false); setRecording(false); setActiveZone(null); }}
        summary={{ durationSec: 125, channels: 19, scaleUv: scopeUv, notch: String(notchMode) }}
      />

      {!selected && (
        <section className="space-y-3">
          <div className="flex gap-2">
            <input className="border rounded px-2 py-1 text-sm" placeholder="Search clients…" value={q} onChange={e=>setQ(e.target.value)} />
            <Button size="sm" onClick={doSearch}>Search</Button>
          </div>
          <div className="grid gap-2">
            {results.map(r => (
              <button key={r.id} className={`text-left rounded border px-3 py-2 ${selected?.id===r.id?'bg-slate-50':''}`} onClick={()=>pick(r)}>
                <div className="text-sm font-medium">{r.firstName} {r.lastName}</div>
                {r.dob && <div className="text-xs text-muted-foreground">DOB: {r.dob}</div>}
              </button>
            ))}
            {results.length===0 && <div className="text-sm text-muted-foreground">No results</div>}
          </div>
        </section>
      )}

      {selected && (
        <section className="space-y-2">
          <div className="text-sm">Selected: <span className="font-medium">{selected.firstName} {selected.lastName}</span></div>
          <div className="text-sm text-muted-foreground">Intake: {intakeStatus?.status || '—'} {intakeStatus?.lastIntakeAt ? `(Last: ${new Date(intakeStatus.lastIntakeAt).toLocaleDateString()})` : ''}</div>
          <div className="flex items-center gap-2">
            <Button disabled={!!gateReason} onClick={startMap}>{gateReason || 'Start Brain Map'}</Button>
          </div>
        </section>
      )}

      {sessionId && (
        <section className="grid gap-6" style={{ gridTemplateColumns: '3fr 1fr' }}>
          <div className="space-y-3">
            <DevicePanel notch={notchHz} onNotchChange={setNotchHz} scopeUv={scopeUv} onScopeUvChange={setScopeUv} />
            <div className="flex items-center gap-2 text-sm">
              <div>Zones</div>
              <Button size="sm" variant={!zone?'default':'outline'} onClick={()=>setZone(null)}>All</Button>
              {Object.entries(ZONES).map(([k, pair]) => (
                <Button key={k} size="sm" variant={zone && zone[0]===pair[0] && zone[1]===pair[1] ? 'default':'outline'} onClick={()=>setZone(pair)}>{k}</Button>
              ))}
              <div className="ml-4">Frontal target</div>
              <Button size="sm" variant={!frontalAlt?'default':'outline'} onClick={()=>setFrontalAlt(false)}>4–7 Hz</Button>
              <Button size="sm" variant={frontalAlt?'default':'outline'} onClick={()=>setFrontalAlt(true)}>15–20 Hz</Button>
              <div className="ml-4">Impedance</div>
              {/* Toggle via query param or future state; for now left as UI hint */}
            </div>
            <Oscilloscope labels={LABELS as unknown as string[]} fullScaleUv={scopeUv} impedanceMode={impedanceMode} zone={zone} targetBand={(() => {
              if (!zone) return null;
              const key = Object.entries(ZONES).find(([,p])=>p[0]===zone[0] && p[1]===zone[1])?.[0] || '';
              if (key==='C3/C4') return [12,15];
              if (key==='O1/O2' || key==='P3/P4') return [8,12];
              if (key==='F3/F4' || key==='Fz/Cz') return frontalAlt ? [15,20] : [4,7];
              if (key==='T3/T4') return [4,7];
              return null;
            })()} />
            <RecordingConsole notchHz={notchHz} />
            <div className="mt-2">
              <RecordMap activeZone={zone} />
            </div>
          </div>
          <div className="space-y-3">
            <ImpedancePanel />
            <ReviewSave />
            <SessionLogPanel />
          </div>
        </section>
      )}
    </main>
  );
}


