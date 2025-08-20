"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { saveIntakeAction } from './actions';
import { FLOW_VARIANT } from '@/lib/intake/config';
import { devPracticeId, devClientId } from '@/lib/devIds';
import { systemPrompt } from '@/lib/ai/systemPrompt';

export type Step = {
  id: string;
  title: string;
  description?: string;
  type: 'slider' | 'text' | 'singleSelect' | 'areas';
  field: string; // dot path in payload
  scale?: '0-10'|'1-5'|'minutes';
};

const baseSteps: Step[] = [
  {
    id: 'reason',
    title: 'What brings you here today?',
    description: 'This helps us tailor the questions.',
    type: 'singleSelect',
    field: 'story.reason_choice'
  },
  {
    id: 'areas',
    title: 'What would you like to focus on?',
    description: 'Pick one or more, then give each a quick 1–5.',
    type: 'areas',
    field: 'areas'
  },
  { id: 'stress', title: 'Stress/Anxiety', description: '0–10, higher is worse', type: 'slider', field: 'areas.stress', scale: '0-10' },
  { id: 'sleep_latency', title: 'Sleep latency (minutes)', description: 'How long to fall asleep', type: 'slider', field: 'sleep.latency_minutes', scale: 'minutes' },
];

function setByPath(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getByPath(obj: any, path: string) {
  return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object') ? acc[k] : undefined, obj);
}

export default function Flow() {
  const [payload, setPayload] = useState<Record<string, any>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>('');
  const steps = useMemo(() => {
    if (FLOW_VARIANT === 'peak') {
      // Reason → Areas (keep it short in peak)
      return [baseSteps[0], baseSteps[1]];
    }
    return baseSteps;
  }, []);

  // Fetch first natural question on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/model-hook', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: { flow_variant: FLOW_VARIANT, remaining_fields: [{ id: 'story.reason_choice' }] } })
        });
        const data = await res.json();
        if (data?.question) {
          // only used for future UI hints; keeping minimal for now
          console.log('AI question:', data.question);
        }
      } catch {}
    })();
  }, []);

  const current = steps[stepIdx];

  // autosave on payload change (debounced)
  const timer = useRef<NodeJS.Timeout | null>(null);
  const autosave = useCallback((next: Record<string, any>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveIntakeAction({ practiceId: devPracticeId, clientId: devClientId, payload: next });
        setToast('Saved ✓');
        setTimeout(()=>setToast(''), 1200);
      } finally {
        setSaving(false);
      }
    }, 500);
  }, []);

  function updateField(path: string, value: any) {
    const next = structuredClone(payload);
    setByPath(next, path, value);
    setPayload(next);
    autosave(next);
  }

  function nextStep() { if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1); }
  function prevStep() { if (stepIdx > 0) setStepIdx(stepIdx - 1); }

  // Glowing gradient wrappers (Tailwind v3) inspired by Braydon Coyer's technique
  function Glow({
    children,
    radius = 'rounded-xl',
    from = 'from-sky-500',
    to = 'to-blue-600',
  }: { children: React.ReactNode; radius?: string; from?: string; to?: string }) {
    return (
      <div className={`relative ${radius}`}>
        <div className={`pointer-events-none absolute -inset-1 ${radius} bg-gradient-to-r ${from} ${to} opacity-35 blur`} />
        {children}
      </div>
    );
  }

  function GlowButton({
    children,
    onClick,
    disabled,
    variant = 'default' as const,
  }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'default'|'outline'|'secondary'|'ghost'|'link'|'destructive' }) {
    return (
      <div className="relative inline-flex">
        <div className="pointer-events-none absolute -inset-0.5 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 opacity-40 blur-sm" />
        <Button variant={variant} onClick={onClick} disabled={disabled} className="relative">{children}</Button>
      </div>
    );
  }

  function toggleTopic(topicId: string) {
    const next = structuredClone(payload);
    const selected: string[] = Array.from(new Set([...(next.areas?.selected ?? [])]));
    const i = selected.indexOf(topicId);
    if (i >= 0) {
      selected.splice(i, 1);
    } else {
      selected.push(topicId);
    }
    next.areas = { ...(next.areas ?? {}), selected, severity: { ...(next.areas?.severity ?? {}) } };
    // Recompute deep-dive queue (≥3)
    const enq = (next.areas.selected ?? []).filter((t: string) => (next.areas.severity?.[t] ?? 0) >= 3);
    next.queues = { ...(next.queues || {}), deepDive: Array.from(new Set(enq)) };
    setPayload(next);
    autosave(next);
  }

  function setSeverity(topicId: string, val: number) {
    const next = structuredClone(payload);
    const selected: string[] = Array.from(new Set([...(next.areas?.selected ?? [])]));
    if (!selected.includes(topicId)) selected.push(topicId);
    const severity = { ...(next.areas?.severity ?? {}), [topicId]: val };
    next.areas = { ...(next.areas ?? {}), selected, severity };
    const enq = (next.areas.selected ?? []).filter((t: string) => (severity?.[t] ?? 0) >= 3);
    next.queues = { ...(next.queues || {}), deepDive: Array.from(new Set(enq)) };
    setPayload(next);
    autosave(next);
  }

  function setReasonChoice(v: 'problem' | 'peak') {
    const next = structuredClone(payload);
    setByPath(next, 'story.reason_choice', v);
    setByPath(next, 'story.flow_variant', v);
    setPayload(next);
    autosave(next);
  }

  const topics: { id: string; label: string }[] = [
    { id: 'anx', label: 'Stress & anxiety' },
    { id: 'dep', label: 'Mood & depression' },
    { id: 'mem', label: 'Memory & thinking' },
    { id: 'imp', label: 'Impulsivity' },
    { id: 'sleep', label: 'Sleep issues' },
    { id: 'learn', label: 'Learning issues (kids)' },
  ];

  const selectedTopics: string[] = payload.areas?.selected ?? [];
  const severities: Record<string, number> = payload.areas?.severity ?? {};
  const reasonChoice: 'problem' | 'peak' | undefined = payload.story?.reason_choice;

  return (
    <div className="mx-auto w-full max-w-screen-sm sm:max-w-screen-md lg:max-w-screen-lg px-4 sm:px-6 lg:px-8 py-8">
      <Glow>
      <Card className="relative">
        <CardHeader>
          <CardTitle>{current.title}</CardTitle>
          {current.description && <CardDescription>{current.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          {current.type === 'singleSelect' && (
            <div className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Reason for visit">
                {[
                  { v: 'problem', label: 'Addressing a specific problem' },
                  { v: 'peak', label: 'Peak performance / optimization' },
                ].map((opt) => {
                  const selected = reasonChoice === (opt.v as 'problem'|'peak');
                  return (
                    <button
                      key={opt.v}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReasonChoice(opt.v as 'problem'|'peak')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setReasonChoice(opt.v as 'problem'|'peak');
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                          e.preventDefault();
                          const options: Array<'problem'|'peak'> = ['problem','peak'];
                          const idx = options.indexOf(opt.v as 'problem'|'peak');
                          const nextIdx = e.key === 'ArrowLeft' ? (idx + options.length - 1) % options.length : (idx + 1) % options.length;
                          setReasonChoice(options[nextIdx]);
                        }
                      }}
                      className={[
                        'rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        selected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {current.type === 'areas' && (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2" aria-label="Topics">
                {topics.map((t) => {
                  const isSelected = selectedTopics.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleTopic(t.id)}
                      className={[
                        'rounded-full px-3 py-1 text-sm border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                      ].join(' ')}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {selectedTopics.length > 0 && (
                <div className="grid gap-3">
                  <span className="sr-only">Rate 1 (mild) to 5 (severe).</span>
                  {selectedTopics.map((t) => (
                    <div key={t} className="grid gap-2">
                      <div className="text-sm font-medium">{topics.find(x=>x.id===t)?.label}</div>
                      <div role="radiogroup" aria-label={`${t} severity`} className="flex items-center gap-2">
                        {[1,2,3,4,5].map(n => {
                          const sel = (severities?.[t] ?? 0) === n;
                          return (
                            <button
                              key={n}
                              role="radio"
                              aria-checked={sel}
                              onClick={() => setSeverity(t, n)}
                              onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setSeverity(t,n);} }}
                              className={[
                                'h-8 w-8 rounded-full border text-sm grid place-items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                                sel ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                              ].join(' ')}
                            >{n}</button>
                          );
                        })}
                        <span className="ml-2 text-xs text-muted-foreground">1 = mild · 5 = severe</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-2 pt-2">
                <label className="text-sm font-medium">Anything you want us to know before we zoom in?</label>
                <div className="text-xs text-muted-foreground">Optional — 1–3 sentences is perfect.</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'When it started + what sets it off',
                    'What “better” would look like',
                    'Recent changes in sleep, stress, meds'
                  ].map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
                      onClick={() => {
                        const cur = getByPath(payload, 'story.open_comment') ?? '';
                        const prefix = (s + ': ');
                        updateField('story.open_comment', cur ? (cur + (cur.endsWith('\n')?'':'\n') + prefix) : prefix);
                      }}
                    >{s}</button>
                  ))}
                </div>
                <textarea
                  className="w-full min-h-[100px] rounded-md border p-3 text-base"
                  placeholder="Since March, I’ve had trouble focusing at work; gets worse after poor sleep.\nBetter would be falling asleep within 20 minutes and waking rested.\nPanic spikes in crowded places; I’m okay at home."
                  value={getByPath(payload, 'story.open_comment') ?? ''}
                  onChange={(e)=>updateField('story.open_comment', e.target.value)}
                />
              </div>
            </div>
          )}

          {current.type === 'text' && (
            <textarea
              className="w-full min-h-[140px] rounded-md border p-3 text-base"
              placeholder="Type here"
              value={getByPath(payload, current.field) ?? ''}
              onChange={(e)=>updateField(current.field, e.target.value)}
            />
          )}
          {current.type === 'slider' && (
            <div className="space-y-3">
              <Slider
                value={[Number(getByPath(payload, current.field) ?? 0)]}
                min={current.scale === '1-5' ? 1 : 0}
                max={current.scale === '1-5' ? 5 : current.scale === 'minutes' ? 120 : 10}
                step={1}
                onValueChange={(v)=>updateField(current.field, v[0])}
              />
              <div className="text-sm text-muted-foreground">Value: {getByPath(payload, current.field) ?? 0}</div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button variant="outline" onClick={prevStep} disabled={stepIdx===0}>Back</Button>
            <GlowButton
              onClick={nextStep}
              disabled={
                (current.id === 'reason' && !reasonChoice) ||
                (current.id === 'areas' && (
                  (selectedTopics.length === 0) || selectedTopics.some(t => !(severities?.[t] >= 1 && severities?.[t] <= 5))
                )) ||
                stepIdx===steps.length-1
              }
            >Continue</GlowButton>
            <div className="sm:ml-auto text-sm text-muted-foreground" aria-live="polite">{saving ? 'Saving…' : toast || 'Saved'}</div>
          </div>
        </CardContent>
      </Card>
      </Glow>
      <div className="mt-4 text-center text-xs text-muted-foreground">Step {stepIdx+1} of {steps.length}</div>
    </div>
  );
}
