import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useAiHints } from '@/lib/intake/hooks/useAiHints';

export function DailyStep({
  intakeId,
  daily,
  update,
  context,
}: {
  intakeId: string | undefined;
  daily: any;
  update: (relativePath: string, value: any) => void;
  context: { selectedTopics: string[]; severities: Record<string, number>; firstName?: string };
}) {
  const { aiCopyMap, aiChipsMap, aiTurn } = useAiHints(intakeId || '', false);
  const key = 'daily';

  useEffect(() => {
    try { aiTurn('daily', 'enter', context); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeId]);

  const copy = aiCopyMap[key] || { title: 'Daily habits & health', subtitle: 'A few quick things to help your clinician interpret results.', prompt_line: 'Anything important to note?', placeholder: 'Short note in your own words…' };
  const chips = aiChipsMap[key] || [];

  const factorsList: { id: string; label: string }[] = useMemo(() => [
    { id: 'head_injury_history', label: 'Head injury history' },
    { id: 'seizure_disorder', label: 'Seizure disorder' },
    { id: 'developmental_disorder', label: 'Developmental disorder' },
    { id: 'chronic_illness', label: 'Chronic illness' },
    { id: 'substance_use_issues', label: 'Substance use issues' },
    { id: 'significant_trauma', label: 'Significant trauma' },
    { id: 'pregnancy_current', label: 'Current pregnancy' },
    { id: 'other_major_medical', label: 'Other major medical' },
  ], []);

  const [note, setNote] = useState<string>(daily?.note || '');
  const debounceRef = useRef<any>(null);
  useEffect(() => { setNote(daily?.note || ''); }, [daily?.note]);
  function scheduleSave(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update('note', val.trim()), 800);
  }

  return (
    <div className="grid gap-5">
      <div>
        <div className="text-base font-semibold">{copy?.title || 'Daily habits & health'}</div>
        {copy?.subtitle && <div className="text-sm text-muted-foreground mt-1">{copy.subtitle}</div>}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Medications</label>
        <Input placeholder="Name, dose, frequency (comma separated)…" value={daily?.meds || ''} onChange={(e)=>update('meds', e.target.value)} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Supplements</label>
        <Input placeholder="Name, dose, frequency (comma separated)…" value={daily?.supps || ''} onChange={(e)=>update('supps', e.target.value)} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Complicating factors</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {factorsList.map(f => {
            const checked = !!(daily?.factors?.[f.id]);
            return (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(v)=>{
                  const next = { ...(daily?.factors||{}) } as any; next[f.id] = Boolean(v);
                  update('factors', next);
                }} />
                <span>{f.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">{copy?.prompt_line || 'Anything we should know?'}</label>
        <Textarea
          placeholder={copy?.placeholder || 'Short note in your own words…'}
          value={note}
          onChange={(e)=>{ const v=e.target.value; setNote(v); scheduleSave(v); }}
        />
        {Array.isArray(chips) && chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.slice(0,6).map((c, i) => (
              <button key={i} type="button" className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
                onClick={()=>{ const v = (note ? (note + (note.endsWith('\n')?'':'\n')) : '') + c + ' '; setNote(v); scheduleSave(v); }}
              >{c}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyStep;


