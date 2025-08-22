"use client";
import { useEffect } from 'react';

export function usePreparedRecaps({ payloadRef, steps, setStepIdx, setPayload, autosave }:{ payloadRef: React.MutableRefObject<Record<string, any>>; steps: { id:string }[]; setStepIdx:(n:number)=>void; setPayload:(p:any)=>void; autosave:(p:any,opts?:any)=>void; }){
  useEffect(() => {
    function onReady(ev: any) {
      try {
        const recaps = ev?.detail?.recaps || {};
        const snap = structuredClone(payloadRef.current||{});
        snap.recaps = { ...(snap.recaps||{}), ...recaps };
        setPayload(snap); autosave(snap, { immediate: true, silent: true });
        const idx = steps.findIndex(s => s.id === 'review');
        if (idx >= 0) setStepIdx(idx);
      } catch {}
    }
    try { window.addEventListener('review-recaps-ready', onReady as any); } catch {}
    return () => { try { window.removeEventListener('review-recaps-ready', onReady as any); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export async function generateSectionRecap({ currentField, profileFirstName, payloadRef, setPayload, autosave }:{ currentField: string; profileFirstName?: string; payloadRef: React.MutableRefObject<Record<string, any>>; setPayload:(p:any)=>void; autosave:(p:any,opts?:any)=>void; }){
  try {
    const section = currentField;
    const inputs = get(payloadRef.current, section);
    const res = await fetch('/api/section-recap', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ section, inputs, name: profileFirstName||'' }) });
    const data = await res.json().catch(()=>({}));
    if (data?.recap) {
      const snap = structuredClone(payloadRef.current||{});
      snap.recaps = { ...(snap.recaps||{}), [section]: data.recap };
      setPayload(snap); autosave(snap, { silent: true });
    }
  } catch {}
}

function get(obj:any, path:string){ try{ return path.split('.').reduce((a,k)=> a?.[k], obj);}catch{return undefined;} }


