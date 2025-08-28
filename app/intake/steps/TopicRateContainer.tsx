"use client";
import React from 'react';
import { TopicRateStep } from '@/app/intake/steps/TopicRateStep';
import { DEEP_ITEMS } from '@/lib/intake/deepItems';
import { setByPath as setByPathLib, getByPath as getByPathLib } from '@/lib/intake/paths';

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
    // Deep-dive removed; do not enqueue
    next.queues = { ...(next.queues || {}), deepDive: [] };
    // If dropping below threshold, clear dependent subratings for configured topics
    if (val < 3) {
      try {
        if (next.topic_subratings && next.topic_subratings[topicId]) delete next.topic_subratings[topicId];
      } catch {}
    }
    setPayload(next); autosave(next,{ immediate:true, silent:true });
  }

  // Conditional sub-ratings for supported topics when severity >= 3
  const subConfig: Record<string, { key: string; label: string }[]> = {
    dep: [
      { key: 'sadness_hopelessness', label: 'I experience deep bouts of sadness or hopelessness.' },
      { key: 'low_motivation', label: 'I feel little motivation or drive for things I used to enjoy.' },
      { key: 'emotional_swings', label: 'I swing rapidly between emotional highs and lows.' },
      { key: 'elated_invincible', label: 'I feel overly elated or invincible at times.' },
      { key: 'mistrust_others', label: 'I believe others are out to misread or take advantage of me.' },
      { key: 'emotion_regulation', label: 'I struggle to keep my emotions in check.' },
    ],
    addictive: [
      { key: 'strong_cravings', label: 'I experience strong urges or cravings.' },
      { key: 'loss_of_control', label: 'I use more than I intend or for longer than planned.' },
      { key: 'difficulty_cutting_back', label: 'I find it hard to cut back even when I try.' },
      { key: 'withdrawal_discomfort', label: 'I feel unwell, restless, or irritable when I stop.' },
      { key: 'tolerance_increase', label: 'I need more to get the same effect.' },
      { key: 'impact_responsibilities', label: 'It impacts my responsibilities or relationships.' },
    ],
    trauma: [
      { key: 'distressing_recall', label: 'I\'ve experienced events that still cause me distress when I recall them.' },
      { key: 'past_injuries_affect_today', label: 'Physical injuries in my past affect how I feel today.' },
      { key: 'avoidance_reminders', label: 'I avoid places, people, or reminders linked to past events.' },
      { key: 'hypervigilance_startle', label: 'I feel on edge or startle easily.' },
      { key: 'nightmares_intrusive', label: 'I have nightmares or intrusive dreams about past events.' },
    ],
    focus: [
      { key: 'mind_wanders_conversations', label: 'My mind frequently wanders during conversations.' },
      { key: 'lose_interest_dull_tasks', label: 'I lose interest quickly in tasks I find dull.' },
      { key: 'difficulty_multitasking', label: 'I have difficulty juggling more than one task at a time.' },
      { key: 'reread_text_multiple_times', label: 'I reread simple text multiple times before it makes sense.' },
      { key: 'stuck_same_approach', label: 'I get stuck using the same approach even when it’s not working.' },
      { key: 'hard_switch_gears', label: 'I find it hard to switch gears between different topics.' },
      { key: 'chronically_disorganized', label: 'My workspace or thoughts feel chronically disorganized.' },
      { key: 'messy_handwriting', label: 'My handwriting is often messy or hard to read.' },
    ],
  };
  const showSubs = (subConfig[topicId] !== undefined) && (Number(tSeverity) >= 3);
  const subItems = showSubs ? (subConfig[topicId] || []).map(it => ({ ...it, value: Number(getByPath(payload, `topic_subratings.${topicId}.${it.key}`) ?? 0) })) : [];
  function onSetSubRating(key: string, val: number) {
    const clamped = Math.max(0, Math.min(3, Math.round(val)));
    const next = structuredClone(payload);
    setByPath(next, `topic_subratings.${topicId}.${key}`, clamped);
    setPayload(next);
    autosave(next, { silent: true });
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
    />
  );
}


