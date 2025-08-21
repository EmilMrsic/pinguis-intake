import React from 'react';
import { TopicNoteField } from './TopicNoteField';

export function TopicRateStep({
  topicLabel,
  severity,
  setSeverity,
  note,
  chips,
  onSave,
  onComplete,
  onLiveChange,
}: {
  topicLabel: string;
  severity: number;
  setSeverity: (n: number) => void;
  note: string;
  chips: string[];
  onSave: (t: string) => void;
  onComplete: (t: string) => void;
  onLiveChange?: (t: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="text-base font-semibold">You chose {severity || '—'} for {topicLabel}</div>
      <div role="radiogroup" aria-label={`${topicLabel} severity`} className="flex items-center gap-3">
        {[1,2,3,4,5].map(n => {
          const sel = severity === n;
          return (
            <button
              type="button"
              key={n}
              role="radio"
              aria-checked={sel}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSeverity(n); }}
              className={[
                'h-10 w-10 rounded-full border text-base grid place-items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors',
                sel ? 'border-sky-500 bg-sky-500/10 shadow-[0_0_0_2px_rgba(56,189,248,.25)]' : 'hover:bg-accent'
              ].join(' ')}
            >{n}</button>
          );
        })}
        <span className="ml-2 text-sm text-muted-foreground">1 = mild · 5 = severe</span>
      </div>
      <TopicNoteField topicId={topicLabel} initial={note} chips={chips} onSave={onSave} onComplete={onComplete} onLiveChange={onLiveChange} />
    </div>
  );
}


