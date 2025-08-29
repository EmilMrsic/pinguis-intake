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
import TopicRateContainer from '@/app/intake/steps/TopicRateContainer';
// Deep-dive removed
import { TopicNoteField } from '@/app/intake/steps/TopicNoteField';
import DailyStep from '@/app/intake/steps/DailyStep';
import { FooterNav } from '@/components/intake/FooterNav';
import { StepHeader } from '@/components/intake/StepHeader';
import { saveIntakeAction } from './actions';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { FLOW_VARIANT } from '@/lib/intake/config';
import { devPracticeId, devClientId } from '@/lib/devIds';
import { loadIntake } from '@/lib/intake/intakeApi';
import { jumpToNextRelevantIndex, markIntakeComplete } from '@/lib/intake/helpers';
import { useAutosavePayload } from '@/app/intake/hooks/useAutosave';
import React from 'react';
import { topics as topicsCatalog } from '@/lib/intake/topics';
import { buildSteps } from '@/app/intake/utils/buildSteps';
import { DEEP_ITEMS as DEEP_ITEMS_CONST } from '@/lib/intake/deepItems';
import { getGuidance as getGuidanceLib } from '@/lib/intake/guidance';
import { uploadProfile, generateAbstractAvatar } from '@/lib/intake/intakeApi';
import { setByPath as setByPathLib, getByPath as getByPathLib } from '@/lib/intake/paths';
import SleepShortStep from '@/app/intake/steps/SleepShortStep';
import SleepIntroStep from '@/app/intake/steps/SleepIntroStep';
import CECStep from '@/app/intake/steps/CECStep';
import MetabolicStep from '@/app/intake/steps/MetabolicStep';
import BioAssessmentStep from '@/app/intake/steps/BioAssessmentStep';
import ISIStep from '@/app/intake/steps/ISIStep';
import ReviewStep from '@/app/intake/steps/ReviewStep';
import ReviewPrepareStep from '@/app/intake/steps/ReviewPrepareStep';
import { computeSdsPreview } from '@/lib/intake/sleep';
import { useIsiGate } from '@/app/intake/hooks/useIsiGate';
import { useAvatarActions } from '@/app/intake/hooks/useAvatarActions';
import { usePreparedRecaps, generateSectionRecap } from '@/app/intake/hooks/useRecapTriggers';
import AreasPrepStep from '@/app/intake/steps/AreasPrepStep';
import MedsIntroStep from '@/app/intake/steps/MedsIntroStep';
import PersonalityStep from '@/app/intake/steps/PersonalityStep';
import { SUBRATING_CONFIG } from '@/lib/intake/subratings';
import CECRemainderStep from '@/app/intake/steps/CECRemainderStep';
 

export type Step = {
  id: string;
  title: string;
  description?: string;
  type: 'singleSelect' | 'contact' | 'areas_select' | 'topic_rate' | 'slider' | 'text' | 'deep_dive' | 'daily' | 'sleep_intro' | 'sleep_short' | 'cec' | 'metabolic' | 'isi' | 'review_prepare' | 'review';
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
  const { payload, setPayload, saving, toast, autosave, updateField, payloadRef, generateIntakeIdFrom } = useAutosavePayload({});
  const [stepIdx, setStepIdx] = useState(0);
  const [loadingIntake, setLoadingIntake] = useState<boolean>(true);

  const dbg = useCallback((..._args: any[]) => {}, []);

  // Topics catalog + any custom topics added by the patient
  const builtinTopics: { id: string; label: string }[] = topicsCatalog;
  const customTopics: { id: string; label: string }[] = Array.isArray(payload?.custom_topics) ? payload.custom_topics : [];
  const topics: { id: string; label: string }[] = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const t of builtinTopics) map.set(t.id, t);
    for (const t of customTopics) if (!map.has(t.id)) map.set(t.id, t);
    return Array.from(map.values());
  }, [builtinTopics, customTopics]);

  const DEEP_ITEMS: Record<string, { key:string; label:string }[]> = DEEP_ITEMS_CONST;

  const topicPromptFallback: Record<string, string> = {};

  // If arriving via patient link, start fresh locally (but do not sign out the provider)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('asPatient') === '1') {
        setPayload({});
      }
    } catch {}
  }, []);

  // Bootstrap payload when arriving via patient link using query params (practiceId,intakeId)
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const practiceId = url.searchParams.get('practiceId');
        const intakeId = url.searchParams.get('intakeId');
        const asPatient = url.searchParams.get('asPatient') === '1';
        if (asPatient && practiceId && intakeId) {
          setLoadingIntake(true);
          const resp = await loadIntake({ practiceId, intakeId });
          if (resp?.payload) setPayload(resp.payload);
        }
      } catch {} finally { setLoadingIntake(false); }
    })();
  }, []);

  const selected = payload.areas?.selected ?? [];
  const steps: Step[] = useMemo<Step[]>(() => buildSteps(selected, topics), [selected, topics]);

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
            // Seed photo from auth if available and none saved yet
            if ((u?.photoURL || '').trim() && !(merged?.profile?.photo_url)) {
              merged.profile = { ...(merged.profile||{}), photo_url: String(u?.photoURL) };
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
  // Track last visited step in payload.progress.last_step for accurate resume
  useEffect(() => {
    try {
      const curId = current?.id;
      if (!curId) return;
      // Do not overwrite resume target while user is still on the initial screen
      if (curId === steps[0]?.id) return;
      const last = payloadRef.current?.progress?.last_step;
      if (last === curId) return;
      const next = structuredClone(payloadRef.current || {});
      next.progress = { ...(next.progress||{}), last_step: curId };
      setPayload(next);
      autosave(next, { silent: true });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);
  useAvatarActions({ payloadRef, setPayload, autosave, generateIntakeIdFrom, uploadProfile, generateAbstractAvatar });

  // autosave + updateField moved to useAutosavePayload hook

  // Deep-dive removed

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

  // Jump to last saved screen (best-effort heuristic)
  function jumpToLastSaved() {
    try {
      // Resume to explicitly tracked last_step if valid
      const lastStepId: string | undefined = payload?.progress?.last_step;
      if (lastStepId) {
        const idx = steps.findIndex(s => s.id === lastStepId);
        if (idx >= 0) { setStepIdx(idx); return; }
      }
      // If deep-dive queue exists and has values, prefer deep_dive
      const q: string[] = payload?.queues?.deepDive ?? [];
      if (Array.isArray(q) && q.length > 0) {
        const idx = steps.findIndex(s => s.id === 'deep_dive');
        if (idx >= 0) { setStepIdx(idx); return; }
      }
      // If any topic selected without severity, go to first topic_rate pending; else last topic_rate
      const pendingTopic = (payload?.areas?.selected ?? []).find((t: string) => !((payload?.areas?.severity?.[t] ?? 0) >= 1));
      if (pendingTopic) {
        const idx = steps.findIndex(s => s.id === `topic_${pendingTopic}`);
        if (idx >= 0) { setStepIdx(idx); return; }
      }
      const lastTopic = (payload?.areas?.selected ?? [])[Math.max(0, ((payload?.areas?.selected ?? []).length - 1))];
      if (lastTopic) {
        const idx = steps.findIndex(s => s.id === `topic_${lastTopic}`);
        if (idx >= 0) { setStepIdx(idx); return; }
      }
      // Otherwise if contact incomplete, go there; otherwise land on Daily (right before Sleep)
      const needContact = !(((profile.first_name||'').trim()) && ((profile.last_name||'').trim()) && ((profile.email||'').trim()));
      if (needContact) { setStepIdx(1); return; }
      const dailyIdx = steps.findIndex(s => s.id === 'daily');
      if (dailyIdx >= 0) { setStepIdx(dailyIdx); return; }
      // Fallback
      jumpToNextRelevant();
    } catch { jumpToNextRelevant(); }
  }

  const hasDeepDive = useCallback((_topicId: string) => false, []);

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
      // GAP must_include flag cleanup for headaches & chronic pain
      if (topicId === 'headaches') {
        try { if (next.gap && next.gap.must_include) delete next.gap.must_include.headaches; } catch {}
      }
      if (topicId === 'chronic_pain') {
        try { if (next.gap && next.gap.must_include) delete next.gap.must_include.chronic_pain; } catch {}
      }
    } else {
      selected.push(topicId);
      // GAP must_include flag for headaches & chronic pain
      if (topicId === 'headaches') {
        try { setByPath(next, 'gap.must_include.headaches', true); } catch {}
      }
      if (topicId === 'chronic_pain') {
        try { setByPath(next, 'gap.must_include.chronic_pain', true); } catch {}
      }
    }
    next.areas = { ...(next.areas ?? {}), selected, severity: { ...(next.areas?.severity ?? {}) } };
    const enq = selected.filter(t => hasDeepDive(t) && (next.areas.severity?.[t] ?? 0) >= 3);
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
    const enq = (next.areas.selected ?? []).filter((t: string) => hasDeepDive(t) && (severity?.[t] ?? 0) >= 3);
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
    // Ensure GAP must_include flag for headaches & chronic pain when rated
    if (topicId === 'headaches' && (severity?.headaches ?? 0) >= 1) {
      try { setByPath(next, 'gap.must_include.headaches', true); } catch {}
    }
    if (topicId === 'chronic_pain' && (severity?.chronic_pain ?? 0) >= 1) {
      try { setByPath(next, 'gap.must_include.chronic_pain', true); } catch {}
    }
    setPayload(next);
    autosave(next, { immediate: true, silent: true });
    // aiTurn disabled
  }

  function slugifyLabelToId(label: string, usedIds: Set<string>): string {
    const base = ('custom-' + String(label || ''))
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-item';
    let id = base;
    let n = 2;
    while (usedIds.has(id)) { id = `${base}-${n++}`; }
    return id;
  }

  async function addCustomTopic(label: string) {
    const txt = (label || '').trim();
    if (!txt) return;
    // Try to categorize with OpenAI
    let mappedId: string | null = null;
    try {
      const res = await fetch('/api/classify-concern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: txt }) });
      if (res.ok) {
        const data = await res.json();
        const cat = String(data?.category || '').trim();
        if (cat && topics.find(t=>t.id===cat)) mappedId = cat;
      }
    } catch {}
    const next = structuredClone(payload);
    if (!next.intakeId) next.intakeId = generateIntakeIdFrom(next);
    if (mappedId) {
      // Select the mapped existing topic and attach a note about categorization
      const selected: string[] = Array.from(new Set([...(next.areas?.selected ?? []), mappedId]));
      next.areas = { ...(next.areas ?? {}), selected, severity: { ...(next.areas?.severity ?? {}) } };
      const prev = String(next.notes?.byTopic?.[mappedId] || '');
      const annotated = prev ? `${prev}\n(User added concern categorized here: "${txt}")` : `User added concern categorized here: "${txt}"`;
      setByPath(next, `notes.byTopic.${mappedId}`, annotated);
    } else {
      // Create a new custom topic
      const used = new Set<string>([...topics.map(t=>t.id), ...Object.keys(next?.areas?.severity||{})]);
      const id = slugifyLabelToId(txt, used);
      const ct = Array.isArray(next.custom_topics) ? next.custom_topics : [];
      ct.push({ id, label: txt });
      next.custom_topics = ct;
      const selected: string[] = Array.from(new Set([...(next.areas?.selected ?? []), id]));
      next.areas = { ...(next.areas ?? {}), selected, severity: { ...(next.areas?.severity ?? {}) } };
    }
    // Recompute deep-dive queue (custom topics have no deep items by default)
    const severity = next.areas.severity || {};
    const enq = (next.areas.selected ?? []).filter((t: string) => hasDeepDive(t) && (severity?.[t] ?? 0) >= 3);
    next.queues = { ...(next.queues || {}), deepDive: Array.from(new Set(enq)) };
    setPayload(next);
    autosave(next, { immediate: true, silent: true });
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

  usePreparedRecaps({ payloadRef, steps, setStepIdx, setPayload, autosave });

  // Deep-dive removed

  useIsiGate({ currentType: current?.type, payload, nextStep });

  // Skip Sleep intro if sleep topic already handled in topic stage
  useEffect(() => {
    try {
      if (current?.id === 'sleep_intro') {
        const selected: string[] = payload?.areas?.selected || [];
        if (selected.includes('sleep')) {
          nextStep();
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, payload?.areas?.selected]);

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
          {current.id !== 'sleep_intro' && current.id !== 'meds_intro' && (
            <StepHeader
              title={current.title}
              description={current.description}
              showWelcome={stepIdx===0 && !!payload?.intakeId && !!payload?.changed}
              firstName={profile?.first_name}
              onContinue={jumpToLastSaved}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI header removed for simplicity */}
          {current.type === 'singleSelect' && (
            <ReasonStep reasonChoice={reasonChoice} setReasonChoice={setReasonChoice} />
          )}

          {current.type === 'areas_select' && (
            <AreasSelectStep topics={topics} selected={selectedTopics} toggle={toggleTopic} onAddCustom={addCustomTopic} />
          )}

          {current.id === 'areas_prep' && (
            <div className="grid gap-4">
              <AreasPrepStep selected={selectedTopics} topics={topics} />
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" onClick={prevStep}>Back</Button>
                <GlowButton onClick={nextStep}>I’m ready</GlowButton>
                <div className="sm:ml-auto text-sm text-muted-foreground" aria-live="polite">We’ll ask you focused questions</div>
              </div>
            </div>
          )}

          {current.type === 'contact' && (
            <ContactStep profile={profile} onDraft={(p)=>{ (contactDraftRef as any).current = p; }} />
          )}

          {current.type === 'topic_rate' && (
            <TopicRateContainer payload={payload} setPayload={setPayload} autosave={autosave} topics={topics} topicId={current.meta?.topicId as string} />
          )}

          {/* deep_dive removed */}

          {current.id === 'sleep_intro' && (
            <div className="grid gap-4">
              <SleepIntroStep payload={payload} />
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" onClick={prevStep}>Back</Button>
                <GlowButton onClick={nextStep}>Answer a few quick questions about your sleep</GlowButton>
                <div className="sm:ml-auto text-sm text-muted-foreground" aria-live="polite">{saving ? 'Saving…' : toast || 'Saved'}</div>
              </div>
            </div>
          )}

          {current.id === 'meds_intro' && (
            <div className="grid gap-4">
              <MedsIntroStep />
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" onClick={prevStep}>Back</Button>
                <GlowButton onClick={nextStep}>I’m ready</GlowButton>
                <div className="sm:ml-auto text-sm text-muted-foreground" aria-live="polite">We’ll ask about medications and supplements</div>
              </div>
            </div>
          )}

          {current.type === 'daily' && (
            <DailyStep
              intakeId={payload?.intakeId}
              daily={payload?.daily || {}}
              update={(rel, val)=>{
                const next = structuredClone(payload);
                if (rel === 'factors') {
                  const cleaned = Object.fromEntries(Object.entries(val||{}).filter(([_,v])=>!!v));
                  if (Object.keys(cleaned).length === 0) {
                    try { if (next.daily && typeof next.daily === 'object') delete next.daily.factors; } catch {}
                  } else {
                    setByPath(next, 'daily.factors', cleaned);
                  }
                } else {
                  setByPath(next, `daily.${rel}`, val);
                }
                setPayload(next);
                autosave(next,{ immediate: true });
              }}
              context={{ selectedTopics, severities, firstName: profile?.first_name }}
            />
          )}

          {current.id === 'personality' && (
            <div className="grid gap-4">
              <PersonalityStep
                personality={payload?.adaptive || {}}
                update={(rel, val)=>{ const next=structuredClone(payload); setByPath(next, `adaptive.${rel}`, val); setPayload(next); autosave(next,{ immediate:true, silent:true }); }}
              />
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" onClick={prevStep}>Back</Button>
                <GlowButton onClick={nextStep}>Next</GlowButton>
                <div className="sm:ml-auto text-sm text-muted-foreground" aria-live="polite">Saved</div>
              </div>
            </div>
          )}

          {current.type === 'sleep_short' && (()=>{
            // If the user already selected the sleep topic, they answered habits during sleep topic; skip this step
            const selectedTopics: string[] = payload?.areas?.selected || [];
            if (selectedTopics.includes('sleep')) return null;
            const sleep = payload?.sleep || {};
            const preview = computeSdsPreview(sleep);
            return (
            <SleepShortStep
              sleep={sleep}
              isiPreview={preview}
              update={(rel, val)=>{
                const next = structuredClone(payload);
                if (rel === 'flags') {
                  const cleaned = Object.fromEntries(Object.entries(val||{}).filter(([_,v])=>!!v));
                  if (Object.keys(cleaned).length === 0) {
                    try { if (next.sleep && typeof next.sleep === 'object') delete next.sleep.flags; } catch {}
                  } else {
                    setByPath(next, 'sleep.flags', cleaned);
                  }
                } else {
                  setByPath(next, `sleep.${rel}`, val);
                }
                setPayload(next);
                autosave(next, { immediate: true });
              }}
            />
            );})()}

          {current.type === 'cec' && (()=>{
            // Determine remaining topics not self-rated earlier (no severity set in areas.severity)
            const selectedIds: string[] = payload?.areas?.selected || [];
            const severities: Record<string, number> = payload?.areas?.severity || {};
            const allTopicIds = topics.map(t => t.id);
            const remainder = allTopicIds.filter(id => !selectedIds.includes(id) && id !== 'headaches' && id !== 'chronic_pain');
            return (
              <CECRemainderStep
                remaining={remainder}
                topics={topics}
                payload={payload}
                setPayload={setPayload}
                autosave={autosave}
                onComplete={()=> nextStep()}
              />
            );
          })()}

          {current.type === 'metabolic' && (
            <BioAssessmentStep payload={payload} setPayload={setPayload} autosave={autosave} />
          )}

          {current.type === 'isi' && (
            <ISIStep
              values={payload?.isi || {}}
              update={(id,v)=>{ const next=structuredClone(payload); setByPath(next, `isi.${id}`, v); setPayload(next); autosave(next,{silent:true}); }}
              onComplete={()=> nextStep()}
            />
          )}

          {current.id === 'review_prepare' && (
            <ReviewPrepareStep
              payload={payload}
              onBack={prevStep}
              onReady={()=>{ try { const idx=steps.findIndex(s=>s.id==='review'); if(idx>=0) setStepIdx(idx); } catch {} }}
            />
          )}

          {current.type === 'review' && (
            <>
              <ReviewStep
                recaps={payload?.recaps || {}}
                loadingSection={null}
                onEdit={(section)=>{
                  const idx = steps.findIndex(s => s.field === section || s.id === section);
                  if (idx >= 0) setStepIdx(idx);
                }}
              />
              <div className="flex items-center gap-3 pt-4">
                <Button variant="outline" onClick={prevStep}>Back</Button>
                <GlowButton tone="soft" onClick={async ()=>{ await markComplete(); setFinished(true); }}>Submit to your provider</GlowButton>
              </div>
            </>
          )}

          {current.type === 'text' && current.id !== 'review_prepare' && current.id !== 'areas_prep' && current.id !== 'meds_intro' && (
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
          {current.id !== 'sleep_intro' && current.id !== 'review_prepare' && current.id !== 'meds_intro' && current.type !== 'review' && (()=>{
            // Require subratings for configured topics before enabling Next on topic_rate screens
            let nextDisabledOverride = false;
            if (current.type === 'topic_rate') {
              try {
                const topicId = current?.meta?.topicId as string;
                const items = SUBRATING_CONFIG[topicId] || [];
                if (items.length > 0) {
                  const allFilled = items.every(it => {
                    const v = getByPath(payload, `topic_subratings.${topicId}.${it.key}`);
                    return v === 0 || v === 1 || v === 2 || v === 3;
                  });
                  // For topics with subratings, require severity chosen after subratings
                  const sev = payload?.areas?.severity?.[topicId];
                  nextDisabledOverride = !(allFilled && (sev === 1 || sev === 2 || sev === 3 || sev === 4 || sev === 5));
                }
              } catch {}
            }
            return (
          <FooterNav
            onBack={() => { prevStep(); }}
            onNext={() => {
              if (current.id === 'contact') {
                const draft = (contactDraftRef as any).current || {};
                const next = structuredClone(payload);
                next.profile = { ...(next.profile||{}), ...draft };
                if (!next.intakeId) next.intakeId = generateIntakeIdFrom(next);
                setPayload(next);
                autosave(next, { silent: true });
              }
              // deep_dive removed
              // Note: topic notes are already saved within the topic component; avoid overwriting here
              // Trigger recap generation for completed section
              void generateSectionRecap({ currentField: current.field, profileFirstName: profile?.first_name, payloadRef, setPayload, autosave });
              nextStep();
            }}
            backDisabled={stepIdx===0}
            nextDisabled={nextDisabledOverride}
            saving={saving}
            toast={toast}
            nextLabel={'Next'}
          />
            );})()}
        </CardContent>
      </Card>
      </Glow>
      <div className="mt-4 text-center text-xs">
        {(() => {
          const chapterIndex = Math.max(0, steps.findIndex(s => s.id === current?.id));
          const remaining = Math.max(0, steps.length - (chapterIndex + 1));
          const approxMinutes = Math.max(1, Math.min(20, remaining));
          const msg = current?.id === 'sleep_intro'
            ? 'Great progress! Next: a few quick sleep habits.'
            : current?.id === 'sleep_short'
              ? 'Nice work! Next: a short check‑in (CEC).'
              : 'You’re doing great — keep going.';
          return (
            <span className="text-muted-foreground">
              {msg} <span className="inline-block align-middle ml-2 rounded-full border px-2 py-0.5 bg-primary/10 text-primary border-primary/20">~{approxMinutes} min left</span>
            </span>
          );
        })()}
      </div>
    </div>
  );
}
