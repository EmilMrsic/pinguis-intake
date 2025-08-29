"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SUBRATING_CONFIG } from '@/lib/intake/subratings';
import { setByPath as setByPathLib, getByPath as getByPathLib } from '@/lib/intake/paths';

const setByPath = setByPathLib;
const getByPath = getByPathLib;

export default function CECRemainderStep({
  remaining,
  topics,
  payload,
  setPayload,
  autosave,
  onComplete,
}: {
  remaining: string[];
  topics: { id: string; label: string }[];
  payload: any;
  setPayload: (p: any) => void;
  autosave: (p: any, opts?: any) => void;
  onComplete?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const topicId = remaining[Math.max(0, Math.min(index, Math.max(0, remaining.length - 1)))] || '';
  const topicLabel = useMemo(() => topics.find(t => t.id === topicId)?.label || topicId, [topics, topicId]);
  const cfg = (topicId === 'headaches') ? [] : (SUBRATING_CONFIG[topicId] || []);

  // Read
  const severity: number | undefined = useMemo(() => {
    const v = getByPath(payload, `cec_topics.${topicId}.severity`);
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 5 ? n : undefined;
  }, [payload, topicId]);
  const subValues: Record<string, number | undefined> = useMemo(() => {
    return Object.fromEntries(cfg.map(it => {
      const v = getByPath(payload, `cec_topics.${topicId}.subratings.${it.key}`);
      const n = Number(v);
      const val = Number.isFinite(n) && n >= 0 && n <= 3 ? n : undefined;
      return [it.key, val];
    }));
  }, [payload, topicId, cfg]);

  const allSubFilled = cfg.length === 0 || cfg.every(it => {
    const v = subValues[it.key];
    return v === 0 || v === 1 || v === 2 || v === 3;
  });
  const canNext = (typeof severity === 'number') && allSubFilled;

  function setSeverity(val: number) {
    const next = structuredClone(payload);
    setByPath(next, `cec_topics.${topicId}.severity`, Math.max(0, Math.min(5, Math.round(val))));
    // Mirror into psychosocial main rating (exclude headaches)
    if (topicId !== 'headaches') {
      setByPath(next, `psychosocial.${topicId}.severity`, Math.max(0, Math.min(5, Math.round(val))));
    }
    setPayload(next);
    autosave(next, { silent: true });
  }

  function setSub(key: string, val: number) {
    const next = structuredClone(payload);
    setByPath(next, `cec_topics.${topicId}.subratings.${key}`, Math.max(0, Math.min(3, Math.round(val))));
    // Mirror into psychosocial subratings (exclude headaches)
    if (topicId !== 'headaches') {
      setByPath(next, `psychosocial.${topicId}.subratings.${key}`, Math.max(0, Math.min(3, Math.round(val))));
    }
    setPayload(next);
    autosave(next, { silent: true });
  }

  function goNext() {
    if (!canNext) return;
    if (index >= remaining.length - 1) { onComplete && onComplete(); }
    else setIndex(i => i + 1);
  }

  function goBack() { setIndex(i => Math.max(0, i - 1)); }

  if (!topicId) return (
    <div className="text-sm text-muted-foreground">No remaining topics to complete. You can continue.</div>
  );

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Catch‑up: {topicLabel}</div>
        <div className="text-xs text-muted-foreground">{index + 1} / {Math.max(1, remaining.length)}</div>
      </div>

      {/* Subratings 0–3 */}
      {cfg.length > 0 && (
        <div className="grid gap-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>0 = never</span>
            <span>1 = sometimes</span>
            <span>2 = often</span>
            <span>3 = always</span>
          </div>
          {cfg.map(it => {
            const val = subValues[it.key];
            return (
              <div key={it.key} className="grid gap-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">{it.label}</div>
                  <div className="text-xs text-muted-foreground">{typeof val === 'number' ? val : '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {[0,1,2,3].map(n => {
                    const selected = (typeof val === 'number') && val === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={selected}
                        onClick={()=> setSub(it.key, n)}
                        className={[
                          'h-8 w-8 rounded-full border text-sm grid place-items-center',
                          selected ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'
                        ].join(' ')}
                      >{n}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Severity 0–5 shown after subratings are complete */}
      {allSubFilled && (
        <div className="grid gap-2">
          <div className="text-sm text-muted-foreground">How often or how severe does this interfere in your day-to-day life?</div>
          <div role="radiogroup" aria-label={`${topicLabel} severity`} className="flex items-center gap-2">
            {[0,1,2,3,4,5].map(n => {
              const sel = severity === n;
              return (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={sel}
                  onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setSeverity(n); }}
                  className={[
                    'h-9 w-9 rounded-full border text-sm grid place-items-center transition-colors',
                    sel ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'
                  ].join(' ')}
                >{n}</button>
              );
            })}
          </div>
          <div className="text-[11px] text-muted-foreground">0 = none · 5 = severe</div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={goBack} disabled={index===0}>Back</Button>
        <Button onClick={goNext} disabled={!canNext}>{index >= remaining.length - 1 ? 'Finish' : 'Next'}</Button>
        <div className="sm:ml-auto text-xs text-muted-foreground" aria-live="polite">
          {canNext ? 'Ready' : 'Please rate everything to continue'}
        </div>
      </div>
    </div>
  );
}


