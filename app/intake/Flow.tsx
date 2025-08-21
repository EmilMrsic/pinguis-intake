"use client";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import SelectCard from '@/components/SelectCard';
import FollowUpPane from '@/components/FollowUpPane';
import { saveIntakeAction } from './actions';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { FLOW_VARIANT } from '@/lib/intake/config';
import { devPracticeId, devClientId } from '@/lib/devIds';
 

export type Step = {
  id: string;
  title: string;
  description?: string;
  type: 'singleSelect' | 'contact' | 'areas_select' | 'topic_rate' | 'slider' | 'text';
  field: string; // dot path in payload
  scale?: '0-10'|'1-5'|'minutes';
  meta?: Record<string, any>;
};

const baseSteps: Step[] = [
  { id:'reason', title:"Let's start simple — what's your focus?", description:"We'll tailor what comes next to match your choice.", type:'singleSelect', field:'story.reason_choice' },
  { id:'contact', title:'Quick contact details', description:'This helps us keep you updated about scheduling.', type:'contact', field:'profile' },
  { id:'areas_select', title:'What would you like to focus on?', description:'Pick one or more.', type:'areas_select', field:'areas' },
];

function setByPath(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getByPath(obj: any, path: string) {
  return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object') ? acc[k] : undefined, obj);
}

export default function Flow() {
  const [payload, setPayload] = useState<Record<string, any>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [loadingIntake, setLoadingIntake] = useState<boolean>(true);

  // Topics catalog
  const topics: { id: string; label: string }[] = [
    { id: 'anx', label: 'Stress & anxiety' },
    { id: 'dep', label: 'Mood & depression' },
    { id: 'mem', label: 'Memory & thinking' },
    { id: 'imp', label: 'Impulsivity' },
    { id: 'sleep', label: 'Sleep issues' },
    { id: 'learn', label: 'Learning issues (kids)' },
  ];

  const topicPromptFallback: Record<string, string> = {
    anx: 'Briefly describe when anxiety shows up and what sets it off.',
    dep: 'Briefly describe when mood dips happen and how they affect your days.',
    mem: 'Briefly describe where memory or focus breaks down.',
    imp: 'Briefly describe situations where impulses get ahead of you.',
    sleep: 'Briefly describe your sleep window and what interrupts it.',
    learn: 'Briefly describe where schoolwork gets stuck.',
  };

  // Dynamic steps based on selected topics
  const selected = payload.areas?.selected ?? [];
  const topicSteps: Step[] = useMemo(() => selected.map((topicId: string) => ({
    id: `topic_${topicId}`,
    title: `Rate: ${topics.find(t=>t.id===topicId)?.label ?? topicId}`,
    description: '1 = mild · 5 = severe',
    type: 'topic_rate',
    field: 'areas',
    meta: { topicId }
  })), [selected]);
  const steps = useMemo(() => [
    baseSteps[0],
    baseSteps[1],
    baseSteps[2],
    ...topicSteps
  ], [selected]);

  const current = steps[stepIdx];
  // On mount, attempt to load existing intake tied to current auth email
  useEffect(() => {
    let unsub: any;
    const app = firebaseClient();
    const auth = getAuth(app);
    unsub = onAuthStateChanged(auth, async (u) => {
      try {
        const email = u?.email || payload?.profile?.email || '';
        if (!email && !payload?.intakeId) { setLoadingIntake(false); return; } // nothing to query
        const res = await fetch('/api/intake-load', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practiceId: devPracticeId, intakeId: payload?.intakeId, email, clientId: devClientId })
        });
        if (!res.ok) { setLoadingIntake(false); return; }
        const data = await res.json();
        if (data?.payload) {
          setPayload((prev) => {
            if (hydratedRef.current) return prev;
            const merged = { ...data.payload, ...prev } as any; // prefer loaded values
            if (email && !merged?.profile?.email) {
              merged.profile = { ...(merged.profile||{}), email };
            }
            if (data.intakeId) merged.intakeId = data.intakeId;
            hydratedRef.current = true;
            return merged;
          });
        } else if (email) {
          // Seed email so first save links this user
          setPayload((prev)=> ({ ...prev, profile: { ...(prev.profile||{}), email } }));
        }
      } catch {}
      finally { setLoadingIntake(false); }
    });
    return () => { try { unsub && unsub(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI suggestions state (per screen key)
  const [aiCopyMap, setAiCopyMap] = useState<Record<string, { title?: string; subtitle?: string; prompt_line?: string; placeholder?: string }>>({});
  const [aiChipsMap, setAiChipsMap] = useState<Record<string, string[]>>({});
  const intakeId = payload?.intakeId ?? `${devPracticeId}:${devClientId}`;
  const aiDebounceRef = useRef<Record<string, any>>({});
  const aiNotesTimerRef = useRef<Record<string, any>>({});
  const isTypingRef = useRef<boolean>(false);
  const typingResetTimer = useRef<any>(null);
  const hydratedRef = useRef<boolean>(false);

  // autosave on payload change (debounced)
  const timer = useRef<NodeJS.Timeout | null>(null);
  const lastOptsRef = useRef<{ silent?: boolean }>({});
  function generateIntakeIdFrom(next: any): string {
    const fi = (next?.profile?.first_name || '').trim().charAt(0).toLowerCase() || 'x';
    const li = (next?.profile?.last_name || '').trim().charAt(0).toLowerCase() || 'x';
    const rand = Math.floor(100000 + Math.random()*900000).toString();
    return `${fi}${li}${rand}`;
  }
  const autosave = useCallback((next: Record<string, any>, opts?: { silent?: boolean; immediate?: boolean }) => {
    const doSave = async (snapshotIn: Record<string, any>) => {
      // allow save even during hydration if user interacts; we only guard if nothing is loaded and no edits
      const snapshot = { ...(snapshotIn as any) } as any;
      if (!snapshot.intakeId) {
        snapshot.intakeId = generateIntakeIdFrom(snapshot);
        setPayload((prev) => prev?.intakeId ? prev : ({ ...prev, intakeId: snapshot.intakeId }));
      }
      setSaving(true);
      try {
        const res = await fetch('/api/intake-save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practiceId: devPracticeId, clientId: devClientId, intakeId: snapshot?.intakeId, payload: snapshot })
        });
        if (!res.ok) {
          console.error('intake-save failed', await res.text());
        }
        if (res.ok && !(opts?.silent)) {
          setToast('Saved ✓');
          setTimeout(()=>setToast(''), 1200);
        }
      } finally {
        setSaving(false);
      }
    };

    if (opts?.immediate) {
      if (timer.current) clearTimeout(timer.current);
      void doSave(next);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    lastOptsRef.current = opts || {};
    const snapshot = { ...next } as any;
    timer.current = setTimeout(() => { void doSave(snapshot); }, 900);
  }, []);

  function updateField(path: string, value: any) {
    const next = structuredClone(payload);
    setByPath(next, path, value);
    setPayload(next);
    autosave(next);
  }

  function nextStep() { if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1); }
  function prevStep() { if (stepIdx > 0) setStepIdx(stepIdx - 1); }

  // Mark complete helper (call on final submit later)
  async function markComplete() {
    try {
      const res = await fetch('/api/intake-save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ practiceId: devPracticeId, clientId: devClientId, intakeId: payload?.intakeId, payload, complete: true })});
      await res.json().catch(()=>({}));
    } catch {}
  }

  // Glowing gradient wrappers (Tailwind v3) inspired by Braydon Coyer's technique
  function Glow({
    children,
    radius = 'rounded-xl',
    from = 'from-sky-500',
    to = 'to-blue-600',
  }: { children: React.ReactNode; radius?: string; from?: string; to?: string }) {
    return (
      <div className={`relative ${radius}`}>
        <div className={`pointer-events-none absolute -inset-1 ${radius} bg-gradient-to-r ${from} ${to} opacity-35 blur`} />
        {children}
      </div>
    );
  }

  function GlowButton({
    children,
    onClick,
    disabled,
    variant = 'default' as const,
  }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'default'|'outline'|'secondary'|'ghost'|'link'|'destructive' }) {
    return (
      <div className="relative inline-flex">
        <div className="pointer-events-none absolute -inset-0.5 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 opacity-40 blur-sm" />
        <Button variant={variant} onClick={onClick} disabled={disabled} className="relative">{children}</Button>
      </div>
    );
  }

  // Local contact form to keep typing buttery smooth
  function ContactForm({
    profile,
    onDraft,
  }: { profile: any; onDraft: (p: any) => void }) {
    const [local, setLocal] = useState<any>({
      first_name: profile?.first_name ?? '',
      last_name: profile?.last_name ?? '',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      birthdate: profile?.birthdate ?? '',
      photo_url: profile?.photo_url ?? '',
    });
    const fileRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      // If payload already had values (e.g., prefilled), adopt them when step mounts
      setLocal((prev: any) => ({ ...prev, ...profile }));
      onDraft({ ...local, ...profile });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function setField(path: keyof typeof local, v: string) {
      const next = { ...local, [path]: v };
      setLocal(next);
      onDraft(next);
    }

    async function doUpload(file: File) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('intakeId', (payload?.intakeId ?? 'unknown').toString());
      const res = await fetch('/api/upload-profile', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        const next = { ...local, photo_url: data.url };
        setLocal(next);
        onDraft(next);
      }
    }

    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">First name</label>
            <Input value={local.first_name} onChange={(e)=>setField('first_name', e.target.value)} placeholder="Jane" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Last name</label>
            <Input value={local.last_name} onChange={(e)=>setField('last_name', e.target.value)} placeholder="Doe" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Best email</label>
            <Input type="email" value={local.email} onChange={(e)=>setField('email', e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Best phone</label>
            <Input type="tel" value={local.phone} onChange={(e)=>setField('phone', e.target.value)} placeholder="(555) 123-4567" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Birthdate</label>
            <Input type="date" value={local.birthdate} onChange={(e)=>setField('birthdate', e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Profile photo</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) void doUpload(f); }} />
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full overflow-hidden border grid place-items-center bg-muted">
                {local.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={local.photo_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">No photo</span>
                )}
              </div>
              <Button type="button" variant="outline" onClick={()=>fileRef.current?.click()}>Upload photo</Button>
              <Button type="button" variant="secondary" onClick={async ()=>{
                try {
                  const res = await fetch('/api/generate-abstract-avatar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ intakeId: payload?.intakeId }) });
                  if (res.ok) { const data = await res.json(); const next={...local, photo_url:data.url}; setLocal(next); onDraft(next);} }
                catch {}
              }}>Generate avatar</Button>
              {local.photo_url && (<span className="text-sm">✓</span>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Jump helper for "Continue your intake"
  function jumpToNextRelevant() {
    try {
      let targetIdx = 0;
      if (reasonChoice) targetIdx = 1; // contact
      const needContact = !(((profile.first_name||'').trim()) && ((profile.last_name||'').trim()) && ((profile.email||'').trim()));
      if (!needContact) targetIdx = 2; // areas_select
      if ((selectedTopics?.length ?? 0) > 0) {
        // First topic missing severity, else first topic
        const firstMissing = selectedTopics.find(t => !((severities?.[t] ?? 0) >= 1));
        const topicId = firstMissing ?? selectedTopics[0];
        const idx = steps.findIndex(s => s.id === `topic_${topicId}`);
        if (idx >= 0) targetIdx = idx;
      }
      setStepIdx(Math.max(0, Math.min(steps.length - 1, targetIdx)));
    } catch {}
  }

  function toggleTopic(topicId: string) {
    const next = structuredClone(payload);
    if (!next.intakeId) next.intakeId = generateIntakeIdFrom(next);
    const selected: string[] = Array.from(new Set([...(next.areas?.selected ?? [])]));
    const idx = selected.indexOf(topicId);
    if (idx >= 0) {
      selected.splice(idx, 1);
      if (next.areas?.severity) delete next.areas.severity[topicId];
      if (next.notes?.byTopic) next.notes.byTopic[topicId] = null;
    } else {
      selected.push(topicId);
    }
    next.areas = { ...(next.areas ?? {}), selected, severity: { ...(next.areas?.severity ?? {}) } };
    const enq = selected.filter(t => (next.areas.severity?.[t] ?? 0) >= 3);
    next.queues = { ...(next.queues || {}), deepDive: Array.from(new Set(enq)) };
    setPayload(next);
    autosave(next, { immediate: true, silent: true });
    (async()=>{ try { await aiTurn('areas_select','set_area', { topicId, selected: idx < 0 }); } catch {} })();
  }

  function setSeverity(topicId: string, val: number) {
    const next = structuredClone(payload);
    if (!next.intakeId) next.intakeId = generateIntakeIdFrom(next);
    const selected: string[] = Array.from(new Set([...(next.areas?.selected ?? [])]));
    if (!selected.includes(topicId)) selected.push(topicId);
    const severity = { ...(next.areas?.severity ?? {}), [topicId]: val };
    next.areas = { ...(next.areas ?? {}), selected, severity };
    const enq = (next.areas.selected ?? []).filter((t: string) => (severity?.[t] ?? 0) >= 3);
    next.queues = { ...(next.queues || {}), deepDive: Array.from(new Set(enq)) };
    setPayload(next);
    autosave(next, { immediate: true, silent: true });
    (async()=>{ try { await aiTurn('topic_rate','set_severity', { topicId, severity: val, topic_label: topics.find(x=>x.id===topicId)?.label }); } catch {} })();
  }

  // Topic note setter (debounced + non-blocking AI call)
  function setTopicNote(topicId: string, text: string) {
    const next = structuredClone(payload);
    if (!next.intakeId) next.intakeId = generateIntakeIdFrom(next);
    const byTopic = { ...(next.notes?.byTopic ?? {}), [topicId]: text };
    next.notes = { ...(next.notes ?? {}), byTopic };
    setPayload(next); autosave(next, { silent: true });
    // Mark typing state to suppress AI/UI refresh while actively typing
    isTypingRef.current = true;
    if (typingResetTimer.current) clearTimeout(typingResetTimer.current);
    typingResetTimer.current = setTimeout(() => { isTypingRef.current = false; }, 1200);
    // Throttle AI suggestions to avoid jitter while typing quickly
    try { if (aiNotesTimerRef.current[topicId]) clearTimeout(aiNotesTimerRef.current[topicId]); } catch {}
    aiNotesTimerRef.current[topicId] = setTimeout(() => {
      (async()=>{ try { await aiTurn('topic_rate','open_comment_changed', { topicId, chars: text.length }); } catch {} })();
    }, 2500);
  }

  function setReasonChoice(v: 'problem' | 'peak') {
    const next = structuredClone(payload);
    setByPath(next, 'story.reason_choice', v);
    setByPath(next, 'story.flow_variant', v);
    setPayload(next);
    autosave(next);
    (async()=>{ try { await aiTurn('reason','set_reason', { choice: v }); } catch {} })();
  }

  const selectedTopics: string[] = payload.areas?.selected ?? [];
  const severities: Record<string, number> = payload.areas?.severity ?? {};
  const reasonChoice: 'problem' | 'peak' | undefined = payload.story?.reason_choice;
  const profile = payload.profile ?? {};
  const contactDraftRef = useRef<any>(profile);
  // recompute queue is handled on severity change; no deep-dive UI in this scope
  // AI call helper
  const aiTurn = useCallback(async (screenId: string, event: string, extra?: any) => {
    // Hard-disable AI to eliminate any UI jitter from failed or slow requests
    if (true) return;
    try {
      if (isTypingRef.current && screenId === 'topic_rate' && event === 'open_comment_changed') return; // don't refresh UI while typing
      const key = extra?.topicId ? `${screenId}:${extra.topicId}` : screenId;
      const res = await fetch('/api/model-hook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeId,
          screenId,
          event,
          user_text: extra?.user_text,
          context: {
            flowVariant: payload?.story?.flow_variant ?? FLOW_VARIANT,
            topic: extra?.topicId,
            topic_label: extra?.topic_label,
            severity: extra?.severity,
          }
        })
      });
      if (!res.ok) return; // avoid state churn on 500s
      const data = await res.json().catch(() => ({}));
      startTransition(() => {
        if (data?.suggested_copy) setAiCopyMap((m) => ({ ...m, [key]: data.suggested_copy }));
        if (Array.isArray(data?.suggested_chips)) setAiChipsMap((m) => ({ ...m, [key]: data.suggested_chips }));
      });
    } catch {}
  }, [intakeId, payload]);
  // Clamp stepIdx if selection changes and steps shrink
  useEffect(() => {
    if (stepIdx >= steps.length) {
      setStepIdx(Math.max(0, steps.length - 1));
    }
  }, [steps.length, stepIdx]);

  // Call AI on screen enter (guarded against backend failures)
  useEffect(() => {
    // Feature flag: disable AI turns if env says so
    if (process.env.NEXT_PUBLIC_DISABLE_AI === '1') return;
    if (current?.type === 'areas_select') aiTurn('areas_select', 'entered_screen');
    if (current?.type === 'topic_rate') aiTurn('topic_rate', 'entered_screen', { topicId: current.meta?.topicId });
    if (current?.id === 'reason') aiTurn('reason', 'entered_screen');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // no deep-dive items in this scope

  return (
    <div className="mx-auto w-full max-w-screen-sm sm:max-w-screen-md lg:max-w-screen-lg px-4 sm:px-6 lg:px-8 py-8">
      <Glow>
      <Card className="relative">
        <CardHeader>
          {(() => {
            const key = current.type === 'topic_rate' ? `topic_rate:${current.meta?.topicId}` : current.id;
            const copy = aiCopyMap[key];
            return (
              <>
                <CardTitle className="text-2xl font-semibold tracking-tight">{copy?.title || current.title}</CardTitle>
                {(copy?.subtitle || current.description) && <CardDescription>{copy?.subtitle || current.description}</CardDescription>}
                {stepIdx === 0 && payload?.intakeId && (
                  <div className="mt-2 text-sm">
                    <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                      <span>Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}! You can continue your intake.</span>
                      <Button size="sm" variant="secondary" onClick={jumpToNextRelevant}>Continue</Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </CardHeader>
        <CardContent className="space-y-6">
          {(() => {
            const key = current.type === 'topic_rate' ? `topic_rate:${current.meta?.topicId}` : current.id;
            const copy = aiCopyMap[key];
            const aiChips = aiChipsMap[key] ?? [];
            return (
              <>
                {copy?.prompt_line && (
                  <div className="text-sm text-muted-foreground">{copy.prompt_line}</div>
                )}
                {aiChips.length > 0 && (
                  <div className="flex flex-wrap gap-2" aria-label="Suggestions">
                    {aiChips.slice(0,6).map((chip, i) => (
                      <button
                        key={i}
                        type="button"
                        className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
                        onClick={() => {
                          if (current.type === 'topic_rate') {
                            const topicId = current.meta?.topicId as string;
                            const cur = getByPath(payload, `notes.byTopic.${topicId}`) ?? '';
                            const prefix = chip + (chip.endsWith(':') ? ' ' : ': ');
                            setTopicNote(topicId, cur ? (cur + (cur.endsWith('\n')?'':'\n') + prefix) : prefix);
                          }
                        }}
                      >{chip}</button>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
          {current.type === 'singleSelect' && (
            <div className="grid gap-4">
              {/* Slim progress bar at top for modern feel */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
                <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-600 w-1/2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-label="Choose your starting point">
                {[
                  { v: 'problem', label: 'Addressing a challenge', emoji: '💡', sub: 'Stress, mood, sleep, focus' },
                  { v: 'peak', label: 'Peak performance / optimization', emoji: '🚀', sub: 'Get an edge, optimize' },
                ].map((opt) => {
                  const selected = reasonChoice === (opt.v as 'problem'|'peak');
                  return (
                    <SelectCard
                      key={opt.v}
                      role="radio"
                      ariaLabel={opt.label}
                      title={opt.label}
                      subtitle={opt.sub}
                      selected={selected}
                      onSelect={() => setReasonChoice(opt.v as 'problem'|'peak')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setReasonChoice(opt.v as 'problem'|'peak');
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                          e.preventDefault();
                          const options: Array<'problem'|'peak'> = ['problem','peak'];
                          const idx = options.indexOf(opt.v as 'problem'|'peak');
                          const nextIdx = e.key === 'ArrowLeft' ? (idx + options.length - 1) % options.length : (idx + 1) % options.length;
                          setReasonChoice(options[nextIdx]);
                        }
                      }}
                    >
                      <div className="text-2xl" aria-hidden>{opt.emoji}</div>
                    </SelectCard>
                  );
                })}
              </div>
            </div>
          )}

          {current.type === 'areas_select' && (
            <div className="grid gap-4">
              {/* Slim progress bar for step affordance */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
                <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-600" style={{ width: `${Math.max(33, Math.min(100, ((stepIdx+1)/Math.max(1, steps.length)) * 100))}%` }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Topics">
                {topics.map((t) => {
                  const isSelected = selectedTopics.includes(t.id);
                  return (
                    <SelectCard
                      key={t.id}
                      role="button"
                      ariaLabel={t.label}
                      title={t.label}
                      subtitle="Select to include this."
                      selected={isSelected}
                      onSelect={() => toggleTopic(t.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {current.type === 'contact' && (
            <ContactForm
              profile={profile}
              onDraft={(p)=>{ (contactDraftRef as any).current = p; }}
            />
          )}

          {current.type === 'topic_rate' && (
            <div className="grid gap-4">
              {(() => {
                const topicId = current.meta?.topicId as string;
                const tLabel = topics.find(x=>x.id===topicId)?.label || topicId;
                const tSeverity = severities?.[topicId] ?? 0;
                return (
                  <div className="grid gap-3">
                    <div className="text-base font-semibold">{tLabel}</div>
                    <div role="radiogroup" aria-label={`${tLabel} severity`} className="flex items-center gap-3">
                      {[1,2,3,4,5].map(n => {
                        const sel = tSeverity === n;
                        return (
                          <button
                            type="button"
                            key={n}
                            role="radio"
                            aria-checked={sel}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSeverity(topicId, n); }}
                            onKeyDown={(e)=>{
                              if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setSeverity(topicId,n);} 
                              if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
                                e.preventDefault();
                                const options = [1,2,3,4,5];
                                const idx = options.indexOf(n);
                                const nextIdx = e.key==='ArrowLeft' ? (idx + options.length - 1) % options.length : (idx + 1) % options.length;
                                setSeverity(topicId, options[nextIdx]);
                              }
                            }}
                            className={[
                              'h-10 w-10 rounded-full border text-base grid place-items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                              sel ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                            ].join(' ')}
                          >{n}</button>
                        );
                      })}
                      <span className="ml-2 text-sm text-muted-foreground">1 = mild · 5 = severe</span>
                    </div>
                    <FollowUpPane
                      topicId={topicId}
                      topicLabel={tLabel}
                      severity={(tSeverity || 0) as 1|2|3|4|5}
                      value={getByPath(payload, `notes.byTopic.${topicId}`) ?? ''}
                      onChange={(text)=> setTopicNote(topicId, text)}
                      chips={(() => {
                        const key = `topic_rate:${topicId}`;
                        const ai = aiChipsMap[key] ?? [];
                        const severityChips = tSeverity >= 4
                          ? ['Top trigger right now','What “better” would look like next 2 weeks','Biggest obstacle']
                          : tSeverity >= 2
                            ? ['Typical trigger','What helps a little','What worsens it']
                            : ['What kept it low','What to keep doing'];
                        const topicSpecific: Record<string,string[]> = {
                          anx: ['Body signs (heart, sweat)','Work vs. home'],
                          dep: ['Energy/motivation','Loss of interest in…'],
                          mem: ['Forgetfulness examples','Following steps'],
                          imp: ['Interrupting or urges','Task switching'],
                          sleep: ['Bed/wake window','Awakenings/night'],
                          learn: ['Reading/math examples','Staying on task'],
                        };
                        return Array.from(new Set([...severityChips, ...ai, ...(topicSpecific[topicId]||[])])).slice(0,6);
                      })()}
                      copy={(() => {
                        const key = `topic_rate:${topicId}`;
                        const c = aiCopyMap[key];
                        if (!c) {
                          const fallback = {
                            title: `You chose ${tSeverity} for ${tLabel}`,
                            subtitle: tSeverity === 1 ? 'What kept it low?' : (tSeverity <= 3 ? 'What pushes it up or down?' : 'What makes it this high right now?'),
                            placeholder: tSeverity >= 4 ? `In 1–3 sentences: why it’s a ${tSeverity} today, and what would move it closer to a ${Math.max(0, tSeverity-2)}?` : (tSeverity >= 2 ? 'What pushes it up or down, and what helps—even a little?' : 'What kept it low, and what you want to keep doing.'),
                            questions: (() => {
                              if (tSeverity === 1) return ["What’s working that keeps this manageable?", "When does it not show up?", "What would make it a 0–1?"];
                              if (tSeverity <= 3) return ["When is it worst?", "What reliably eases it within 24h?", "Any recent triggers or changes (sleep, stress, meds)?"];
                              return [
                                `What made it a ${tSeverity} and not a ${Math.max(0,tSeverity-2)}?`,
                                "What’s the one thing that would lower it next week?",
                                "Where does it hit your day the hardest (work/home/sleep)?",
                              ];
                            })()
                          };
                          return fallback as any;
                        }
                        return c as any;
                      })()}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* No deep-dive UI in this scope */}

          {current.type === 'text' && (
            <textarea
              className="w-full min-h-[140px] rounded-md border p-3 text-base"
              placeholder="Type here"
              value={getByPath(payload, current.field) ?? ''}
              onChange={(e)=>updateField(current.field, e.target.value)}
            />
          )}
          {current.type === 'slider' && (
            <div className="space-y-3">
              <Slider
                value={[Number(getByPath(payload, current.field) ?? 0)]}
                min={current.scale === '1-5' ? 1 : 0}
                max={current.scale === '1-5' ? 5 : current.scale === 'minutes' ? 120 : 10}
                step={1}
                onValueChange={(v)=>updateField(current.field, v[0])}
              />
              <div className="text-sm text-muted-foreground">Value: {getByPath(payload, current.field) ?? 0}</div>
            </div>
          )}
          {
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Button variant="outline" onClick={prevStep} disabled={stepIdx===0}>Back</Button>
              <GlowButton
                onClick={() => {
                  if (current.id === 'contact') {
                    const draft = (contactDraftRef as any).current || {};
                    const next = structuredClone(payload);
                    next.profile = { ...(next.profile||{}), ...draft };
                    if (!next.intakeId) next.intakeId = generateIntakeIdFrom(next);
                    setPayload(next);
                    autosave(next, { silent: true });
                  }
                  nextStep();
                }}
                disabled={(current.id === 'reason' && !reasonChoice) || (current.id === 'areas_select' && (selectedTopics.length === 0)) || (current.type === 'topic_rate' && !(severities?.[current.meta?.topicId] >= 1 && severities?.[current.meta?.topicId] <= 5)) || stepIdx===steps.length-1}
              >Next</GlowButton>
              <div className="sm:ml-auto text-sm text-muted-foreground" aria-live="polite">{saving ? 'Saving…' : toast || 'Saved'}</div>
            </div>
          }
        </CardContent>
      </Card>
      </Glow>
      <div className="mt-4 text-center text-xs text-muted-foreground">Step {stepIdx+1} of {steps.length}</div>
    </div>
  );
}
