"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Glow } from '@/components/intake/Glow';
import { GlowButton } from '@/components/intake/GlowButton';
import { ReasonStep } from '@/app/intake/steps/ReasonStep';
import { ContactStep } from '@/app/intake/steps/ContactStep';
import { AreasSelectStep } from '@/app/intake/steps/AreasSelectStep';
import { TopicRateStep } from '@/app/intake/steps/TopicRateStep';
import { DeepDiveStep } from '@/app/intake/steps/DeepDiveStep';
import { TopicNoteField } from '@/app/intake/steps/TopicNoteField';
import { FooterNav } from '@/components/intake/FooterNav';
import { StepHeader } from '@/components/intake/StepHeader';
import { saveIntakeAction } from './actions';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { FLOW_VARIANT } from '@/lib/intake/config';
import { devPracticeId, devClientId } from '@/lib/devIds';
import { jumpToNextRelevantIndex, markIntakeComplete } from '@/lib/intake/helpers';
import React from 'react';
import { topics as topicsCatalog } from '@/lib/intake/topics';
import { DEEP_ITEMS as DEEP_ITEMS_CONST } from '@/lib/intake/deepItems';
import { getGuidance as getGuidanceLib } from '@/lib/intake/guidance';
import { setByPath as setByPathLib, getByPath as getByPathLib } from '@/lib/intake/paths';
 

export type Step = {
  id: string;
  title: string;
  description?: string;
  type: 'singleSelect' | 'contact' | 'areas_select' | 'topic_rate' | 'slider' | 'text' | 'deep_dive' | 'daily' | 'sleep_short' | 'cec' | 'metabolic' | 'isi' | 'review';
  field: string; // dot path in payload
  scale?: '0-10'|'1-5'|'minutes';
  meta?: Record<string, any>;
};

const baseSteps: Step[] = [
  { id:'reason', title:"Let's start simple — what's your focus?", description:"We'll tailor what comes next to match your choice.", type:'singleSelect', field:'story.reason_choice' },
  { id:'contact', title:'Quick contact details', description:'This helps us keep you updated about scheduling.', type:'contact', field:'profile' },
  { id:'areas_select', title:'What would you like to focus on?', description:'Pick one or more.', type:'areas_select', field:'areas' },
];

const setByPath = setByPathLib;
const getByPath = getByPathLib;

const getGuidance = getGuidanceLib;

export default function Flow() {
  const [payload, setPayload] = useState<Record<string, any>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [loadingIntake, setLoadingIntake] = useState<boolean>(true);

  const dbg = useCallback((..._args: any[]) => {}, []);

  // Topics catalog
  const topics: { id: string; label: string }[] = topicsCatalog;

  const DEEP_ITEMS: Record<string, { key:string; label:string }[]> = DEEP_ITEMS_CONST;

  const topicPromptFallback: Record<string, string> = {};

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
  const steps: Step[] = useMemo<Step[]>(() => [
    baseSteps[0],
    baseSteps[1],
    baseSteps[2],
    ...topicSteps,
    { id:'deep_dive', title:'Quick zoom-in', description:'0 = not at all · 10 = severe', type:'deep_dive', field:'deepdive' },
    { id:'daily',       title:'Daily habits & health', type:'daily', field:'daily' },
    { id:'sleep_short', title:'Sleep (short form)', type:'sleep_short', field:'sleep' },
    { id:'cec',         title:'CEC questionnaire', type:'cec', field:'cec' },
    { id:'metabolic',   title:'Metabolic', type:'metabolic', field:'metabolic' },
    { id:'isi',         title:'Insomnia Severity Index (18+)', type:'isi', field:'isi' },
    { id:'review',      title:'Review & submit', type:'review', field:'review' },
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

  const intakeId = payload?.intakeId ?? `${devPracticeId}:${devClientId}`;
  const aiNotesTimerRef = useRef<Record<string, any>>({});
  const isTypingRef = useRef<boolean>(false);
  const typingResetTimer = useRef<any>(null);
  const hydratedRef = useRef<boolean>(false);
  const payloadRef = useRef<Record<string, any>>({});
  useEffect(() => { payloadRef.current = payload; }, [payload]);

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
    dbg('updateField', { path, value });
  }

  function setDeepDive(topicId: string, itemKey: string, val: number) {
    const next = structuredClone(payload);
    setByPath(next, `deepdive.${topicId}.${itemKey}`, val);
    const field = `deepdive.${topicId}.${itemKey}`;
    const entry = { field, topic: topicId, value: val } as any;
    const existing = Array.isArray(next.tracker?.candidates) ? next.tracker.candidates : [];
    const map = new Map(existing.map((r: any) => [r.field, r]));
    if (val >= 6) map.set(field, entry); else map.delete(field);
    next.tracker = { ...(next.tracker||{}), candidates: Array.from(map.values()) };
    setPayload(next);
    autosave(next);
    dbg('deepDive:set', { topicId, itemKey, val });
    // optional AI notify
    // aiTurn disabled
  }

  function nextStep() { if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1); }
  function prevStep() { if (stepIdx > 0) setStepIdx(stepIdx - 1); }

  // Mark complete helper (call on final submit later)
  async function markComplete() {
    try { await markIntakeComplete({ practiceId: devPracticeId, clientId: devClientId, intakeId: payload?.intakeId, payload }); } catch {}
  }

  // using Glow and GlowButton from components/intake

  // TopicNoteField imported from components/intake

  // Contact form removed; using ContactStep component

  // Jump helper for "Continue your intake"
  function jumpToNextRelevant() {
    try {
      const targetIdx = jumpToNextRelevantIndex({ reasonChoice, profile, selectedTopics, severities, steps });
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
      // cleanup deep-dive data and tracker entries for this topic
      if (next.deepdive && typeof next.deepdive === 'object') {
        delete next.deepdive[topicId];
      }
      if (next.deepdive_meta && typeof next.deepdive_meta === 'object') {
        delete next.deepdive_meta[topicId];
      }
      if (Array.isArray(next.tracker?.candidates)) {
        const filtered = next.tracker.candidates.filter((r: any) => !(typeof r?.field === 'string' && r.field.startsWith(`deepdive.${topicId}.`)));
        next.tracker = { ...(next.tracker||{}), candidates: filtered };
      }
    } else {
      selected.push(topicId);
    }
    next.areas = { ...(next.areas ?? {}), selected, severity: { ...(next.areas?.severity ?? {}) } };
    const enq = selected.filter(t => (next.areas.severity?.[t] ?? 0) >= 3);
    next.queues = { ...(next.queues || {}), deepDive: Array.from(new Set(enq)) };
    setPayload(next);
    autosave(next, { immediate: true, silent: true });
    // aiTurn disabled
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
    // if severity drops below 3, cleanup deep-dive and related trackers for this topic
    if ((severity?.[topicId] ?? 0) < 3) {
      if (next.deepdive && typeof next.deepdive === 'object') {
        delete next.deepdive[topicId];
      }
      if (next.deepdive_meta && typeof next.deepdive_meta === 'object') {
        delete next.deepdive_meta[topicId];
      }
      if (Array.isArray(next.tracker?.candidates)) {
        const filtered = next.tracker.candidates.filter((r: any) => !(typeof r?.field === 'string' && r.field.startsWith(`deepdive.${topicId}.`)));
        next.tracker = { ...(next.tracker||{}), candidates: filtered };
      }
    }
    setPayload(next);
    autosave(next, { immediate: true, silent: true });
    // aiTurn disabled
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
    aiNotesTimerRef.current[topicId] = setTimeout(() => {}, 2500);
  }

  function setReasonChoice(v: 'problem' | 'peak') {
    const next = structuredClone(payload);
    setByPath(next, 'story.reason_choice', v);
    setByPath(next, 'story.flow_variant', v);
    setPayload(next);
    autosave(next);
    // aiTurn disabled
  }

  const selectedTopics: string[] = payload.areas?.selected ?? [];
  const severities: Record<string, number> = payload.areas?.severity ?? {};
  const reasonChoice: 'problem' | 'peak' | undefined = payload.story?.reason_choice;
  const profile = payload.profile ?? {};
  const contactDraftRef = useRef<any>(profile);
  const [ddIndex, setDdIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [lastAssistant, setLastAssistant] = useState<string>('');
  const [topicNoteLocal, setTopicNoteLocal] = useState<string>('');
  const [topicNoteTopicId, setTopicNoteTopicId] = useState<string>('');
  const [ddDraft, setDdDraft] = useState<Record<string, number>>({});
  const [ddWhyDraft, setDdWhyDraft] = useState<Record<string, string>>({});
  const [chipHint, setChipHint] = useState<boolean>(false);
  const topicNoteLatestRef = useRef<string>('');
  // recompute queue is handled on severity change; no deep-dive UI in this scope
  // AI call helper
  const aiTurn = useCallback(async () => {}, []);
  // Clamp stepIdx if selection changes and steps shrink
  useEffect(() => {
    if (stepIdx >= steps.length) {
      setStepIdx(Math.max(0, steps.length - 1));
    }
  }, [steps.length, stepIdx]);

  useEffect(() => {}, [current?.id]);

  // When entering deep_dive, handle skip if no queue; reset ddIndex
  useEffect(() => {
    if (current?.type !== 'deep_dive') return;
    const q = payload?.queues?.deepDive ?? [];
    setDdIndex(0);
    if (q.length === 0) {
      nextStep();
      return;
    }
    // For peak variant, same rule: only proceed if any were enqueued (already handled by q.length check)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.type]);

  // Auto-skip ISI if under 18
  useEffect(() => {
    if (current?.type !== 'isi') return;
    try {
      const bd = (payload?.profile?.birthdate || '').toString();
      if (!bd) return;
      const today = new Date();
      const bdt = new Date(bd);
      let age = today.getFullYear() - bdt.getFullYear();
      const m = today.getMonth() - bdt.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bdt.getDate())) age--;
      if (age < 18) nextStep();
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.type]);

  // Keep topic note local state in sync when topic changes
  useEffect(() => {
    if (current?.type !== 'topic_rate') return;
    const topicId = current?.meta?.topicId as string;
    if (topicId && topicId !== topicNoteTopicId) {
      const existing: string = getByPath(payload, `notes.byTopic.${topicId}`) ?? '';
      setTopicNoteTopicId(topicId);
      setTopicNoteLocal(existing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // no deep-dive items in this scope

  return (
    <div className="mx-auto w-full max-w-screen-sm sm:max-w-screen-md lg:max-w-screen-lg px-4 sm:px-6 lg:px-8 py-8">
      <Glow>
      <Card className="relative">
        <CardHeader>
          <StepHeader title={current.title} description={current.description} showWelcome={stepIdx===0 && !!payload?.intakeId} firstName={profile?.first_name} onContinue={jumpToNextRelevant} />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI header removed for simplicity */}
          {current.type === 'singleSelect' && (
            <ReasonStep reasonChoice={reasonChoice} setReasonChoice={setReasonChoice} />
          )}

          {current.type === 'areas_select' && (
            <AreasSelectStep selected={selectedTopics} toggle={toggleTopic} />
          )}

          {current.type === 'contact' && (
            <ContactStep profile={profile} onDraft={(p)=>{ (contactDraftRef as any).current = p; }} />
          )}

          {current.type === 'topic_rate' && (() => {
            const topicId = current.meta?.topicId as string;
            const tLabel = topics.find(x=>x.id===topicId)?.label || topicId;
            const tSeverity = severities?.[topicId] ?? 0;
            const note: string = getByPath(payload, `notes.byTopic.${topicId}`) ?? '';
            const { chips } = getGuidance(topicId, tSeverity || 0);
            return (
              <TopicRateStep
                topicLabel={tLabel}
                severity={tSeverity}
                setSeverity={(n)=>setSeverity(topicId, n)}
                note={note}
                chips={chips}
                onSave={(text)=>{ const next=structuredClone(payload); setByPath(next, `notes.byTopic.${topicId}`, text); setPayload(next); autosave(next,{silent:true}); topicNoteLatestRef.current = text; }}
                onLiveChange={(text)=>{ topicNoteLatestRef.current = text; }}
                onComplete={(text)=>{ const next=structuredClone(payload); setByPath(next, `notes.byTopic.${topicId}`, text); setPayload(next); autosave(next,{immediate:true,silent:true}); setLastAssistant(text?`You noted: ${text.slice(0,180)}${text.length>180?'…':''}`:''); nextStep(); }}
              />
            );
          })()}

          {current.type === 'deep_dive' && (() => {
            const q: string[] = payload?.queues?.deepDive ?? [];
            if (!Array.isArray(q) || q.length === 0) return null;
            const topicId = q[Math.max(0, Math.min(ddIndex, q.length - 1))];
            const topicLabel = topics.find(t=>t.id===topicId)?.label || topicId;
            // Merge live draft values for smooth, continuous slider control
            const values: Record<string, number> = Object.fromEntries(
              (DEEP_ITEMS[topicId]||[]).map(it => {
                const ddKey = `${topicId}.${it.key}`;
                const draft = ddDraft[ddKey];
                const persisted = Number(getByPath(payload, `deepdive.${topicId}.${it.key}`) ?? 0);
                return [it.key, typeof draft === 'number' ? draft : persisted];
              })
            );
            const whyVals: Record<string, string> = Object.fromEntries(
              (DEEP_ITEMS[topicId]||[]).map(it => {
                const ddKey = `${topicId}.${it.key}`;
                const draft = ddWhyDraft[ddKey];
                const persisted = String(getByPath(payload, `deepdive_meta.${topicId}.${it.key}.why`) ?? '');
                return [it.key, typeof draft === 'string' ? draft : persisted];
              })
            );
            return (
              <DeepDiveStep
                topicId={topicId}
                topicLabel={topicLabel}
                values={values}
                onChange={(itemKey,n)=>{ const ddKey=`${topicId}.${itemKey}`; setDdDraft((d)=>({ ...d, [ddKey]: n })); }}
                onCommit={(itemKey,n)=>{ setDeepDive(topicId, itemKey, n); const ddKey=`${topicId}.${itemKey}`; setDdDraft((d)=>({ ...d, [ddKey]: n })); }}
                why={whyVals}
                onWhyChange={(itemKey,t)=>{ const ddKey=`${topicId}.${itemKey}`; setDdWhyDraft((m)=>({ ...m, [ddKey]: t })); }}
                onWhyCommit={(itemKey,t)=>{ const next=structuredClone(payload); setByPath(next, `deepdive_meta.${topicId}.${itemKey}.why`, (t||'').trim()); setPayload(next); autosave(next,{silent:true}); }}
              />
            );
          })()}

          {current.type === 'daily' && (
            <div className="grid gap-4">
              <div className="text-sm text-muted-foreground">Daily habits & health — coming soon.</div>
            </div>
          )}

          {current.type === 'sleep_short' && (
            <div className="grid gap-4">
              <div className="text-sm text-muted-foreground">Short sleep form — coming soon.</div>
            </div>
          )}

          {current.type === 'cec' && (
            <div className="grid gap-4">
              <div className="text-sm text-muted-foreground">CEC questionnaire — coming soon.</div>
            </div>
          )}

          {current.type === 'metabolic' && (
            <div className="grid gap-4">
              <div className="text-sm text-muted-foreground">Metabolic — coming soon.</div>
            </div>
          )}

          {current.type === 'isi' && (
            <div className="grid gap-4">
              <div className="text-sm text-muted-foreground">Insomnia Severity Index — coming soon.</div>
            </div>
          )}

          {current.type === 'review' && (
            <div className="grid gap-4">
              <div className="text-sm text-muted-foreground">Review & submit — coming soon.</div>
              <div>
                <GlowButton onClick={async ()=>{ await markComplete(); setFinished(true); }} disabled={finished}>Finish</GlowButton>
              </div>
            </div>
          )}

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
                step={0.1}
                onValueChange={(v)=>updateField(current.field, v[0])}
                onValueCommit={(v)=>updateField(current.field, Math.round(v[0]))}
              />
              <div className="text-sm text-muted-foreground">Value: {Math.round(getByPath(payload, current.field) ?? 0)}</div>
            </div>
          )}
          <FooterNav
            onBack={() => {
              if (current.type === 'deep_dive') {
                if (ddIndex > 0) setDdIndex(ddIndex - 1); else prevStep();
                return;
              }
              prevStep();
            }}
            onNext={() => {
              if (current.id === 'contact') {
                const draft = (contactDraftRef as any).current || {};
                const next = structuredClone(payload);
                next.profile = { ...(next.profile||{}), ...draft };
                if (!next.intakeId) next.intakeId = generateIntakeIdFrom(next);
                setPayload(next);
                autosave(next, { silent: true });
              }
              if (current.type === 'deep_dive') {
                const q: string[] = payload?.queues?.deepDive ?? [];
                // Commit any outstanding draft values before navigating
                try {
                  const topicId = q[Math.max(0, Math.min(ddIndex, q.length - 1))];
                  const entries = Object.entries(ddDraft).filter(([k]) => k.startsWith(`${topicId}.`));
                  for (const [k, v] of entries) {
                    const itemKey = k.split('.').slice(1).join('.');
                    if (typeof v === 'number') setDeepDive(topicId, itemKey, v as number);
                  }
                  // Commit any outstanding draft WHY text
                  const whyEntries = Object.entries(ddWhyDraft).filter(([k]) => k.startsWith(`${topicId}.`));
                  if (whyEntries.length > 0) {
                    const next = structuredClone(payload);
                    for (const [k, v] of whyEntries) {
                      const itemKey = k.split('.').slice(1).join('.');
                      setByPath(next, `deepdive_meta.${topicId}.${itemKey}.why`, String(v||'').trim());
                    }
                    setPayload(next);
                    autosave(next, { silent: true });
                  }
                } catch {}
                if (ddIndex < Math.max(0, q.length - 1)) setDdIndex(ddIndex + 1); else nextStep();
                return;
              }
              if (current.type === 'topic_rate') {
                const topicId = current.meta?.topicId as string;
                const text = (topicNoteLatestRef.current || '').trim();
                const next = structuredClone(payload);
                setByPath(next, `notes.byTopic.${topicId}`, text);
                setPayload(next);
                autosave(next, { immediate: true, silent: true });
              }
              nextStep();
            }}
            backDisabled={stepIdx===0}
            nextDisabled={(current.id === 'reason' && !reasonChoice) || (current.id === 'areas_select' && (selectedTopics.length === 0)) || (current.type === 'topic_rate' && !(severities?.[current.meta?.topicId] >= 1 && severities?.[current.meta?.topicId] <= 5)) || stepIdx===steps.length-1}
            saving={saving}
            toast={toast}
          />
        </CardContent>
      </Card>
      </Glow>
      <div className="mt-4 text-center text-xs text-muted-foreground">Step {stepIdx+1} of {steps.length}</div>
    </div>
  );
}
