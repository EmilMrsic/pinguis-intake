import React, { useEffect, useMemo, useRef, useState } from 'react';
import TimePicker, { TimeValue } from '@/app/intake/steps/TimePicker';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export default function SleepShortStep({
  sleep,
  update,
  isiPreview,
}: {
  sleep: any;
  update: (rel: string, val: any) => void;
  isiPreview?: { wouldShow: boolean; level: 'skip'|'optional'|'require'; reason: string };
}) {
  // Set sensible defaults if missing
  useEffect(() => {
    try {
      if (!sleep?.bedtime) update('bedtime', '22:00'); // 10:00 PM
      if (!sleep?.wake_time) update('wake_time', '06:30'); // 6:30 AM
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const flags = [
    { id: 'snoring', label: 'Snoring' },
    { id: 'vivid_dreams', label: 'Vivid dreams or nightmares' },
    { id: 'restless_legs', label: 'Restless legs' },
    { id: 'teeth_grinding', label: 'Teeth grinding' },
    { id: 'parasomnias', label: 'Sleepwalking or talking' },
  ];

  function setFlag(id: string, v: boolean) {
    const next = { ...(sleep?.flags || {}) } as any;
    if (v) next[id] = true; else delete next[id];
    update('flags', next);
  }

  const latency = Number(sleep?.sleep_latency_minutes ?? 0);
  const awakenings = Number(sleep?.night_awakenings_count ?? 0);
  const awakeMins = Number(sleep?.awake_time_at_night_minutes ?? 0);
  const rested = Number(sleep?.rested_on_waking_0to10 ?? 0);

  function parseTime(t: string | undefined, fallback: { h: number; m: number }) {
    try {
      const [hh, mm] = (t || '').split(':').map(x => parseInt(x, 10));
      if (!isNaN(hh) && !isNaN(mm)) {
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h12 = ((hh + 11) % 12) + 1; // 0->12, 13->1
        return { hour: h12, minute: mm, ampm: ampm as 'AM'|'PM' };
      }
    } catch {}
    const ampm = fallback.h >= 12 ? 'PM' : 'AM';
    const h12 = ((fallback.h + 11) % 12) + 1;
    return { hour: h12, minute: fallback.m, ampm: ampm as 'AM'|'PM' };
  }

  function to24h(hour12: number, minute: number, ampm: 'AM'|'PM') {
    let h = hour12 % 12;
    if (ampm === 'PM') h += 12;
    const hh = String(h).padStart(2, '0');
    const mm = String(Math.max(0, Math.min(59, minute))).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Typical bedtime</label>
          <TimePicker
            value={parseTime(sleep?.bedtime, { h: 22, m: 0 })}
            onChange={(v)=> update('bedtime', to24h(v.hour, v.minute, v.ampm))}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Typical wake time</label>
          <TimePicker
            value={parseTime(sleep?.wake_time, { h: 6, m: 30 })}
            onChange={(v)=> update('wake_time', to24h(v.hour, v.minute, v.ampm))}
          />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Minutes to fall asleep</label>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border bg-background shadow-sm">
              <button type="button" className="h-9 px-2 text-lg" onClick={()=> update('sleep_latency_minutes', Math.max(0, latency - 5))}>−</button>
              <Input className="w-20 border-0 focus-visible:ring-0 text-center" type="number" min={0} step={5} value={latency} onChange={(e)=>update('sleep_latency_minutes', Math.max(0, Number(e.target.value||0)))} />
              <button type="button" className="h-9 px-2 text-lg" onClick={()=> update('sleep_latency_minutes', Math.min(120, latency + 5))}>+</button>
            </div>
            <span className="text-xs text-muted-foreground">Best guess in minutes</span>
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Number of awakenings</label>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border bg-background shadow-sm">
              <button type="button" className="h-9 px-2 text-lg" onClick={()=> update('night_awakenings_count', Math.max(0, awakenings - 1))}>−</button>
              <Input className="w-20 border-0 focus-visible:ring-0 text-center" type="number" min={0} step={1} value={awakenings} onChange={(e)=>update('night_awakenings_count', Math.max(0, Number(e.target.value||0)))} />
              <button type="button" className="h-9 px-2 text-lg" onClick={()=> update('night_awakenings_count', Math.min(10, awakenings + 1))}>+</button>
            </div>
            <span className="text-xs text-muted-foreground">On an average night</span>
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Total minutes awake when up at night (WASO)</label>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border bg-background shadow-sm">
              <button type="button" className="h-9 px-2 text-lg" onClick={()=> update('awake_time_at_night_minutes', Math.max(0, awakeMins - 5))}>−</button>
              <Input className="w-20 border-0 focus-visible:ring-0 text-center" type="number" min={0} step={5} value={awakeMins} onChange={(e)=>update('awake_time_at_night_minutes', Math.max(0, Number(e.target.value||0)))} />
              <button type="button" className="h-9 px-2 text-lg" onClick={()=> update('awake_time_at_night_minutes', Math.min(180, awakeMins + 5))}>+</button>
            </div>
          </div>
        </div>

        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">How rested do you feel on waking? (0–10)</label>
            <div className="text-xs text-muted-foreground">{rested}</div>
          </div>
          <Slider min={0} max={10} step={1} value={[rested]} onValueChange={(v)=>update('rested_on_waking_0to10', Math.max(0, Math.min(10, Math.round(v?.[0] ?? 0))))} />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Do you experience any of these?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {flags.map(f => (
            <label key={f.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!(sleep?.flags?.[f.id])} onCheckedChange={(v)=> setFlag(f.id, v === true)} />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Derived metrics are computed for gating, not shown to clients */}

      {isiPreview && (
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">
            {isiPreview.wouldShow
              ? 'You will get an insomnia questionnaire'
              : 'No, you would not get an insomnia questionnaire'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Here’s why: {isiPreview.reason}</div>
        </div>
      )}
    </div>
  );
}


function DerivedMetrics({ sleep }: { sleep: any }) {
  const bedtime = (sleep?.bedtime || '').toString();
  const wake = (sleep?.wake_time || '').toString();
  const latency = Number(sleep?.sleep_latency_minutes ?? NaN);
  const waso = Number(sleep?.awake_time_at_night_minutes ?? NaN);

  function parseMinutesHHMM(t: string): number | null {
    try {
      const [hh, mm] = t.split(':').map(x=>parseInt(x,10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      return hh*60 + mm;
    } catch { return null; }
  }

  const bedM = parseMinutesHHMM(bedtime);
  const wakeM = parseMinutesHHMM(wake);
  let timeInBed: number | null = null;
  if (bedM!=null && wakeM!=null) {
    timeInBed = (wakeM >= bedM) ? (wakeM - bedM) : (24*60 - bedM + wakeM);
  }
  const totalSleep = (timeInBed!=null && !Number.isNaN(latency) && !Number.isNaN(waso)) ? Math.max(0, timeInBed - latency - waso) : null;
  const efficiency = (timeInBed!=null && totalSleep!=null && timeInBed>0) ? Math.round((totalSleep/timeInBed)*100) : null;

  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <div>Estimated total sleep: {totalSleep!=null ? `${totalSleep} min` : '—'}</div>
      <div>Estimated sleep efficiency: {efficiency!=null ? `${efficiency}%` : '—'}</div>
    </div>
  );
}

