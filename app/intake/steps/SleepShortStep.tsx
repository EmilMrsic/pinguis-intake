import React, { useEffect, useMemo, useRef, useState } from 'react';
import TimePicker, { TimeValue } from '@/app/intake/steps/TimePicker';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

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
  // Sleep subratings (0–3)
  const subItems: { key: string; label: string }[] = [
    { key: 'drift_off_struggle', label: 'I struggle to drift off at night.' },
    { key: 'predawn_waking', label: "I wake up frequently before dawn and can't return to sleep." },
    { key: 'exhausted_after_full_night', label: "I feel exhausted even after a full night's rest." },
    { key: 'long_naps_needed', label: 'I take unusually long naps to feel alert.' },
    { key: 'schedule_varies', label: 'My sleep schedule varies wildly from day to day.' },
    { key: 'rested_on_waking', label: 'I feel rested and refreshed when I wake up.' },
  ];

  const latency = Number(sleep?.sleep_latency_minutes ?? 0);
  const awakenings = Number(sleep?.night_awakenings_count ?? 0);
  const awakeMins = Number(sleep?.awake_time_at_night_minutes ?? 0);

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
            <span className="text-xs text-muted-foreground">A rough estimate is perfect — no need to be exact.</span>
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
            <span className="text-xs text-muted-foreground">On an average night (a rough estimate is perfect).</span>
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
            <span className="text-xs text-muted-foreground">A rough estimate is perfect — no need to be exact.</span>
          </div>
        </div>

        {/* Rested slider removed; migrated into 0–3 subrating below */}

        <div className="grid gap-1">
          <label className="text-sm font-medium">Have you been diagnosed with sleep apnea?</label>
          <div className="inline-flex overflow-hidden rounded-md border shadow-sm w-fit">
            {['No','Yes'].map((label, idx) => {
              const yes = Boolean(sleep?.sleep_apnea_diagnosed);
              const isYes = idx === 1;
              const active = (isYes && yes) || (!isYes && !yes);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={()=> update('sleep_apnea_diagnosed', isYes)}
                  aria-pressed={active}
                  className={[
                    'px-3 py-1.5 text-sm border-l first:border-l-0',
                    active && isYes ? 'bg-sky-50 text-sky-700 border-sky-300' : active && !isYes ? 'bg-background text-muted-foreground border-muted-foreground/20' : 'bg-background hover:bg-accent border-transparent'
                  ].join(' ')}
                >{label}</button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Do you use sleep aids?</label>
          <div className="inline-flex overflow-hidden rounded-md border shadow-sm w-fit">
            {['No','Yes'].map((label, idx) => {
              const yes = Boolean(sleep?.sleep_aids_used);
              const isYes = idx === 1;
              const active = (isYes && yes) || (!isYes && !yes);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={()=> {
                    update('sleep_aids_used', isYes);
                  }}
                  aria-pressed={active}
                  className={[
                    'px-3 py-1.5 text-sm border-l first:border-l-0',
                    active && isYes ? 'bg-sky-50 text-sky-700 border-sky-300' : active && !isYes ? 'bg-background text-muted-foreground border-muted-foreground/20' : 'bg-background hover:bg-accent border-transparent'
                  ].join(' ')}
                >{label}</button>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">If Yes, your provider will follow up about type and dosage.</div>
        </div>

        <div className="grid gap-2">
          <div>
            <label className="text-sm font-medium">Sleep patterns (0–3)</label>
            <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>0 = never</span>
              <span>1 = sometimes</span>
              <span>2 = often</span>
              <span>3 = always</span>
            </div>
          </div>
          <div className="grid gap-2">
            {subItems.map(it => {
              const val = Number(sleep?.subratings?.[it.key] ?? 0);
              return (
                <div key={it.key} className="grid gap-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">{it.label}</div>
                    <div className="text-xs text-muted-foreground">{val}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[0,1,2,3].map(n => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={val===n}
                        onClick={()=> update(`subratings.${it.key}`, n)}
                        className={[ 'h-7 w-7 rounded-full border text-xs grid place-items-center', val===n ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent' ].join(' ')}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* Derived metrics are computed for gating, not shown to clients */}

      {isiPreview && (()=>{ try { console.debug('ISI Preview:', isiPreview); } catch {} return null; })()}
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

