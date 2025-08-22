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
import { DeepDiveStep } from '@/app/intake/steps/DeepDiveStep';
import DeepDiveContainer from '@/app/intake/steps/DeepDiveContainer';
import { TopicNoteField } from '@/app/intake/steps/TopicNoteField';
import DailyStep from '@/app/intake/steps/DailyStep';
import { FooterNav } from '@/components/intake/FooterNav';
import { StepHeader } from '@/components/intake/StepHeader';
import { saveIntakeAction } from './actions';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { FLOW_VARIANT } from '@/lib/intake/config';
import { devPracticeId, devClientId } from '@/lib/devIds';
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
import ISIStep from '@/app/intake/steps/ISIStep';
import ReviewStep from '@/app/intake/steps/ReviewStep';
import ReviewPrepareStep from '@/app/intake/steps/ReviewPrepareStep';
import { computeSdsPreview } from '@/lib/intake/sleep';
import { useIsiGate } from '@/app/intake/hooks/useIsiGate';
import { useAvatarActions } from '@/app/intake/hooks/useAvatarActions';
import { usePreparedRecaps, generateSectionRecap } from '@/app/intake/hooks/useRecapTriggers';
 

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

  // Topics catalog
  const topics: { id: string; label: string }[] = topicsCatalog;

  const DEEP_ITEMS: Record<string, { key:string; label:string }[]> = DEEP_ITEMS_CONST;

  const topicPromptFallback: Record<string, string> = {};

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

  usePreparedRecaps({ payloadRef, steps, setStepIdx, setPayload, autosave });

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

  useIsiGate({ currentType: current?.type, payload, nextStep });

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
          {current.id !== 'sleep_intro' && (
            <StepHeader title={current.title} description={current.description} showWelcome={stepIdx===0 && !!payload?.intakeId} firstName={profile?.first_name} onContinue={jumpToLastSaved} />
          )}
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

          {current.type === 'topic_rate' && (
            <TopicRateContainer payload={payload} setPayload={setPayload} autosave={autosave} topics={topics} topicId={current.meta?.topicId as string} />
          )}

          {current.type === 'deep_dive' && (
            <DeepDiveContainer payload={payload} topics={topics} setPayload={setPayload} autosave={autosave} />
          )}

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

          {current.type === 'sleep_short' && (()=>{
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

          {current.type === 'cec' && (
            <CECStep
              values={payload?.cec || {}}
              update={(id, v)=>{ const next=structuredClone(payload); setByPath(next, `cec.${id}`, v); setPayload(next); autosave(next,{silent:true}); }}
              onComplete={()=> nextStep()}
            />
          )}

          {current.type === 'metabolic' && (
            <MetabolicStep
              metabolic={payload?.metabolic || {}}
              firstName={profile?.first_name}
              update={(rel,val)=>{ 
                const next=structuredClone(payload);
                if (rel === 'caffeine_clear') {
                  try {
                    if (next.metabolic && typeof next.metabolic === 'object') {
                      delete next.metabolic.caffeine_text;
                      delete next.metabolic.caffeine_followup;
                      delete next.metabolic.caffeine_choice;
                      delete next.metabolic.caffeine_choice_multi;
                      delete next.metabolic.daily_caffeine_amount;
                      delete next.metabolic.daily_caffeine_mg;
                      delete next.metabolic.caffeine_simple;
                      delete next.metabolic.caffeine_context;
                    }
                  } catch {}
                } else {
                  setByPath(next, `metabolic.${rel}`, val);
                }
                setPayload(next);
                autosave(next,{silent:true});
              }}
            />
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

          {current.type === 'text' && current.id !== 'review_prepare' && (
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
          {current.id !== 'sleep_intro' && current.id !== 'review_prepare' && current.type !== 'review' && (
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
              // Trigger recap generation for completed section
              void generateSectionRecap({ currentField: current.field, profileFirstName: profile?.first_name, payloadRef, setPayload, autosave });
              nextStep();
            }}
            backDisabled={stepIdx===0}
            nextDisabled={false}
            saving={saving}
            toast={toast}
            nextLabel={'Next'}
          />
          )}
        </CardContent>
      </Card>
      </Glow>
      <div className="mt-4 text-center text-xs text-muted-foreground">
        {current?.id === 'sleep_intro'
          ? 'Great progress! Next: a few quick sleep habits.'
          : current?.id === 'sleep_short'
            ? 'Nice work! Next: a short check‑in (CEC).'
            : 'You’re doing great — keep going.'}
      </div>
    </div>
  );
}
