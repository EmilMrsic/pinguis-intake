import React from 'react';
import { TopicNoteField } from './TopicNoteField';

export function TopicRateStep({
  topicId,
  topicLabel,
  severity,
  setSeverity,
  note,
  chips,
  onSave,
  onComplete,
  onLiveChange,
  showSubRatings,
  subItems,
  onSetSubRating,
}: {
  topicId?: string;
  topicLabel: string;
  severity: number;
  setSeverity: (n: number) => void;
  note: string;
  chips: string[];
  onSave: (t: string) => void;
  onComplete: (t: string) => void;
  onLiveChange?: (t: string) => void;
  showSubRatings?: boolean;
  subItems?: { key: string; label: string; value?: number }[];
  onSetSubRating?: (key: string, val: number) => void;
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
      {showSubRatings && Array.isArray(subItems) && subItems.length > 0 && (
        <div className="mt-2 grid gap-3">
          {subItems.map(it => (
            <div key={it.key} className="grid gap-1">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{it.label}</div>
                <div className="text-xs text-muted-foreground">{Math.round(it.value ?? 0)}</div>
              </div>
              <div className="flex items-center gap-2">
                {[0,1,2,3].map(n => {
                  const selected = (it.value ?? 0) === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={selected}
                      onClick={()=> onSetSubRating && onSetSubRating(it.key, n)}
                      className={[
                        'h-8 w-8 rounded-full border text-sm grid place-items-center',
                        selected ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'
                      ].join(' ')}
                    >{n}</button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
            <span>0 = not present</span>
            <span>1 = mild</span>
            <span>2 = moderate</span>
            <span>3 = severe</span>
          </div>
        </div>
      )}
      {severity >= 3 && (
        <TopicNoteField
          topicId={topicId || topicLabel}
          initial={note}
          chips={chips}
          placeholder="Please tell us anything you want to about your selections in your own words."
          onSave={onSave}
          onComplete={onComplete}
          onLiveChange={onLiveChange}
        />
      )}
    </div>
  );
}


