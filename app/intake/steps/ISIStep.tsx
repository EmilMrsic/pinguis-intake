"use client";
import React from 'react';
import { Button } from '@/components/ui/button';

const ITEMS: { id: string; text: string }[] = [
  { id: 'fall_asleep_diff', text: 'How hard is it for you to fall asleep?' },
  { id: 'stay_asleep_diff', text: 'How hard is it to stay asleep through the night?' },
  { id: 'early_wake', text: 'Do you wake earlier than you’d like?' },
  { id: 'satisfaction', text: 'How satisfied are you with your sleep overall?' },
  { id: 'interference', text: 'How much do sleep issues affect your day?' },
  { id: 'noticeability', text: 'Do others notice your sleep difficulties?' },
  { id: 'worry_distress', text: 'How much does this worry or stress you?' },
];

export default function ISIStep({
  values,
  update,
  onComplete,
}: {
  values: Record<string, number>;
  update: (id: string, value: number) => void;
  onComplete?: () => void;
}) {
  const [idx, setIdx] = React.useState<number>(()=> {
    const firstUnanswered = ITEMS.findIndex(it => typeof values?.[it.id] !== 'number');
    return firstUnanswered >= 0 ? firstUnanswered : 0;
  });

  const it = ITEMS[Math.max(0, Math.min(idx, ITEMS.length - 1))];
  const answered = typeof values?.[it.id] === 'number';
  const bg = (idx % 2 === 0) ? 'bg-sky-50' : 'bg-amber-50';

  function select(n: number) {
    update(it.id, n);
    if (idx < ITEMS.length - 1) setIdx(idx + 1); else onComplete && onComplete();
  }

  function back() { if (idx > 0) setIdx(idx - 1); }

  return (
    <div className="grid gap-4">
      {/* Progress dashes */}
      <div className="flex items-center gap-1">
        {ITEMS.map((_,i)=> (
          <div key={i} className={[ 'h-1 flex-1 rounded', i<=idx ? 'bg-sky-500' : 'bg-muted' ].join(' ')} />
        ))}
      </div>

      <div className={[ 'rounded-md border p-4', bg ].join(' ')}>
        <div className="text-base font-semibold mb-3">{it.text}</div>
        <div className="flex flex-wrap gap-2">
          {[0,1,2,3,4].map(n => (
            <button
              key={`${it.id}-${n}`}
              type="button"
              aria-pressed={values?.[it.id] === n}
              onClick={()=> select(n)}
              className={[ 'rounded-full border px-3 py-1 text-sm', (values?.[it.id] === n) ? 'border-sky-500 bg-sky-50 text-sky-700' : 'hover:bg-accent' ].join(' ')}
            >{n}</button>
          ))}
        </div>
      </div>

      {/* Back arrow below card (icon-only), no count */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={back}
          disabled={idx===0}
          aria-label="Back"
          className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          ←
        </button>
      </div>
    </div>
  );
}


