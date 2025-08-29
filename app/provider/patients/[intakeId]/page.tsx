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
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { SUBRATING_CONFIG } from '@/lib/intake/subratings';
 

firebaseClient();

export default function PatientDetailPage({ params }: { params: { intakeId: string } }) {
  const { intakeId } = params;
  const [item, setItem] = useState<any>(null);
  const [tab, setTab] = useState<'intake'|'map'|'profile'|'gap'>('intake');
  const [error, setError] = useState<string|undefined>();
  const [cecEditing, setCecEditing] = useState<boolean>(false);
  const [cecDraft, setCecDraft] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [gapAnswers, setGapAnswers] = useState<Record<string, any>>({});
  const [gapSaving, setGapSaving] = useState<boolean>(false);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setError('Not signed in'); return; }
      try {
        const res = await fetch(`/api/provider/intakes/${intakeId}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
        const data = await res.json();
        if (!res.ok || data.ok === false) throw new Error(data?.error || 'Load failed');
        setItem(data.item);
        setDraft(structuredClone(data.item?.payload || {}));
        try { setGapAnswers({ ...(data.item?.gap_report?.answers || {}) }); } catch {}
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

  function setByRel(base: any, rel: string, value: any) {
    const next = { ...(base || {}) } as any;
    if (rel.includes('.')) {
      const parts = rel.split('.');
      const last = parts.pop() as string;
      let cursor: any = next;
      for (const p of parts) {
        if (typeof cursor[p] !== 'object' || cursor[p] === null) cursor[p] = {};
        cursor = cursor[p];
      }
      cursor[last] = value;
      return next;
    }
    (next as any)[rel] = value;
    return next;
  }

  // Report render helpers
  const SLEEP_SUBITEMS: { key: string; label: string }[] = [
    { key: 'drift_off_struggle', label: 'I struggle to drift off at night.' },
    { key: 'predawn_waking', label: "I wake up frequently before dawn and can't return to sleep." },
    { key: 'exhausted_after_full_night', label: "I feel exhausted even after a full night's rest." },
    { key: 'long_naps_needed', label: 'I take unusually long naps to feel alert.' },
    { key: 'schedule_varies', label: 'My sleep schedule varies wildly from day to day.' },
    { key: 'rested_on_waking', label: 'I feel rested and refreshed when I wake up.' },
  ];

  // ISI removed

  type PersonaItem = { text: string; reverse?: boolean };
  const PERSONA_CATS: { id: string; title: string; items: PersonaItem[] }[] = [
    { id: 'stress', title: 'Stress', items: [
      { text: 'I often feel overwhelmed by responsibilities.' },
      { text: 'Small problems quickly build up and feel unmanageable.' },
      { text: 'I find it hard to relax after a stressful day.' },
      { text: 'I feel constantly under pressure, even with small tasks.' },
    ]},
    { id: 'mood', title: 'Mood', items: [
      { text: 'I generally feel cheerful and optimistic.', reverse: true },
      { text: 'I experience frequent feelings of sadness or irritability.' },
      { text: 'I have trouble enjoying activities I used to love.' },
      { text: 'I look forward to each day with a positive attitude.', reverse: true },
    ]},
    { id: 'relaxed', title: 'Relaxed', items: [
      { text: 'I can stay calm when plans suddenly change.', reverse: true },
      { text: 'I often feel tense or restless.' },
      { text: 'I roll with unexpected changes without stress.', reverse: true },
      { text: 'Little things easily upset me.' },
    ]},
    { id: 'inhibited', title: 'Inhibited', items: [
      { text: 'I hold back my opinions to avoid conflict.' },
      { text: 'I hesitate to share my true feelings.' },
      { text: 'I avoid attention even when I have something to contribute.' },
      { text: 'I feel anxious speaking up in groups.' },
    ]},
    { id: 'regulated', title: 'Regulated', items: [
      { text: 'I pause and think before making decisions.', reverse: true },
      { text: 'I can stay focused on long-term goals despite distractions.', reverse: true },
      { text: 'I carefully consider consequences before acting.', reverse: true },
      { text: 'I resist urges when they conflict with my priorities.', reverse: true },
    ]},
    { id: 'impulsive', title: 'Impulsive', items: [
      { text: 'I often act on my first instinct without thinking.' },
      { text: 'I say things I later regret.' },
      { text: 'I make quick decisions without weighing options.' },
      { text: 'I buy or do things on impulse.' },
    ]},
    { id: 'passive', title: 'Passive', items: [
      { text: 'I let others take the lead even when I disagree.' },
      { text: 'I avoid expressing my needs to keep the peace.' },
      { text: 'I often go along with others’ decisions without objection.' },
      { text: 'I keep silent rather than risk conflict.' },
    ]},
    { id: 'assertive', title: 'Assertive', items: [
      { text: 'I feel comfortable saying “no” when necessary.', reverse: true },
      { text: 'I speak up confidently even in group settings.', reverse: true },
      { text: 'I stand up for myself when treated unfairly.', reverse: true },
      { text: 'I clearly communicate my needs.', reverse: true },
    ]},
    { id: 'flexible', title: 'Flexible', items: [
      { text: 'I adapt quickly when routines change.', reverse: true },
      { text: 'I resist trying new approaches once I’m used to something.' },
      { text: 'I enjoy experimenting with new ideas.', reverse: true },
      { text: 'I struggle when things don’t go as planned.' },
    ]},
    { id: 'perfectionistic', title: 'Perfectionistic', items: [
      { text: 'I feel anxious when tasks are not done perfectly.' },
      { text: 'I spend excessive time checking small details.' },
      { text: 'I set unrealistically high standards for myself.' },
      { text: 'I feel upset when even small mistakes happen.' },
    ]},
    { id: 'cooperative', title: 'Cooperative', items: [
      { text: 'I enjoy working as part of a team.', reverse: true },
      { text: 'I freely share credit with others.', reverse: true },
      { text: 'I value collaboration over individual recognition.', reverse: true },
      { text: 'I distrust others’ contributions.' },
    ]},
    { id: 'competitive', title: 'Competitive', items: [
      { text: 'I feel motivated by contests and challenges.' },
      { text: 'I like to measure my performance against others.' },
      { text: 'I thrive when competing.' },
      { text: 'I feel discouraged when I lose to others.' },
    ]},
    { id: 'independent', title: 'Independent', items: [
      { text: 'I trust my own judgment when making decisions.', reverse: true },
      { text: 'I feel confident handling responsibilities on my own.', reverse: true },
      { text: 'I prefer to rely on myself rather than others.', reverse: true },
      { text: 'I handle challenges without seeking much guidance.', reverse: true },
    ]},
    { id: 'dependent', title: 'Dependent', items: [
      { text: 'I rely on others’ opinions before making choices.' },
      { text: 'I feel uneasy without reassurance.' },
      { text: 'I often seek approval before acting.' },
      { text: 'I feel lost when I don’t have someone guiding me.' },
    ]},
    { id: 'interactive', title: 'Interactive', items: [
      { text: 'I enjoy engaging with new people.', reverse: true },
      { text: 'I easily strike up conversations with strangers.', reverse: true },
      { text: 'I feel energized by social interactions.', reverse: true },
      { text: 'I actively seek out opportunities to connect.', reverse: true },
    ]},
    { id: 'avoidant', title: 'Avoidant', items: [
      { text: 'I often steer clear of social gatherings.' },
      { text: 'I feel drained after spending time with groups of people.' },
      { text: 'I avoid meeting new people unless necessary.' },
      { text: 'I prefer solitude over being in a crowd.' },
    ]},
  ];

  const DAILY_FACTORS: { id: string; label: string }[] = [
    { id: 'repetitive_ear_infections', label: 'Repetitive ear infections' },
    { id: 'liver_disorder', label: 'Liver disorder' },
    { id: 'thyroid_disorder', label: 'Thyroid disorder' },
    { id: 'adrenal_dysfunction', label: 'Adrenal dysfunction' },
    { id: 'hypoglycemia', label: 'Hypoglycemia' },
    { id: 'heavy_metal_toxicity', label: 'Heavy metal toxicity' },
    { id: 'mold_exposure', label: 'Mold exposure' },
    { id: 'lyme_disease', label: 'Lyme disease' },
    { id: 'pandas', label: 'PANDAS' },
    { id: 'high_blood_pressure', label: 'High blood pressure' },
    { id: 'strep', label: 'Strep' },
    { id: 'diabetes', label: 'Diabetes' },
    { id: 'gut_issues', label: 'Gut issues' },
    { id: 'irritable_bowel_syndrome', label: 'Irritable bowel syndrome' },
  ];

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:underline" href="/provider">Patients</Link>
        <span>/</span>
        <span>{profile.first_name} {profile.last_name}</span>
      </div>

      <div className="flex items-center gap-3">
        <button className={`rounded px-3 py-1.5 text-sm ${tab==='intake'?'bg-slate-900 text-white':'bg-slate-100'}`} onClick={()=>setTab('intake')}>Intake</button>
        <button className={`rounded px-3 py-1.5 text-sm ${tab==='profile'?'bg-slate-900 text-white':'bg-slate-100'}`} onClick={()=>setTab('profile')}>Profile</button>
        <button className={`rounded px-3 py-1.5 text-sm ${tab==='map'?'bg-slate-900 text-white':'bg-slate-100'}`} onClick={()=>setTab('map')}>Map</button>
        {item?.complete && <>
          <button className={`rounded px-3 py-1.5 text-sm ${tab==='gap'?'bg-slate-900 text-white':'bg-slate-100'}`} onClick={()=>setTab('gap')}>Gap</button>
          <GapReportButton intakeId={item.intake_id} onDone={()=>setTab('gap')} />
        </>}
      </div>
      {tab==='profile' && (
        <Card>
          <CardHeader className="sticky top-0 z-10 flex flex-row items-center justify-between bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <CardTitle>Profile — Provider Report</CardTitle>
            <div className="flex items-center gap-2">
              {saving && <span className="text-sm text-muted-foreground">Saving…</span>}
              <Button size="sm" onClick={async ()=>{
                try {
                  setSaving(true);
                  const auth = getAuth();
                  const u = auth.currentUser!;
                  const payloadToSave = (()=>{ const p = structuredClone(draft||{}); try { if (p && typeof p === 'object') { delete (p as any).metabolic; delete (p as any).isi; } } catch {}; return p; })();
                  const res = await fetch('/api/intake-save', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ practiceId: item.practice_id, clientId: item.client_id, intakeId: item.intake_id, payload: payloadToSave }) });
                  const data = await res.json().catch(()=>({}));
                  if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Save failed');
                  setItem((prev:any)=> ({ ...prev, payload: structuredClone(payloadToSave), updated_at: data.updated_at || new Date().toISOString() }));
                } catch (e:any) { setError(e?.message || 'Save failed'); }
                finally { setSaving(false); }
              }}>Save all</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-10 pt-4">
            {/* Contact (compact table) */}
            <section className="space-y-2">
              <div className="text-sm font-semibold tracking-wide">Contact</div>
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="bg-slate-50 p-2 w-48">First name</td><td className="p-2"><Input value={draft?.profile?.first_name||''} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), profile: { ...(p?.profile||{}), first_name: e.target.value } }))} /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Last name</td><td className="p-2"><Input value={draft?.profile?.last_name||''} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), profile: { ...(p?.profile||{}), last_name: e.target.value } }))} /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Email</td><td className="p-2"><Input type="email" value={draft?.profile?.email||''} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), profile: { ...(p?.profile||{}), email: e.target.value } }))} /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Phone</td><td className="p-2"><Input value={draft?.profile?.phone||''} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), profile: { ...(p?.profile||{}), phone: e.target.value } }))} /></td></tr>
                    <tr><td className="bg-slate-50 p-2">Birthdate</td><td className="p-2"><Input type="date" value={draft?.profile?.birthdate||''} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), profile: { ...(p?.profile||{}), birthdate: e.target.value } }))} /></td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Reason */}
            <section className="space-y-2">
              <div className="text-sm font-semibold tracking-wide">Reason</div>
              <div className="inline-flex overflow-hidden rounded-md border shadow-sm">
                {['problem','peak'].map(opt => (
                  <button key={opt} type="button" onClick={()=> setDraft((p:any)=> ({ ...(p||{}), story: { ...(p?.story||{}), reason_choice: opt, flow_variant: opt } }))}
                    className={[ 'px-3 py-1.5 text-sm', ((draft?.story?.reason_choice||'')===opt) ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200' ].join(' ')}
                  >{opt==='problem'?'Problem to solve':'Peak to optimize'}</button>
                ))}
              </div>
            </section>

            {/* Areas & severities (table) */}
            <section className="space-y-2">
              <div className="text-sm font-semibold tracking-wide">Areas of concern</div>
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr><th className="text-left p-2 font-medium">Area</th><th className="text-left p-2 font-medium">Severity (0–5)</th></tr>
                  </thead>
                  <tbody>
                    {(draft?.areas?.selected||[]).map((tid:string)=>{
                      const label = topics.find(t=>t.id===tid)?.label || tid;
                      const value = Number(draft?.areas?.severity?.[tid] ?? 0);
                      return (
                        <tr key={tid} className="border-t">
                          <td className="p-2 align-top">{label}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-3">
                              <Slider min={0} max={5} step={1} value={[value]} onValueChange={(v)=> setDraft((p:any)=> ({ ...(p||{}), areas: { ...(p?.areas||{}), selected: Array.from(new Set([...(p?.areas?.selected||[]), tid])), severity: { ...(p?.areas?.severity||{}), [tid]: v[0] } } }))} />
                              <span className="text-xs text-muted-foreground w-6">{value}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(draft?.areas?.selected||[]).length===0 && (
                      <tr><td className="p-2 text-sm text-muted-foreground" colSpan={2}>No areas selected.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Topic subratings (0–3) */}
            <section className="space-y-2">
              <div className="text-sm font-semibold tracking-wide">Topic subratings</div>
              {Object.keys(SUBRATING_CONFIG).map(topicId => {
                const items = SUBRATING_CONFIG[topicId] || [];
                if (!items.length) return null;
                const tLabel = topics.find(t=>t.id===topicId)?.label || topicId;
                return (
                  <div key={topicId} className="space-y-1">
                    <div className="text-xs font-medium text-slate-600">{tLabel}</div>
                    <div className="overflow-hidden rounded border">
                      <table className="w-full text-sm">
                        <tbody>
                          {items.map(it => {
                            const v = Number(draft?.topic_subratings?.[topicId]?.[it.key] ?? 0);
                            return (
                              <tr key={it.key} className="border-t">
                                <td className="bg-slate-50 p-2 w-3/5 align-top">{it.label}</td>
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    {[0,1,2,3].map(n => (
                                      <button key={n} type="button" aria-pressed={v===n} onClick={()=> setDraft((p:any)=> ({ ...(p||{}), topic_subratings: setByRel(p?.topic_subratings, `${topicId}.${it.key}`, n) }))}
                                        className={[ 'h-7 w-7 rounded-full border text-xs grid place-items-center', v===n ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent' ].join(' ')}
                                      >{n}</button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Sleep snapshot */}
            <section className="space-y-2">
              <div className="text-sm font-semibold tracking-wide">Sleep snapshot</div>
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="bg-slate-50 p-2 w-64">Typical bedtime</td><td className="p-2"><Input value={draft?.sleep?.bedtime||''} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), sleep: { ...(p?.sleep||{}), bedtime: e.target.value } }))} placeholder="HH:MM" /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Typical wake time</td><td className="p-2"><Input value={draft?.sleep?.wake_time||''} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), sleep: { ...(p?.sleep||{}), wake_time: e.target.value } }))} placeholder="HH:MM" /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Minutes to fall asleep</td><td className="p-2"><Input type="number" value={Number(draft?.sleep?.sleep_latency_minutes||0)} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), sleep: { ...(p?.sleep||{}), sleep_latency_minutes: Math.max(0, Number(e.target.value||0)) } }))} /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Number of awakenings</td><td className="p-2"><Input type="number" value={Number(draft?.sleep?.night_awakenings_count||0)} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), sleep: { ...(p?.sleep||{}), night_awakenings_count: Math.max(0, Number(e.target.value||0)) } }))} /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Total minutes awake at night</td><td className="p-2"><Input type="number" value={Number(draft?.sleep?.awake_time_at_night_minutes||0)} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), sleep: { ...(p?.sleep||{}), awake_time_at_night_minutes: Math.max(0, Number(e.target.value||0)) } }))} /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Sleep apnea diagnosed</td><td className="p-2">
                      <div className="inline-flex overflow-hidden rounded-md border shadow-sm">
                        {['No','Yes'].map((label, idx) => {
                          const yes = Boolean(draft?.sleep?.sleep_apnea_diagnosed);
                          const isYes = idx === 1;
                          const active = (isYes && yes) || (!isYes && !yes);
                          return (
                            <button key={label} type="button" onClick={()=> setDraft((p:any)=> ({ ...(p||{}), sleep: { ...(p?.sleep||{}), sleep_apnea_diagnosed: isYes } }))}
                              className={[ 'px-3 py-1.5 text-sm', active ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200' ].join(' ')}
                            >{label}</button>
                          );
                        })}
                      </div>
                    </td></tr>
                    <tr><td className="bg-slate-50 p-2">Sleep aids used</td><td className="p-2">
                      <div className="inline-flex overflow-hidden rounded-md border shadow-sm">
                        {['No','Yes'].map((label, idx) => {
                          const yes = Boolean(draft?.sleep?.sleep_aids_used);
                          const isYes = idx === 1;
                          const active = (isYes && yes) || (!isYes && !yes);
                          return (
                            <button key={label} type="button" onClick={()=> setDraft((p:any)=> ({ ...(p||{}), sleep: { ...(p?.sleep||{}), sleep_aids_used: isYes } }))}
                              className={[ 'px-3 py-1.5 text-sm', active ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200' ].join(' ')}
                            >{label}</button>
                          );
                        })}
                      </div>
                    </td></tr>
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-muted-foreground">0 = never, 1 = sometimes, 2 = often, 3 = always</div>
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <tbody>
                    {SLEEP_SUBITEMS.map(it => {
                      const v = Number(draft?.sleep?.subratings?.[it.key] ?? 0);
                      return (
                        <tr key={it.key} className="border-t">
                          <td className="bg-slate-50 p-2 w-3/5 align-top">{it.label}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {[0,1,2,3].map(n => (
                                <button key={n} type="button" aria-pressed={v===n} onClick={()=> setDraft((p:any)=> ({ ...(p||{}), sleep: setByRel(p?.sleep, `subratings.${it.key}`, n) }))}
                                  className={[ 'h-7 w-7 rounded-full border text-xs grid place-items-center', v===n ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent' ].join(' ')}
                                >{n}</button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Daily */}
            <section className="space-y-2">
              <div className="text-sm font-semibold tracking-wide">Daily habits</div>
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="bg-slate-50 p-2 w-64">Medications</td><td className="p-2"><Input value={(draft?.daily?.meds_list||[]).join(', ')} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), daily: { ...(p?.daily||{}), meds_list: e.target.value.split(',').map((s)=>s.trim()).filter(Boolean) } }))} placeholder="Comma-separated" /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Supplements</td><td className="p-2"><Input value={(draft?.daily?.supps_list||[]).join(', ')} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), daily: { ...(p?.daily||{}), supps_list: e.target.value.split(',').map((s)=>s.trim()).filter(Boolean) } }))} placeholder="Comma-separated" /></td></tr>
                    <tr className="border-b"><td className="bg-slate-50 p-2">Exercise frequency</td><td className="p-2"><div className="flex items-center gap-2"><Input className="w-24" type="number" value={parseInt(String(draft?.daily?.exercise_frequency||'0'),10)||0} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), daily: { ...(p?.daily||{}), exercise_frequency: String(Math.max(0, Number(e.target.value||0))) } }))} /><select className="h-9 rounded-md border px-2 text-sm" value={draft?.daily?.exercise_period||'per week'} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), daily: { ...(p?.daily||{}), exercise_period: e.target.value } }))}><option value="per week">per week</option><option value="per month">per month</option><option value="per day">per day</option></select></div></td></tr>
                    <tr><td className="bg-slate-50 p-2">Minutes per session</td><td className="p-2"><Input className="w-32" type="number" value={parseInt(String(draft?.daily?.exercise_minutes_per_session||'0'),10)||0} onChange={(e)=> setDraft((p:any)=> ({ ...(p||{}), daily: { ...(p?.daily||{}), exercise_minutes_per_session: String(Math.max(0, Number(e.target.value||0))) } }))} /></td></tr>
                  </tbody>
                </table>
              </div>
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr><th className="text-left p-2 font-medium">Complicating factor</th><th className="text-left p-2 font-medium">Present</th></tr></thead>
                  <tbody>
                    {DAILY_FACTORS.map(f => {
                      const present = !!(draft?.daily?.factors?.[f.id]);
                      return (
                        <tr key={f.id} className="border-t">
                          <td className="p-2">{f.label}</td>
                          <td className="p-2">
                            <div className="inline-flex overflow-hidden rounded-md border shadow-sm">
                              {['No','Yes'].map((label, idx) => {
                                const isYes = idx === 1; const active = (isYes && present) || (!isYes && !present);
                                return (
                                  <button key={label} type="button" onClick={()=> setDraft((p:any)=> ({ ...(p||{}), daily: { ...(p?.daily||{}), factors: { ...(p?.daily?.factors||{}), ...(isYes ? { [f.id]: true } : (()=>{ const next={ ...(p?.daily?.factors||{}) } as any; try { delete next[f.id]; } catch {}; return next; })() ) } } }))}
                                    className={[ 'px-3 py-1.5 text-sm', active ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200' ].join(' ')}
                                  >{label}</button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Metabolic — removed */}

            {/* ISI — removed */}

            {/* Personality */}
            <section className="space-y-2">
              <div className="text-sm font-semibold tracking-wide">Adaptive profile</div>
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <tbody>
                    {PERSONA_CATS.map(cat => (
                      <tr key={cat.id} className="border-t">
                        <td className="bg-slate-50 p-2 w-56 align-top font-medium">{cat.title}</td>
                        <td className="p-2">
                          <div className="grid gap-2">
                            {cat.items.map((q, idx) => {
                              const v = Number((draft?.adaptive?.responses?.[cat.id]||[])[idx] || 0);
                              return (
                                <div key={idx} className="grid gap-1">
                                  <div className="text-sm text-slate-700">{q.text}</div>
                                  <div className="flex items-center gap-1">
                                    {[1,2,3,4,5].map(n => (
                                      <button key={n} type="button" aria-pressed={v===n} onClick={()=> setDraft((p:any)=> ({ ...(p||{}), adaptive: setByRel(p?.adaptive, `responses.${cat.id}.${idx}`, n) }))}
                                        className={[ 'px-2 py-1 text-xs rounded border', v===n ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent' ].join(' ')}
                                      >{n}</button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* CEC — Full responses (existing editor retained) */}
            <section className="space-y-2">
              <div className="text-sm font-semibold tracking-wide">CEC — Full responses</div>
              <div>
                <div className="flex gap-2">
                  {!cecEditing && <Button size="sm" variant="outline" onClick={()=>setCecEditing(true)}>Edit</Button>}
                  {cecEditing && <>
                    <Button size="sm" variant="outline" onClick={()=>{ setCecDraft({ ...(payload?.cec||{}) }); setCecEditing(false); }}>Cancel</Button>
                    <Button size="sm" onClick={saveCec}>Save</Button>
                  </>}
                </div>
              </div>
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr><th className="text-left p-2 font-medium">Item</th><th className="text-left p-2 font-medium">Answer</th></tr></thead>
                  <tbody>
                    {Object.keys(payload?.cec||{}).sort((a,b)=>{
                      const da = (cecLabelById[a]?.domain || '').localeCompare(cecLabelById[b]?.domain || '');
                      if (da !== 0) return da; return (cecLabelById[a]?.text || a).localeCompare(cecLabelById[b]?.text || b);
                    }).map((id)=>{
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
            </section>
          </CardContent>
        </Card>
      )}

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

      {tab as any === 'gap' && (
        <div className="space-y-6">
          {/* Rendered report */}
          <Card>
            <CardHeader>
              <CardTitle>Gap Report — Provider</CardTitle>
            </CardHeader>
            <CardContent>
              {item?.gap_report?.render?.mode === 'html' && (
                <div dangerouslySetInnerHTML={{ __html: String(item?.gap_report?.render?.content || '') }} />
              )}
              {item?.gap_report?.render?.mode === 'markdown' && (
                <pre className="whitespace-pre-wrap text-sm">{String(item?.gap_report?.render?.content || '')}</pre>
              )}
              {!item?.gap_report?.render && (
                <p className="text-sm text-muted-foreground">No report found. Click “Gap Report” to generate.</p>
              )}
            </CardContent>
          </Card>

          {/* Questionnaire */}
          {Array.isArray(item?.gap_report?.writeback?.gap?.questionnaire) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Targeted Gap Questionnaire</CardTitle>
                <div className="flex items-center gap-2">
                  {gapSaving && <span className="text-sm text-muted-foreground">Saving…</span>}
                  <Button size="sm" onClick={async ()=>{
                    try {
                      setGapSaving(true);
                      const auth = getAuth();
                      const u = auth.currentUser!;
                      const res = await fetch('/api/provider/gap-report/save', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${await u.getIdToken()}` }, body: JSON.stringify({ intakeId: item.intake_id, answers: gapAnswers }) });
                      const data = await res.json();
                      if (!res.ok || data.ok === false) throw new Error(data?.error || 'Save failed');
                      setItem((prev:any)=> ({ ...prev, gap_report: { ...(prev?.gap_report||{}), answers: { ...gapAnswers }, updated_at: data.updated_at } }));
                    } catch (e:any) { setError(e?.message || 'Save failed'); }
                    finally { setGapSaving(false); }
                  }}>Save</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.gap_report.writeback.gap.questionnaire.map((q: any) => (
                  <div key={q.id} className="rounded border p-3">
                    <div className="text-sm font-medium">Q: {q.patient_question} {q.scale ? <span className="text-xs text-muted-foreground">({q.scale})</span> : null}</div>
                    <div className="text-xs text-slate-600 mb-2">Provider note: {q.provider_note}</div>
                    <div>
                      {(() => {
                        const val = gapAnswers[q.id] ?? '';
                        const type = String(q.expected_answer_type || 'text');
                        if (type === 'scale') {
                          // Parse scale like "0–5" or "0–3"
                          const m = String(q.scale||'0–5').match(/(\d+)\D+(\d+)/);
                          const min = m ? Number(m[1]) : 0; const max = m ? Number(m[2]) : 5;
                          const opts = Array.from({ length: (max-min+1) }, (_,i)=>min+i);
                          return (
                            <select className="border rounded px-2 py-1" value={String(val)} onChange={(e)=> setGapAnswers(prev=>({ ...prev, [q.id]: Number(e.target.value) }))}>
                              <option value="">Select…</option>
                              {opts.map(n=> <option key={n} value={n}>{n}</option>)}
                            </select>
                          );
                        }
                        if (type === 'number') {
                          return <input className="border rounded px-2 py-1" type="number" value={String(val)} onChange={(e)=> setGapAnswers(prev=>({ ...prev, [q.id]: Number(e.target.value) }))} />;
                        }
                        if (type === 'multi') {
                          return <input className="border rounded px-2 py-1 w-full" placeholder="Comma-separated" value={Array.isArray(val)? val.join(', '): String(val)} onChange={(e)=> setGapAnswers(prev=>({ ...prev, [q.id]: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) }))} />;
                        }
                        // text or choice fallback
                        return <input className="border rounded px-2 py-1 w-full" value={String(val)} onChange={(e)=> setGapAnswers(prev=>({ ...prev, [q.id]: e.target.value }))} />;
                      })()}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
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


