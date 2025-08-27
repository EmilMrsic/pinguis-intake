"use client";
import { useEffect, useState } from 'react';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { listSessions, createSession, detectIfPatientIdOrIntakeId } from '@/app/provider/services/SessionService';
import { topics } from '@/lib/intake/topics';
import { DEEP_ITEMS } from '@/lib/intake/deepItems';
import { CEC_ITEMS, CEC_SCALE } from '@/lib/intake/cecItems';

firebaseClient();

type Props = { params: { patientId: string } };

export default function PatientPage({ params }: Props) {
  const router = useRouter();
  const { patientId } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|undefined>();
  const [sessions, setSessions] = useState<any[]>([]);
  const [intakeItem, setIntakeItem] = useState<any|null>(null);
  const [mode, setMode] = useState<'patient'|'intake'>('patient');

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setError('Not signed in'); setLoading(false); return; }
      try {
        const info = await detectIfPatientIdOrIntakeId(patientId);
        if (info && info.kind === 'intake') {
          setMode('intake');
          // load intake detail through API (provider-secured)
          try {
            const res = await fetch(`/api/provider/intakes/${patientId}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` }});
            const data = await res.json();
            if (!res.ok || data.ok === false) throw new Error(data?.error || 'Load failed');
            setIntakeItem(data.item);
          } catch (e:any) {
            setError(e?.message || 'Failed to load intake');
          } finally {
            setLoading(false);
          }
          return;
        }
        // patient mode
        setMode('patient');
        const { items } = await listSessions(patientId);
        setSessions(items);
        setLoading(false);
      } catch (e:any) {
        setError(e?.message || 'Failed to load');
        setLoading(false);
      }
    });
    return () => { try { unsub(); } catch {} };
  }, [patientId, router]);

  async function onNewSession() {
    try {
      const s = await createSession(patientId);
      window.location.href = `/provider/patients/${patientId}/sessions/${s.id}`;
    } catch (e:any) {
      setError(e?.message || 'Create session failed');
    }
  }

  if (loading) return <main className="min-h-dvh grid place-items-center"><p>Loading…</p></main>;
  if (error && mode==='patient') return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="text-center space-y-3">
        <p className="text-red-600">{error}</p>
        <a className="underline text-sm" href={`/mapping?intakeId=${encodeURIComponent(patientId)}`}>Open Brain Mapping for this intake</a>
      </div>
    </main>
  );

  if (mode==='patient') return (
    <main className="min-h-dvh grid grid-cols-[18rem_1fr]">
      <aside className="border-r bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Sessions</div>
          <Button size="sm" onClick={onNewSession}>New</Button>
        </div>
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link key={s.id} href={`/provider/patients/${patientId}/sessions/${s.id}`} className="block sel-card rounded-xl border p-3 hover:bg-accent">
              <div className="flex items-center justify-between">
                <div className="font-medium">Session #{s.sessionNumber}</div>
                <div className="text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleDateString()}</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Intake: {s.intakeStatus} • Gap: {s.gapStatus} • Map: {s.mapStatus}</div>
            </Link>
          ))}
          {sessions.length === 0 && (
            <div className="text-sm text-muted-foreground">No sessions yet.</div>
          )}
        </div>
      </aside>
      <section className="p-6">
        <div className="rounded-2xl border sel-card p-6">
          <h1 className="text-xl font-semibold">Patient</h1>
          <p className="text-sm text-muted-foreground">Select a session on the left or create a new one.</p>
        </div>
      </section>
    </main>
  );

  // Intake view (legacy by intakeId)
  const profile = intakeItem?.payload?.profile || {};
  const payload = intakeItem?.payload || {};
  function formatMDY(dateIso?: string) {
    if (!dateIso) return '';
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'2-digit' });
  }
  function formatBirth(dateStr?: string) {
    if (!dateStr) return '';
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
    return dateStr;
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:underline" href="/provider">Patients</Link>
        <span>/</span>
        <span>{profile.first_name} {profile.last_name}</span>
      </div>
      <div className="flex items-center gap-3">
        <Link className="underline text-sm ml-auto" href={`/mapping?intakeId=${encodeURIComponent(patientId)}`}>Open Brain Mapping</Link>
      </div>
      <div className="rounded-2xl border sel-card p-6">
        <h2 className="text-lg font-semibold mb-2">Intake summary</h2>
        <dl className="divide-y divide-slate-200">
          <div className="grid grid-cols-3 gap-4 py-4">
            <dt className="text-sm font-medium text-slate-700">Name</dt>
            <dd className="col-span-2 text-sm text-slate-900">{profile.first_name} {profile.last_name}</dd>
          </div>
          <div className="grid grid-cols-3 gap-4 py-4">
            <dt className="text-sm font-medium text-slate-700">Email</dt>
            <dd className="col-span-2 text-sm text-slate-900">{profile.email || '—'}</dd>
          </div>
          <div className="grid grid-cols-3 gap-4 py-4">
            <dt className="text-sm font-medium text-slate-700">Updated</dt>
            <dd className="col-span-2 text-sm text-slate-900">{formatMDY(intakeItem?.updated_at)}</dd>
          </div>
          <div className="grid grid-cols-3 gap-4 py-4">
            <dt className="text-sm font-medium text-slate-700">Birthdate</dt>
            <dd className="col-span-2 text-sm text-slate-900">{formatBirth(profile.birthdate)}</dd>
          </div>
        </dl>
      </div>

      {/* Gap Report */}
      <div className="rounded-2xl border sel-card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Gap Report</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={async()=>{
              try {
                const u = (await import('firebase/auth')).getAuth().currentUser!;
                await fetch('/api/provider/gap-report', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${await u.getIdToken()}` }, body: JSON.stringify({ intakeId: patientId }) });
                // refresh intake
                const res = await fetch(`/api/provider/intakes/${patientId}`, { headers:{ 'Authorization': `Bearer ${await u.getIdToken()}` } });
                const data = await res.json(); if (res.ok && data?.item) setIntakeItem(data.item);
              } catch (e) { console.error(e); }
            }}>Generate</Button>
          </div>
        </div>
        {intakeItem?.gap_report?.json?.gapReport?.sections ? (
          <div className="space-y-3">
            {(intakeItem.gap_report.json.gapReport.sections as any[]).map((sec:any, si:number) => (
              <div key={si} className="rounded border">
                <div className="px-3 py-2 text-sm font-medium bg-slate-50">{sec.title}</div>
                <div className="p-3 space-y-2">
                  {(sec.questions||[]).map((q:any, qi:number) => (
                    <div key={qi} className="text-sm"><span className="font-medium">{q.text}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No gap report generated yet.</p>
        )}
      </div>

      {/* Completed fields (mirrors older intake view) */}
      <div className="rounded-2xl border sel-card p-6">
        <h2 className="text-lg font-semibold mb-2">Completed fields</h2>
        <dl className="divide-y divide-slate-200">
          {payload?.story?.reason_choice && (
            <div className="grid grid-cols-3 gap-4 py-4">
              <dt className="text-sm font-medium text-slate-700">Reason</dt>
              <dd className="col-span-2 text-sm text-slate-900 capitalize">{payload.story.reason_choice}</dd>
            </div>
          )}
          {Array.isArray(payload?.areas?.selected) && payload.areas.selected.length > 0 && (
            <div className="grid grid-cols-3 gap-4 py-4">
              <dt className="text-sm font-medium text-slate-700">Areas of concern</dt>
              <dd className="col-span-2 text-sm text-slate-900">{payload.areas.selected.map((t:string)=>topics.find(x=>x.id===t)?.label||t).join(', ')}</dd>
            </div>
          )}
          {payload?.topics?.severities && (
            <div className="grid grid-cols-3 gap-4 py-4">
              <dt className="text-sm font-medium text-slate-700">Topic severities</dt>
              <dd className="col-span-2 text-sm text-slate-900">
                {Object.entries(payload.topics.severities).map(([k,v]: any) => (
                  <span key={k} className="inline-block mr-3 mb-1">{topics.find(x=>x.id===k)?.label||k}: <span className="font-medium">{v}</span></span>
                ))}
              </dd>
            </div>
          )}
          {payload?.sleep && (
            <div className="grid grid-cols-3 gap-4 py-4">
              <dt className="text-sm font-medium text-slate-700">Sleep snapshot</dt>
              <dd className="col-span-2 text-sm text-slate-900">
                {[
                  ['bedtime','Bed time'],
                  ['wake_time','Wake time'],
                  ['sleep_latency_minutes','Sleep latency (min)'],
                  ['night_awakenings_count','Awakenings (count)'],
                  ['awake_time_at_night_minutes','Awake at night (min)'],
                  ['rested_on_waking_0to10','Rested on waking (0–10)'],
                ].map(([f,label]: any) => (
                  payload.sleep[f] != null ? <span key={String(f)} className="inline-block mr-3 mb-1">{label}: <span className="font-medium">{String(payload.sleep[f])}</span></span> : null
                ))}
              </dd>
            </div>
          )}
          {payload?.cec && (()=>{
            const cecLabelById: Record<string, { text: string; domain: string }> = (()=>{ const map: Record<string, { text: string; domain: string }> = {}; for (const it of CEC_ITEMS) map[it.id] = { text: it.text, domain: it.domain }; return map; })();
            const cecItemsSorted = Object.keys(payload?.cec || {}).sort((a,b)=>{ const da = (cecLabelById[a]?.domain || '').localeCompare(cecLabelById[b]?.domain || ''); if (da !== 0) return da; return (cecLabelById[a]?.text || a).localeCompare(cecLabelById[b]?.text || b); });
            return (
              <div className="grid grid-cols-3 gap-4 py-4">
                <dt className="text-sm font-medium text-slate-700">CEC snapshot</dt>
                <dd className="col-span-2 text-sm text-slate-900">
                  <div className="space-y-2">
                    {cecItemsSorted.map((id) => (
                      <div key={id}><span className="font-medium">{cecLabelById[id]?.text || id.replaceAll('_',' ')}</span>: {CEC_SCALE.find(s=>s.value===(payload.cec as any)[id])?.label ?? String((payload.cec as any)[id])}</div>
                    ))}
                  </div>
                </dd>
              </div>
            );
          })()}
        </dl>
      </div>
    </main>
  );
}


