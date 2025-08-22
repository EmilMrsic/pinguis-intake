"use client";
import React, { useEffect, useState } from 'react';
import { DeepDiveStep } from '@/app/intake/steps/DeepDiveStep';
import { DEEP_ITEMS as DEEP_ITEMS_CONST } from '@/lib/intake/deepItems';
import { setByPath as setByPathLib, getByPath as getByPathLib } from '@/lib/intake/paths';

const setByPath = setByPathLib;
const getByPath = getByPathLib;

export default function DeepDiveContainer({
  payload,
  topics,
  setPayload,
  autosave,
}: {
  payload: any;
  topics: { id:string; label:string }[];
  setPayload: (p:any)=>void;
  autosave: (p:any,opts?:any)=>void;
}) {
  const q: string[] = payload?.queues?.deepDive ?? [];
  const [ddIndex, setDdIndex] = useState(0);
  useEffect(()=>{ setDdIndex(0); if(q.length===0){ /* parent will nextStep */ } },[q.length]);
  const topicId = q[Math.max(0, Math.min(ddIndex, Math.max(0,q.length-1)))];
  if (!topicId) return null;
  const topicLabel = topics.find(t=>t.id===topicId)?.label || topicId;

  const [ddDraft, setDdDraft] = useState<Record<string, number>>({});
  const [ddWhyDraft, setDdWhyDraft] = useState<Record<string, string>>({});

  const values: Record<string, number> = Object.fromEntries(
    (DEEP_ITEMS_CONST[topicId]||[]).map(it => {
      const ddKey = `${topicId}.${it.key}`;
      const draft = ddDraft[ddKey];
      const persisted = Number(getByPath(payload, `deepdive.${topicId}.${it.key}`) ?? 0);
      return [it.key, typeof draft === 'number' ? draft : persisted];
    })
  );
  const whyVals: Record<string, string> = Object.fromEntries(
    (DEEP_ITEMS_CONST[topicId]||[]).map(it => {
      const ddKey = `${topicId}.${it.key}`;
      const draft = ddWhyDraft[ddKey];
      const persisted = String(getByPath(payload, `deepdive_meta.${topicId}.${it.key}.why`) ?? '');
      return [it.key, typeof draft === 'string' ? draft : persisted];
    })
  );

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
  }

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
}


