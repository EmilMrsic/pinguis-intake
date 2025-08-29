"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';

type Item = { text: string; reverse?: boolean };
type Cat = { id: string; title: string; items: Item[] };

const CATS: Cat[] = [
  { id: 'stress', title: 'Stress', items: [
    { text: 'I often feel overwhelmed by responsibilities.' },
    { text: 'Small problems quickly build up and feel unmanageable.' },
    { text: 'I find it hard to relax after a stressful day.' },
    { text: 'I feel constantly under pressure, even with small tasks.' },
  ]},
  { id: 'mood', title: 'Mood', items: [
    { text: 'I generally feel cheerful and optimistic.', reverse: true },
    { text: 'I experience frequent feelings of sadness or irritability.' },
    { text: 'I have trouble enjoying activities I used to love.' },
    { text: 'I look forward to each day with a positive attitude.', reverse: true },
  ]},
  { id: 'relaxed', title: 'Relaxed', items: [
    { text: 'I can stay calm when plans suddenly change.', reverse: true },
    { text: 'I often feel tense or restless.' },
    { text: 'I roll with unexpected changes without stress.', reverse: true },
    { text: 'Little things easily upset me.' },
  ]},
  { id: 'inhibited', title: 'Inhibited', items: [
    { text: 'I hold back my opinions to avoid conflict.' },
    { text: 'I hesitate to share my true feelings.' },
    { text: 'I avoid attention even when I have something to contribute.' },
    { text: 'I feel anxious speaking up in groups.' },
  ]},
  { id: 'regulated', title: 'Regulated', items: [
    { text: 'I pause and think before making decisions.', reverse: true },
    { text: 'I can stay focused on long-term goals despite distractions.', reverse: true },
    { text: 'I carefully consider consequences before acting.', reverse: true },
    { text: 'I resist urges when they conflict with my priorities.', reverse: true },
  ]},
  { id: 'impulsive', title: 'Impulsive', items: [
    { text: 'I often act on my first instinct without thinking.' },
    { text: 'I say things I later regret.' },
    { text: 'I make quick decisions without weighing options.' },
    { text: 'I buy or do things on impulse.' },
  ]},
  { id: 'passive', title: 'Passive', items: [
    { text: 'I let others take the lead even when I disagree.' },
    { text: 'I avoid expressing my needs to keep the peace.' },
    { text: 'I often go along with others’ decisions without objection.' },
    { text: 'I keep silent rather than risk conflict.' },
  ]},
  { id: 'assertive', title: 'Assertive', items: [
    { text: 'I feel comfortable saying “no” when necessary.', reverse: true },
    { text: 'I speak up confidently even in group settings.', reverse: true },
    { text: 'I stand up for myself when treated unfairly.', reverse: true },
    { text: 'I clearly communicate my needs.', reverse: true },
  ]},
  { id: 'flexible', title: 'Flexible', items: [
    { text: 'I adapt quickly when routines change.', reverse: true },
    { text: 'I resist trying new approaches once I’m used to something.' },
    { text: 'I enjoy experimenting with new ideas.', reverse: true },
    { text: 'I struggle when things don’t go as planned.' },
  ]},
  { id: 'perfectionistic', title: 'Perfectionistic', items: [
    { text: 'I feel anxious when tasks are not done perfectly.' },
    { text: 'I spend excessive time checking small details.' },
    { text: 'I set unrealistically high standards for myself.' },
    { text: 'I feel upset when even small mistakes happen.' },
  ]},
  { id: 'cooperative', title: 'Cooperative', items: [
    { text: 'I enjoy working as part of a team.', reverse: true },
    { text: 'I freely share credit with others.', reverse: true },
    { text: 'I value collaboration over individual recognition.', reverse: true },
    { text: 'I distrust others’ contributions.' },
  ]},
  { id: 'competitive', title: 'Competitive', items: [
    { text: 'I feel motivated by contests and challenges.' },
    { text: 'I like to measure my performance against others.' },
    { text: 'I thrive when competing.' },
    { text: 'I feel discouraged when I lose to others.' },
  ]},
  { id: 'independent', title: 'Independent', items: [
    { text: 'I trust my own judgment when making decisions.', reverse: true },
    { text: 'I feel confident handling responsibilities on my own.', reverse: true },
    { text: 'I prefer to rely on myself rather than others.', reverse: true },
    { text: 'I handle challenges without seeking much guidance.', reverse: true },
  ]},
  { id: 'dependent', title: 'Dependent', items: [
    { text: 'I rely on others’ opinions before making choices.' },
    { text: 'I feel uneasy without reassurance.' },
    { text: 'I often seek approval before acting.' },
    { text: 'I feel lost when I don’t have someone guiding me.' },
  ]},
  { id: 'interactive', title: 'Interactive', items: [
    { text: 'I enjoy engaging with new people.', reverse: true },
    { text: 'I easily strike up conversations with strangers.', reverse: true },
    { text: 'I feel energized by social interactions.', reverse: true },
    { text: 'I actively seek out opportunities to connect.', reverse: true },
  ]},
  { id: 'avoidant', title: 'Avoidant', items: [
    { text: 'I often steer clear of social gatherings.' },
    { text: 'I feel drained after spending time with groups of people.' },
    { text: 'I avoid meeting new people unless necessary.' },
    { text: 'I prefer solitude over being in a crowd.' },
  ]},
];

export default function PersonalityStep({ personality, update }: { personality: any; update: (rel: string, val: any) => void }) {
  const [catIdx, setCatIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [local, setLocal] = useState<Record<string, number[]>>(()=> ({ ...(personality?.responses || {}) }));
  useEffect(()=>{ setLocal({ ...(personality?.responses || {}) }); }, [personality?.responses]);

  const totalItems = useMemo(()=> CATS.reduce((acc, c)=> acc + c.items.length, 0), []);
  const completedCount = useMemo(()=> {
    let count = 0; for (let i=0;i<catIdx;i++) count += CATS[i].items.length; count += (itemIdx+1); return count;
  }, [catIdx, itemIdx]);
  const progress = Math.round((completedCount/totalItems)*100);

  function setResponse(catId: string, itemIndex: number, value: number) {
    setLocal((prev) => {
      const arr = Array.isArray(prev[catId]) ? [...prev[catId]] : [];
      arr[itemIndex] = value; // 1..5 scale
      const next = { ...prev, [catId]: arr };
      update('responses', next);
      try {
        const prevTexts: Record<string, string[]> = (personality?.texts || {});
        const catTexts = Array.isArray(prevTexts[catId]) ? [...prevTexts[catId]] : [];
        catTexts[itemIndex] = CATS.find(c=>c.id===catId)?.items?.[itemIndex]?.text || '';
        const mergedTexts = { ...prevTexts, [catId]: catTexts };
        update('texts', mergedTexts);
      } catch {}
      return next;
    });
  }

  // compute scores (4..20) with reverse items flipped (6 - x)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const scores: Record<string, number> = {};
        for (const c of CATS) {
          const vals = (local[c.id] || []).slice(0, c.items.length);
          let sum = 0;
          for (let i=0;i<c.items.length;i++) {
            const raw = Number(vals[i] || 0);
            const v = raw < 1 || raw > 5 ? 0 : (c.items[i].reverse ? (6 - raw) : raw);
            sum += v;
          }
          scores[c.id] = sum; // range 4..20 if all answered
        }
        update('scores', scores);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [local, update]);

  const cat = CATS[Math.max(0, Math.min(catIdx, CATS.length-1))];
  const it = cat.items[Math.max(0, Math.min(itemIdx, cat.items.length-1))];
  const curVal = Number(local?.[cat.id]?.[itemIdx] || 0);

  function goNext() {
    if (itemIdx < cat.items.length - 1) { setItemIdx(itemIdx + 1); return; }
    if (catIdx < CATS.length - 1) { setCatIdx(catIdx + 1); setItemIdx(0); return; }
  }
  function goBack() {
    if (itemIdx > 0) { setItemIdx(itemIdx - 1); return; }
    if (catIdx > 0) { const prevLen = CATS[catIdx - 1].items.length; setCatIdx(catIdx - 1); setItemIdx(prevLen - 1); }
  }

  return (
    <div className="grid gap-4">
      <div className="text-base font-semibold">Adaptive profile</div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>{cat.title} — Item {itemIdx+1} of {cat.items.length}</div>
          <div>{progress}%</div>
        </div>
        <div className="h-1 w-full rounded bg-muted">
          <div className="h-1 rounded bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border p-5 bg-card/60">
        <div className="text-sm text-muted-foreground mb-2">One quick statement at a time</div>
        <div className="text-[15px] font-medium leading-6">{it.text}</div>
        <div className="mt-4 inline-flex overflow-hidden rounded-full border bg-background shadow-sm">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              type="button"
              aria-pressed={curVal===n}
              onClick={()=> { setResponse(cat.id, itemIdx, n); setTimeout(()=>goNext(), 10); }}
              className={[
                'px-4 py-2 text-sm',
                curVal===n ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
              ].join(' ')}
            >{n}</button>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">1 = Strongly disagree · 5 = Strongly agree</div>

        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={goBack} className="text-xs text-muted-foreground hover:underline">Previous</button>
          <div />
        </div>
      </div>
    </div>
  );
}


