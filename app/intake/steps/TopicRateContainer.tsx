"use client";
import React from 'react';
import { TopicRateStep } from '@/app/intake/steps/TopicRateStep';
import { getGuidance as getGuidanceLib } from '@/lib/intake/guidance';
import { setByPath as setByPathLib, getByPath as getByPathLib } from '@/lib/intake/paths';

const getGuidance = getGuidanceLib;
const setByPath = setByPathLib;
const getByPath = getByPathLib;

export default function TopicRateContainer({ payload, setPayload, autosave, topics, topicId }:{ payload:any; setPayload:(p:any)=>void; autosave:(p:any,opts?:any)=>void; topics:{id:string;label:string}[]; topicId:string; }){
  const tLabel = topics.find(x=>x.id===topicId)?.label || topicId;
  const tSeverity = payload?.areas?.severity?.[topicId] ?? 0;
  const note: string = getByPath(payload, `notes.byTopic.${topicId}`) ?? '';
  const { chips } = getGuidance(topicId, tSeverity || 0);
  function setSeverity(val:number){
    const next = structuredClone(payload);
    if (!next.intakeId) next.intakeId = next.intakeId || 'local';
    const selected: string[] = Array.from(new Set([...(next.areas?.selected ?? [])]));
    if (!selected.includes(topicId)) selected.push(topicId);
    const severity = { ...(next.areas?.severity ?? {}), [topicId]: val };
    next.areas = { ...(next.areas ?? {}), selected, severity };
    const enq = (next.areas.selected ?? []).filter((t: string) => (severity?.[t] ?? 0) >= 3);
    next.queues = { ...(next.queues || {}), deepDive: Array.from(new Set(enq)) };
    setPayload(next); autosave(next,{ immediate:true, silent:true });
  }
  return (
    <TopicRateStep
      topicLabel={tLabel}
      severity={tSeverity}
      setSeverity={setSeverity}
      note={note}
      chips={chips}
      onSave={(text)=>{ const next=structuredClone(payload); setByPath(next, `notes.byTopic.${topicId}`, text); setPayload(next); autosave(next,{silent:true}); }}
      onLiveChange={()=>{}}
      onComplete={(text)=>{ const next=structuredClone(payload); setByPath(next, `notes.byTopic.${topicId}`, text); setPayload(next); autosave(next,{immediate:true,silent:true}); }}
    />
  );
}


