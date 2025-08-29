"use client";
import React from 'react';
import { TopicRateStep } from '@/app/intake/steps/TopicRateStep';
import { DEEP_ITEMS } from '@/lib/intake/deepItems';
import { setByPath as setByPathLib, getByPath as getByPathLib } from '@/lib/intake/paths';
import { SUBRATING_CONFIG } from '@/lib/intake/subratings';
import SleepShortStep from '@/app/intake/steps/SleepShortStep';
import { computeSdsPreview } from '@/lib/intake/sleep';

const setByPath = setByPathLib;
const getByPath = getByPathLib;

export default function TopicRateContainer({ payload, setPayload, autosave, topics, topicId }:{ payload:any; setPayload:(p:any)=>void; autosave:(p:any,opts?:any)=>void; topics:{id:string;label:string}[]; topicId:string; }){
  const tLabel = topics.find(x=>x.id===topicId)?.label || topicId;
  const tSeverity = payload?.areas?.severity?.[topicId] ?? 0;
  const note: string = getByPath(payload, `notes.byTopic.${topicId}`) ?? '';
  const chips: string[] = [];
  function setSeverity(val:number){
    const next = structuredClone(payload);
    if (!next.intakeId) next.intakeId = next.intakeId || 'local';
    const selected: string[] = Array.from(new Set([...(next.areas?.selected ?? [])]));
    if (!selected.includes(topicId)) selected.push(topicId);
    const severity = { ...(next.areas?.severity ?? {}), [topicId]: val };
    next.areas = { ...(next.areas ?? {}), selected, severity };
    // Mirror into psychosocial main rating (exclude headaches and chronic_pain)
    if (topicId !== 'headaches' && topicId !== 'chronic_pain') {
      setByPath(next, `psychosocial.${topicId}.severity`, val);
    }
    // Deep-dive removed; do not enqueue
    next.queues = { ...(next.queues || {}), deepDive: [] };
    setPayload(next); autosave(next,{ immediate:true, silent:true });
  }

  // Sub-ratings for supported topics (always shown; required)
  const showSubs = (SUBRATING_CONFIG[topicId] !== undefined) && topicId !== 'sleep';
  const subItems = showSubs ? (SUBRATING_CONFIG[topicId] || []).map(it => {
    const raw = getByPath(payload, `topic_subratings.${topicId}.${it.key}`);
    const num = (raw === undefined || raw === null || raw === '') ? undefined : Math.max(0, Math.min(3, Number(raw)));
    return { ...it, value: num as number | undefined };
  }) : [];
  const allSubFilled = subItems.length === 0 || subItems.every(it => typeof it.value === 'number');
  function onSetSubRating(key: string, val: number) {
    const clamped = Math.max(0, Math.min(3, Math.round(val)));
    const next = structuredClone(payload);
    setByPath(next, `topic_subratings.${topicId}.${key}`, clamped);
    // Mirror into psychosocial subratings (exclude headaches and chronic_pain)
    if (topicId !== 'headaches' && topicId !== 'chronic_pain') {
      setByPath(next, `psychosocial.${topicId}.subratings.${key}`, clamped);
    }
    setPayload(next);
    autosave(next, { silent: true });
  }
  if (topicId === 'sleep') {
    const sleep = payload?.sleep || {};
    const preview = computeSdsPreview(sleep);
    return (
      <div className="grid gap-3">
        <div className="text-base font-semibold">Sleep habits</div>
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
      </div>
    );
  }
  return (
    <TopicRateStep
      topicId={topicId}
      topicLabel={tLabel}
      severity={tSeverity}
      setSeverity={setSeverity}
      note={note}
      chips={chips}
      onSave={(text)=>{ const next=structuredClone(payload); setByPath(next, `notes.byTopic.${topicId}`, text); setPayload(next); autosave(next,{silent:true}); }}
      onLiveChange={()=>{}}
      onComplete={(text)=>{ const next=structuredClone(payload); setByPath(next, `notes.byTopic.${topicId}`, text); setPayload(next); autosave(next,{immediate:true,silent:true}); }}
      showSubRatings={showSubs}
      subItems={subItems}
      onSetSubRating={onSetSubRating}
      severityAfterSubratings={subItems.length > 0}
      showSeverity={subItems.length > 0 ? allSubFilled : true}
      severityPromptOverride={subItems.length > 0 ? `How often or how severe does this interfere in your day-to-day life?` : undefined}
    />
  );
}


