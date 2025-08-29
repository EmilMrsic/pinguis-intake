"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { setByPath as setByPathLib, getByPath as getByPathLib } from '@/lib/intake/paths';

const setByPath = setByPathLib;
const getByPath = getByPathLib;

type QA = { text: string };
type Category = { id: string; title: string; items: QA[] };

const CATS: Category[] = [
  { id: 'thyroid', title: 'Thyroid Function', items: [
    { text: 'Do you feel fatigued, sluggish, or have low energy throughout the day?' },
    { text: 'Do you experience difficulty losing weight despite diet and exercise?' },
    { text: 'Do you often feel cold, especially in your hands and feet?' },
    { text: 'Do you experience frequent constipation?' },
    { text: 'Do you have dry skin, brittle nails, or thinning hair?' },
  ]},
  { id: 'adrenal', title: 'Adrenal Function (Stress & Cortisol Regulation)', items: [
    { text: 'Do you feel tired but “wired” at night?' },
    { text: 'Do you wake up feeling unrefreshed, even after a full night’s sleep?' },
    { text: 'Do you feel easily overwhelmed by stress?' },
    { text: 'Do you often rely on caffeine or stimulants to get through the day?' },
    { text: 'Do you experience midday energy crashes?' },
  ]},
  { id: 'blood_sugar', title: 'Blood Sugar Regulation', items: [
    { text: 'Do you feel shaky, irritable, or lightheaded if you go too long without eating?' },
    { text: 'Do you experience energy crashes after meals?' },
    { text: 'Do you have frequent cravings for carbohydrates or sweets?' },
    { text: 'Do you feel excessively hungry, even shortly after eating?' },
    { text: 'Do you have difficulty losing weight, especially around the abdomen?' },
  ]},
  { id: 'liver', title: 'Liver Function & Detoxification', items: [
    { text: 'Do you experience frequent headaches or migraines?' },
    { text: 'Do you feel nauseous or sluggish after eating fatty foods?' },
    { text: 'Do you have trouble digesting alcohol?' },
    { text: 'Do you experience bloating, gas, or digestive discomfort?' },
    { text: 'Do you frequently have skin issues such as acne, rashes, or itching?' },
  ]},
  { id: 'gut', title: 'Gut & Digestive Health', items: [
    { text: 'Do you experience bloating or discomfort after meals?' },
    { text: 'Do you suffer from constipation, diarrhea, or alternating stool patterns?' },
    { text: 'Do you experience frequent heartburn or acid reflux?' },
    { text: 'Do you frequently experience food sensitivities or intolerances?' },
    { text: 'Do you experience brain fog or difficulty focusing after meals?' },
  ]},
  { id: 'metabolic_syndrome', title: 'Metabolic Syndrome & Inflammation', items: [
    { text: 'Do you carry excess weight around your abdomen?' },
    { text: 'Do you experience frequent joint pain or stiffness?' },
    { text: 'Do you have high blood pressure or a family history of cardiovascular disease?' },
    { text: 'Do you have a history of high cholesterol or triglycerides?' },
    { text: 'Do you wake up feeling unrested or have poor sleep quality?' },
  ]},
];

function gradeFromPercent(pct: number): 'A'|'B'|'C'|'D'|'F' {
  if (pct <= 20) return 'A';
  if (pct <= 40) return 'B';
  if (pct <= 60) return 'C';
  if (pct <= 80) return 'D';
  return 'F';
}

export default function BioAssessmentStep({
  payload,
  setPayload,
  autosave,
}: {
  payload: any;
  setPayload: (p:any)=>void;
  autosave: (p:any, opts?:any)=>void;
}) {
  const [catIdx, setCatIdx] = useState<number>(0);
  const seizureAnswered: boolean = typeof getByPath(payload, 'bio.flags.seizure') === 'boolean';

  function setSeizure(val: boolean) {
    const next = structuredClone(payload);
    setByPath(next, 'bio.flags.seizure', !!val);
    if (val === true) {
      try { setByPath(next, 'gap.must_include.seizure', true); } catch {}
    }
    setPayload(next);
    autosave(next, { immediate: true, silent: true });
  }

  const cat = CATS[Math.max(0, Math.min(catIdx, CATS.length-1))];

  function setAnswer(catId: string, itemIndex: number, kind: 'freq'|'sev', val: number, text: string) {
    const v = Math.max(0, Math.min(5, Math.round(val)));
    const next = structuredClone(payload);
    setByPath(next, `bio.responses.${catId}.${itemIndex}.${kind}`, v);
    setByPath(next, `bio.responses.${catId}.${itemIndex}.text`, text);
    setPayload(next);
    autosave(next, { immediate: true, silent: true });
  }

  useEffect(() => {
    // Compute per-category and overall scoring/grades
    try {
      const scores: Record<string, { sum: number; percent: number; grade: string }> = {};
      let totalPct = 0;
      let catCount = 0;
      for (const c of CATS) {
        let sum = 0;
        for (let i=0;i<c.items.length;i++) {
          const rf = Number(getByPath(payload, `bio.responses.${c.id}.${i}.freq`) ?? -1);
          const rs = Number(getByPath(payload, `bio.responses.${c.id}.${i}.sev`) ?? -1);
          const f = rf >= 0 && rf <= 5 ? rf : 0;
          const s = rs >= 0 && rs <= 5 ? rs : 0;
          sum += (f + s);
        }
        const percent = Math.max(0, Math.min(100, Math.round((sum / 50) * 100)));
        const grade = gradeFromPercent(percent);
        scores[c.id] = { sum, percent, grade };
        totalPct += percent; catCount += 1;
      }
      const overallPercent = catCount > 0 ? Math.round(totalPct / catCount) : 0;
      const overallGrade = gradeFromPercent(overallPercent);
      const next = structuredClone(payload);
      setByPath(next, 'bio.scores', scores);
      setByPath(next, 'bio.overall', { percent: overallPercent, grade: overallGrade });
      setPayload(next);
      autosave(next, { silent: true });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.bio?.responses]);

  function ensureDefaultsForCategory(c: typeof cat) {
    const next = structuredClone(payload);
    let changed = false;
    for (let i=0;i<c.items.length;i++) {
      const f = getByPath(next, `bio.responses.${c.id}.${i}.freq`);
      const s = getByPath(next, `bio.responses.${c.id}.${i}.sev`);
      if (f === undefined) { setByPath(next, `bio.responses.${c.id}.${i}.freq`, 0); changed = true; }
      if (s === undefined) { setByPath(next, `bio.responses.${c.id}.${i}.sev`, 0); changed = true; }
      const t = getByPath(next, `bio.responses.${c.id}.${i}.text`);
      if (!t) { setByPath(next, `bio.responses.${c.id}.${i}.text`, c.items[i].text); changed = true; }
    }
    if (changed) { setPayload(next); autosave(next, { immediate: true, silent: true }); }
  }

  function goNext() {
    ensureDefaultsForCategory(cat);
    if (catIdx < CATS.length - 1) { setCatIdx(catIdx + 1); return; }
  }
  function goBack() {
    if (catIdx > 0) { setCatIdx(catIdx - 1); }
  }

  return (
    <div className="grid gap-4">
      <div className="text-base font-semibold">Bio Assessment</div>
      <div className="grid gap-2" />

      {!seizureAnswered && (
        <div className="rounded-2xl border p-5 bg-card/60">
          <div className="text-[15px] font-medium leading-6">Have you ever experienced seizures or been diagnosed with a seizure disorder?</div>
          <div className="mt-4 inline-flex overflow-hidden rounded-full border bg-background shadow-sm">
            {['No','Yes'].map((label, idx)=> (
              <button key={label} type="button" onClick={()=> setSeizure(idx===1)} className={[ 'px-4 py-2 text-sm', idx===1 ? 'hover:bg-primary/10 hover:text-primary' : 'hover:bg-accent' ].join(' ')}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {seizureAnswered && (
        <div className="rounded-2xl border p-5 bg-card/60">
          <div className="text-[12px] text-muted-foreground mb-3">Section {catIdx+1} of {CATS.length}</div>
          <div className="grid gap-4">
            {cat.items.map((q, i) => {
              const f = Number(getByPath(payload, `bio.responses.${cat.id}.${i}.freq`) ?? 0);
              const s = Number(getByPath(payload, `bio.responses.${cat.id}.${i}.sev`) ?? 0);
              return (
                <div key={i} className="grid gap-2">
                  <div className="text-[15px] font-medium leading-6">{q.text}</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Frequency (0–5)</div>
                      <div className="inline-flex overflow-hidden rounded-full border bg-background shadow-sm">
                        {[0,1,2,3,4,5].map(n => (
                          <button key={n} type="button" aria-pressed={f===n} onClick={()=>setAnswer(cat.id, i, 'freq', n, q.text)} className={[ 'px-3 py-1.5 text-sm', f===n ? 'bg-primary/10 text-primary' : 'hover:bg-accent' ].join(' ')}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Severity (0–5)</div>
                      <div className="inline-flex overflow-hidden rounded-full border bg-background shadow-sm">
                        {[0,1,2,3,4,5].map(n => (
                          <button key={n} type="button" aria-pressed={s===n} onClick={()=>setAnswer(cat.id, i, 'sev', n, q.text)} className={[ 'px-3 py-1.5 text-sm', s===n ? 'bg-primary/10 text-primary' : 'hover:bg-accent' ].join(' ')}>{n}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={goBack} className="text-xs text-muted-foreground hover:underline">Previous</button>
            <button type="button" onClick={goNext} className="text-xs text-primary">Next section</button>
          </div>
        </div>
      )}
    </div>
  );
}


