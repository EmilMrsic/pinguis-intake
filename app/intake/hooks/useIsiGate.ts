"use client";
import { useEffect } from 'react';
import { computeSdsPreview } from '@/lib/intake/sleep';

export function useIsiGate({ currentType, payload, nextStep }:{ currentType:string|undefined; payload:any; nextStep:()=>void; }){
  useEffect(() => {
    if (currentType !== 'isi') return;
    try {
      const bd = (payload?.profile?.birthdate || '').toString();
      if (!bd) return;
      const today = new Date();
      const bdt = new Date(bd);
      let age = today.getFullYear() - bdt.getFullYear();
      const m = today.getMonth() - bdt.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bdt.getDate())) age--;
      if (age < 18) { nextStep(); return; }
      const preview = computeSdsPreview(payload?.sleep||{});
      if (!preview.wouldShow && age>=18) { nextStep(); return; }
    } catch {}
  }, [currentType, payload, nextStep]);
}


