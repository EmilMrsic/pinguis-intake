import React from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

export default function MetabolicStep({
  metabolic,
  update,
  firstName,
}: {
  metabolic: any;
  update: (rel: string, val: any) => void;
  firstName?: string;
}) {
  const caffeineSimple = String(metabolic?.caffeine_simple || '');
  const caffeineContext = String(metabolic?.caffeine_context || '');

  const dx = metabolic?.diagnosed_conditions || {};
  function toggleDx(id: string, v: boolean) {
    const next = { ...(dx || {}) } as any;
    if (v) next[id] = true; else delete next[id];
    update('diagnosed_conditions', next);
  }

  const weight = String(metabolic?.weight_change_6mo || '');
  const exercise = String(metabolic?.exercise_frequency || '');

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <label className="text-sm font-medium">Diagnosed conditions</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={!dx || Object.keys(dx).length===0} onCheckedChange={(v)=>{ if (v===true) update('diagnosed_conditions', {}); }} /> None</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!dx.diabetes} onCheckedChange={(v)=>toggleDx('diabetes', v===true)} /> Diabetes</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!dx.thyroid} onCheckedChange={(v)=>toggleDx('thyroid', v===true)} /> Thyroid</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!dx.other} onCheckedChange={(v)=>toggleDx('other', v===true)} /> Other</label>
        </div>
        {dx.other && (
          <Input placeholder="Briefly name other condition" value={metabolic?.other_condition || ''} onChange={(e)=>update('other_condition', e.target.value)} />
        )}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Weight change in last 6 months</label>
        <div className="flex flex-wrap gap-2">
          {['down','up','no_change'].map(opt => (
            <button key={opt} type="button" aria-pressed={weight===opt} onClick={()=>update('weight_change_6mo', opt)}
              className={[ 'rounded-md border px-3 py-1.5 text-sm', weight===opt ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-[0_0_0_2px_rgba(56,189,248,.25)]' : 'hover:bg-accent' ].join(' ')}>
              {opt==='down'?'Down':opt==='up'?'Up':'No change'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Diet pattern</label>
        <Input placeholder="e.g., Mediterranean, low-carb, vegetarian" value={metabolic?.diet_pattern || ''} onChange={(e)=>update('diet_pattern', e.target.value)} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">How much caffeine do you drink?</label>
        <div className="flex flex-wrap gap-2">
          {[
            { id:'at_least_one', label:'At least 1 cup of coffee or soda a day' },
            { id:'less_than_one', label:'Less than 1 cup of coffee or soda a day' },
            { id:'daily_energy', label:'Daily energy drinks' },
            { id:'multiple', label:'Multiple caffeine drinks a day' },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={caffeineSimple===opt.id}
              onClick={()=>{ update('caffeine_clear', true); update('caffeine_simple', opt.id); }}
              className={[ 'rounded-full border px-3 py-1.5 text-sm', caffeineSimple===opt.id ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-[0_0_0_2px_rgba(56,189,248,.25)]' : 'hover:bg-accent' ].join(' ')}
            >{opt.label}</button>
          ))}
        </div>
        <Input placeholder="Optional context (brand, timing, size)" value={caffeineContext} onChange={(e)=>update('caffeine_context', e.target.value)} />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Exercise frequency</label>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border bg-background shadow-sm">
            <Button type="button" variant="ghost" className="h-9 px-2" onClick={()=>{ const n=Math.max(0,(parseInt(exercise||'0',10)||0)-1); update('exercise_frequency', String(n)); }}>−</Button>
            <Input className="w-16 border-0 focus-visible:ring-0 text-center" type="number" min={0} step={1} value={parseInt((exercise||'0'),10) || 0} onChange={(e)=>update('exercise_frequency', `${Math.max(0, Number(e.target.value||0))}`)} />
            <Button type="button" variant="ghost" className="h-9 px-2" onClick={()=>{ const n=(parseInt(exercise||'0',10)||0)+1; update('exercise_frequency', String(n)); }}>+</Button>
          </div>
          <div className="inline-flex overflow-hidden rounded-md border shadow-sm">
            {['per week','per month'].map(p => (
              <button key={p} type="button" onClick={()=>update('exercise_period', p)} className={[ 'px-3 py-1.5 text-sm', (metabolic?.exercise_period||'per week')===p ? 'bg-sky-50 text-sky-700' : 'bg-background hover:bg-accent' ].join(' ')}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


