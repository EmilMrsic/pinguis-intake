import React from 'react';
import SelectCard from '@/components/SelectCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function AreasSelectStep({ topics, selected, toggle, onAddCustom }: { topics: { id:string; label:string }[]; selected: string[]; toggle: (id: string)=>void; onAddCustom: (label: string)=>void }) {
  const [custom, setCustom] = React.useState<string>('');
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const previews: Record<string, string[]> = React.useMemo(()=>({
    sleep: [
      'Trouble falling asleep',
      'Waking during the night',
      'Feeling unrefreshed in the morning',
      'Daytime sleepiness',
    ],
    dep: [
      'Low mood or sadness',
      'Loss of interest or motivation',
      'Irritability',
      'Low energy',
    ],
    anx: [
      'Excessive worry',
      'Feeling on edge',
      'Racing heart',
      'Restlessness',
    ],
    focus: [
      'Easily distracted',
      'Hard time finishing tasks',
      'Mind wandering',
      'Need to re-read things',
    ],
    mem: [
      'Forgetting appointments',
      'Misplacing items',
      'Trouble recalling conversations',
      'Losing track mid-task',
    ],
    imp: [
      'Acting on impulse',
      'Interrupting others',
      'Difficulty waiting turn',
      'Starting new tasks before finishing',
    ],
    trauma: [
      'Intrusive memories or flashbacks',
      'Avoiding reminders or places',
      'Hypervigilance or feeling on edge',
      'Nightmares related to events',
    ],
    addictive: [
      'Strong urges or cravings',
      'Using more than intended',
      'Difficulty cutting back',
      'Impact on work, school, or relationships',
    ],
    learn: [
      'Struggles with reading comprehension',
      'Trouble following instructions',
      'Difficulty retaining new information',
      'Needs repeated review to learn',
    ],
  }), []);
  function addCustom() {
    const label = (custom || '').trim();
    if (!label) return;
    onAddCustom(label);
    setCustom('');
  }
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Topics">
        {topics.map((t) => {
          const isSelected = selected.includes(t.id);
          const isOpen = !!open[t.id];
          return (
            <div key={t.id} className="grid gap-2">
              <SelectCard
                role="button"
                ariaLabel={t.label}
                title={t.label}
                subtitle="Select to include this."
                selected={isSelected}
                onSelect={() => toggle(t.id)}
              />
              <div className="px-1">
                <button
                  type="button"
                  className={[
                    'inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 border',
                    'bg-accent/40 hover:bg-accent transition-colors'
                  ].join(' ')}
                  onClick={()=>setOpen((o)=>({ ...o, [t.id]: !o[t.id] }))}
                  aria-expanded={isOpen}
                  aria-controls={`symptoms-${t.id}`}
                >
                  <span>{isOpen ? 'Hide' : 'See'} symptoms</span>
                  <span aria-hidden>▾</span>
                </button>
              </div>
              {isOpen && (
                <div id={`symptoms-${t.id}`} className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-2">May include, but not limited to:</div>
                  <ul className="ml-4 list-disc text-xs text-muted-foreground">
                    {(previews[t.id] || []).slice(0,4).map((s, i)=>(
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium">Add another concern</label>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type an issue or how you feel…"
            value={custom}
            onChange={(e)=>setCustom(e.target.value)}
            onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            aria-label="Custom concern"
          />
          <Button type="button" onClick={addCustom} disabled={!custom.trim()}>Add</Button>
        </div>
        <div className="text-xs text-muted-foreground">We’ll treat this as a new symptom to rate.</div>
      </div>
    </div>
  );
}


