"use client";
import { useEffect, useMemo, useState } from 'react';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import DevicePanel from './components/DevicePanel';
import ImpedancePanel from './components/ImpedancePanel';
import RecordingConsole from './components/RecordingConsole';
import ReviewSave from './components/ReviewSave';
import { searchClients, getClientIntake, createSession } from './services/DataService';
import { CONFIG } from './config';

firebaseClient();

export default function MappingPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any|null>(null);
  const [intakeStatus, setIntakeStatus] = useState<{status:string; lastIntakeAt?:string}|null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUserEmail(u?.email ?? null));
    return () => { try { unsub(); } catch {} };
  }, []);

  async function doSearch() {
    const items = await searchClients(q);
    setResults(items);
  }
  async function pick(client:any) {
    setSelected(client);
    const s = await getClientIntake(client.id);
    setIntakeStatus(s);
  }
  async function startMap() {
    if (!selected) return;
    const s = await createSession(selected.id, { montage: '12_site', channels: 12, reference: 'linked_ears', bandpassHz: CONFIG.bandpassHz, notchHz: CONFIG.notchHz, samplingRateHz: CONFIG.samplingRateHz });
    setSessionId(s.id);
  }

  const gateReason = useMemo(() => {
    if (!intakeStatus) return 'Select a client';
    if (intakeStatus.status === 'Incomplete') return 'Intake incomplete';
    if (intakeStatus.status === 'Stale') return 'Intake stale';
    return null;
  }, [intakeStatus]);

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Brain Mapping</h1>
        <div className="text-sm text-muted-foreground">{userEmail ? `Signed in as ${userEmail}` : 'Not signed in'}</div>
      </div>

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

      {selected && (
        <section className="space-y-2">
          <div className="text-sm">Selected: <span className="font-medium">{selected.firstName} {selected.lastName}</span></div>
          <div className="text-sm text-muted-foreground">Intake: {intakeStatus?.status || '—'} {intakeStatus?.lastIntakeAt ? `(Last: ${new Date(intakeStatus.lastIntakeAt).toLocaleDateString()})` : ''}</div>
          <Button disabled={!!gateReason} onClick={startMap}>{gateReason || 'Start Brain Map'}</Button>
        </section>
      )}

      {sessionId && (
        <section className="grid gap-6 md:grid-cols-2">
          <DevicePanel />
          <ImpedancePanel />
          <RecordingConsole />
          <ReviewSave />
        </section>
      )}
    </main>
  );
}


