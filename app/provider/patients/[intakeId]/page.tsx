"use client";
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseClient } from '@/lib/firebaseClient';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { topics } from '@/lib/intake/topics';
import { DEEP_ITEMS } from '@/lib/intake/deepItems';
import { CEC_ITEMS, CEC_SCALE } from '@/lib/intake/cecItems';
import { Button } from '@/components/ui/button';
import { GapReportButton } from './GapReport';
import { GapReportForm } from './GapReportForm';
 

firebaseClient();

export default function PatientDetailPage({ params }: { params: { intakeId: string } }) {
  const { intakeId } = params;
  const [item, setItem] = useState<any>(null);
  const [tab, setTab] = useState<'intake'|'map'>('intake');
  const [error, setError] = useState<string|undefined>();
  const [cecEditing, setCecEditing] = useState<boolean>(false);
  const [cecDraft, setCecDraft] = useState<Record<string, number>>({});

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setError('Not signed in'); return; }
      try {
        const res = await fetch(`/api/provider/intakes/${intakeId}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
        const data = await res.json();
        if (!res.ok || data.ok === false) throw new Error(data?.error || 'Load failed');
        setItem(data.item);
        try { setCecDraft({ ...(data.item?.payload?.cec || {}) }); } catch {}
      } catch (e:any) { setError(e?.message || 'Load failed'); }
    });
    return () => { try { unsub(); } catch {} };
  }, [intakeId]);

  if (error) return <main className="p-6"><p className="text-red-600">{error}</p></main>;
  if (!item) return <main className="p-6"><p>Loading…</p></main>;

  const profile = item?.payload?.profile || {};
  const payload = item?.payload || {};
  function formatMDY(dateIso?: string) {
    if (!dateIso) return '';
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'2-digit' });
  }
  function formatBirth(dateStr?: string) {
    if (!dateStr) return '';
    // Avoid timezone shifts: format YYYY-MM-DD as MM/DD/YYYY without Date parsing
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
    return dateStr;
  }
  const cecLabelById: Record<string, { text: string; domain: string }> = (()=>{
    const map: Record<string, { text: string; domain: string }> = {};
    for (const it of CEC_ITEMS) map[it.id] = { text: it.text, domain: it.domain };
    return map;
  })();
  const cecItemsSorted = Object.keys(payload?.cec || {}).sort((a,b)=>{
    const da = (cecLabelById[a]?.domain || '').localeCompare(cecLabelById[b]?.domain || '');
    if (da !== 0) return da;
    return (cecLabelById[a]?.text || a).localeCompare(cecLabelById[b]?.text || b);
  });
  async function saveCec() {
    try {
      const auth = getAuth();
      const u = auth.currentUser!;
      const res = await fetch('/api/intake-save', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          practiceId: item.practice_id,
          clientId: item.client_id,
          intakeId: item.intake_id,
          payload: { ...payload, cec: cecDraft },
        })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Save failed');
      setItem((prev: any) => ({ ...prev, payload: { ...prev.payload, cec: cecDraft }, updated_at: data.updated_at || new Date().toISOString() }));
      setCecEditing(false);
    } catch (e:any) { setError(e?.message || 'Save failed'); }
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:underline" href="/provider">Patients</Link>
        <span>/</span>
        <span>{profile.first_name} {profile.last_name}</span>
      </div>

      <div className="flex items-center gap-3">
        <button className={`rounded px-3 py-1.5 text-sm ${tab==='intake'?'bg-slate-900 text-white':'bg-slate-100'}`} onClick={()=>setTab('intake')}>Intake</button>
        <button className={`rounded px-3 py-1.5 text-sm ${tab==='map'?'bg-slate-900 text-white':'bg-slate-100'}`} onClick={()=>setTab('map')}>Map</button>
        {item?.complete && <>
          <button className={`rounded px-3 py-1.5 text-sm ${tab==='gap'?'bg-slate-900 text-white':'bg-slate-100'}`} onClick={()=>setTab('gap' as any)}>Gap</button>
          <GapReportButton intakeId={item.intake_id} onDone={()=>setTab('gap' as any)} />
        </>}
      </div>

      {tab==='intake' && (
        <Card>
          <CardHeader>
            <CardTitle>Intake summary</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Styled like Tailwind description list (left-aligned in card) */}
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
                <dd className="col-span-2 text-sm text-slate-900">{formatMDY(item.updated_at)}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 py-4">
                <dt className="text-sm font-medium text-slate-700">Intake status</dt>
                <dd className="col-span-2 text-sm text-slate-900">{item.complete ? 'Complete' : 'In progress'}</dd>
              </div>
              <div className="grid grid-cols-3 gap-4 py-4">
                <dt className="text-sm font-medium text-slate-700">Map status</dt>
                <dd className="col-span-2 text-sm text-slate-900">{item.map_complete ? 'Complete' : 'Not complete'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {tab==='map' && (
        <Card>
          <CardHeader>
            <CardTitle>Map (coming soon)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">We’ll display mapping progress and outputs here.</p>
          </CardContent>
        </Card>
      )}

      {tab as any === 'gap' && item?.gap_report?.json?.gapReport?.sections && (
        <GapReportForm intakeId={item.intake_id} initial={{ sections: item.gap_report.json.gapReport.sections, answers: item.gap_report.answers }} />
      )}

      {tab==='intake' && (
        <Card>
          <CardHeader>
            <CardTitle>Completed fields</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-slate-200">
              {/* Story / Reason */}
              {payload?.story?.reason_choice && (
                <div className="grid grid-cols-3 gap-4 py-4">
                  <dt className="text-sm font-medium text-slate-700">Reason</dt>
                  <dd className="col-span-2 text-sm text-slate-900 capitalize">{payload.story.reason_choice}</dd>
                </div>
              )}
              {/* Areas of concern selected */}
              {Array.isArray(payload?.areas?.selected) && payload.areas.selected.length > 0 && (
                <div className="grid grid-cols-3 gap-4 py-4">
                  <dt className="text-sm font-medium text-slate-700">Areas of concern</dt>
                  <dd className="col-span-2 text-sm text-slate-900">{payload.areas.selected.map((t:string)=>topics.find(x=>x.id===t)?.label||t).join(', ')}</dd>
                </div>
              )}
              {/* Topic severities (0-10) */}
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
              {/* Daily: sleep short highlights */}
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
                    {/* Clinician-friendly one-liner */}
                    <div className="mt-1 text-sm text-muted-foreground">
                      {(() => {
                        const bt = payload.sleep?.bedtime;
                        const wt = payload.sleep?.wake_time;
                        const lat = payload.sleep?.sleep_latency_minutes;
                        const wak = payload.sleep?.night_awakenings_count;
                        const awake = payload.sleep?.awake_time_at_night_minutes;
                        const rested = payload.sleep?.rested_on_waking_0to10;
                        const parts: string[] = [];
                        if (bt && wt) parts.push(`Sleep window ${bt}–${wt}`);
                        if (typeof lat === 'number') parts.push(`${lat} min to fall asleep`);
                        if (typeof wak === 'number') parts.push(`${wak} awakenings`);
                        if (typeof awake === 'number') parts.push(`${awake} min awake overnight`);
                        if (typeof rested === 'number') parts.push(`rested ${rested}/10`);
                        // Approx sleep duration
                        let approx: string | null = null;
                        if (bt && wt) {
                          const [bh,bm] = String(bt).split(':').map((n:string)=>parseInt(n,10));
                          const [wh,wm] = String(wt).split(':').map((n:string)=>parseInt(n,10));
                          if (!Number.isNaN(bh) && !Number.isNaN(bm) && !Number.isNaN(wh) && !Number.isNaN(wm)) {
                            let diff = (wh*60+wm) - (bh*60+bm);
                            if (diff <= 0) diff += 24*60; // overnight
                            const awakeMin = (typeof awake === 'number' ? awake : 0) + (typeof lat === 'number' ? lat : 0);
                            const sleepMin = Math.max(0, diff - awakeMin);
                            const h = Math.floor(sleepMin/60);
                            const m = sleepMin%60;
                            approx = `~${h}h${m?` ${m}m`:''} sleep`;
                          }
                        }
                        return parts.length ? <span>Summary: {parts.join(' • ')}{approx?` • ${approx}`:''}</span> : null;
                      })()}
                    </div>
                  </dd>
                </div>
              )}
              {(payload?.daily?.meds_list?.length || payload?.daily?.supps_list?.length || payload?.daily?.factors) && (
                <div className="grid grid-cols-3 gap-4 py-4">
                  <dt className="text-sm font-medium text-slate-700">Daily habits</dt>
                  <dd className="col-span-2 text-sm text-slate-900 space-x-3">
                    {payload?.daily?.meds_list?.length ? <span>Meds: <span className="font-medium">{payload.daily.meds_list.join(', ')}</span></span> : null}
                    {payload?.daily?.supps_list?.length ? <span>Supps: <span className="font-medium">{payload.daily.supps_list.join(', ')}</span></span> : null}
                    {payload?.daily?.factors ? (
                      <span>Factors: {Object.entries(payload.daily.factors).filter(([_,v])=>v===true).map(([k])=>k.replaceAll('_',' ')).join(', ') || '—'}</span>
                    ) : null}
                  </dd>
                </div>
              )}
              {payload?.cec && (
                <div className="grid grid-cols-3 gap-4 py-4">
                  <dt className="text-sm font-medium text-slate-700">CEC snapshot</dt>
                  <dd className="col-span-2 text-sm text-slate-900">
                    {(() => {
                      const vals = Object.values(payload.cec as any) as number[];
                      const answered = vals.filter(v=>typeof v==='number').length;
                      const oftenAlways = vals.filter(v=>v>=2).length;
                      return <span>Answered: <span className="font-medium">{answered}</span>; Often/always: <span className="font-medium">{oftenAlways}</span></span>;
                    })()}
                  </dd>
                </div>
              )}
              {payload?.deepdive && Object.keys(payload.deepdive).length>0 && (
                <div className="grid grid-cols-3 gap-4 py-4">
                  <dt className="text-sm font-medium text-slate-700">Deep dive</dt>
                  <dd className="col-span-2 text-sm text-slate-900 space-y-2">
                    {Object.entries(payload.deepdive as any).map(([topic, scores]: any) => (
                      <div key={topic}>
                        <div className="font-medium">{topics.find(x=>x.id===topic)?.label||topic}</div>
                        <div>
                          {Object.entries(scores as any).map(([k,v]: any) => (
                            <span key={k} className="inline-block mr-3 mb-1">{(DEEP_ITEMS[topic]?.find(i=>i.key===k)?.label)||k}: <span className="font-medium">{v}</span></span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </dd>
                </div>
              )}
              {/* Contact info extras */}
              {profile.phone && (
                <div className="grid grid-cols-3 gap-4 py-4">
                  <dt className="text-sm font-medium text-slate-700">Phone</dt>
                  <dd className="col-span-2 text-sm text-slate-900">{profile.phone}</dd>
                </div>
              )}
              {profile.birthdate && (
                <div className="grid grid-cols-3 gap-4 py-4">
                  <dt className="text-sm font-medium text-slate-700">Birthdate</dt>
                  <dd className="col-span-2 text-sm text-slate-900">{formatBirth(profile.birthdate)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {tab==='intake' && (
        <Card>
          <CardHeader className="sticky top-0 z-10 flex flex-row items-center justify-between bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <CardTitle>CEC — Full responses</CardTitle>
            <div className="flex gap-2">
              {!cecEditing && <Button size="sm" variant="outline" onClick={()=>setCecEditing(true)}>Edit</Button>}
              {cecEditing && <>
                <Button size="sm" variant="outline" onClick={()=>{ setCecDraft({ ...(payload?.cec||{}) }); setCecEditing(false); }}>Cancel</Button>
                <Button size="sm" onClick={saveCec}>Save</Button>
              </>}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {cecItemsSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No CEC responses captured.</p>
            ) : (
              <div className="space-y-6">
                {Array.from(new Set(cecItemsSorted.map(id=>cecLabelById[id]?.domain || 'Other'))).map((domain) => (
                  <div key={domain} className="space-y-2">
                    <div className="sticky top-0 z-10 bg-white py-1 text-sm font-semibold text-slate-700">{domain}</div>
                    <div className="overflow-hidden rounded border">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-2 font-medium">Item</th>
                            <th className="text-left p-2 font-medium">Answer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cecItemsSorted.filter(id=> (cecLabelById[id]?.domain || 'Other') === domain).map((id) => {
                            const label = cecLabelById[id]?.text || id.replaceAll('_',' ');
                            const value = (cecEditing ? cecDraft[id] : payload.cec?.[id]) ?? 0;
                            return (
                              <tr key={id} className="border-t">
                                <td className="p-2 align-top">{label}</td>
                                <td className="p-2">
                                  {cecEditing ? (
                                    <select className="border rounded px-2 py-1" value={value} onChange={(e)=>setCecDraft(prev=>({ ...prev, [id]: Number(e.target.value) }))}>
                                      {CEC_SCALE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                  ) : (
                                    <span>{CEC_SCALE.find(s=>s.value===value)?.label ?? String(value)}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}


