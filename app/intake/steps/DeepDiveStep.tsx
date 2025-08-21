import React from 'react';
import { Slider } from '@/components/ui/slider';
import { DEEP_ITEMS } from '@/lib/intake/deepItems';

export function DeepDiveStep({
  topicId,
  topicLabel,
  values,
  onChange,
  onCommit,
  why, onWhyChange, onWhyCommit,
}: {
  topicId: string; topicLabel: string;
  values: Record<string, number>;
  onChange: (itemKey: string, n: number) => void;
  onCommit: (itemKey: string, n: number) => void;
  why: Record<string, string>;
  onWhyChange: (itemKey: string, t: string) => void;
  onWhyCommit: (itemKey: string, t: string) => void;
}) {
  const items = DEEP_ITEMS[topicId] ?? [];
  return (
    <div className="grid gap-4">
      <div className="text-base font-semibold">Symptom details: {topicLabel}</div>
      {items.map((it) => {
        const val = values[it.key] ?? 0;
        return (
          <div key={it.key} className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{it.label}</div>
              <div className="text-xs text-muted-foreground">{Math.round(val)}</div>
            </div>
            <Slider value={[val]} min={0} max={10} step={0.1} onValueChange={(v)=>onChange(it.key, v?.[0] ?? 0)} onValueCommit={(v)=>onCommit(it.key, Math.round(v?.[0] ?? 0))} />
            {val > 6 && (
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Why is {it.label.toLowerCase()} a {Math.round(val)} today for you? <span className="opacity-70">(optional)</span></label>
                <input className="rounded-md border px-3 py-2 text-sm" value={why[it.key] ?? ''} onChange={(e)=>onWhyChange(it.key, e.target.value)} onBlur={(e)=>onWhyCommit(it.key, (e.currentTarget.value||'').trim())} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


