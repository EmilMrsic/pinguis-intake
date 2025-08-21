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

  const [medQuery, setMedQuery] = useState<string>('');
  const [medSuggestions, setMedSuggestions] = useState<string[]>([]);
  const [showMedDropdown, setShowMedDropdown] = useState<boolean>(false);
  const [selectedMeds, setSelectedMeds] = useState<string[]>(Array.isArray(daily?.meds_list) ? daily.meds_list : []);
  const medBoxRef = useRef<HTMLDivElement | null>(null);
  const medInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (Array.isArray(daily?.meds_list)) setSelectedMeds(daily.meds_list); }, [daily?.meds_list]);

  useEffect(() => {
    let active = true;
    const q = medQuery.trim();
    const url = `/api/meds-suggest?q=${encodeURIComponent(q)}&limit=10`;
    fetch(url).then(r=>r.json()).then((d)=>{ if (active && Array.isArray(d?.suggestions)) setMedSuggestions(d.suggestions); }).catch(()=>{});
    return () => { active = false; };
  }, [medQuery]);

  function addMed(raw: string) {
    const name = (raw || '').trim();
    if (!name) return;
    if (selectedMeds.includes(name)) { setMedQuery(''); return; }
    const next = [...selectedMeds, name];
    setSelectedMeds(next);
    update('meds_list', next);
    setMedQuery('');
    setShowMedDropdown(false);
    try { medInputRef.current?.focus(); } catch {}
  }

  function removeMed(name: string) {
    const next = selectedMeds.filter(x => x !== name);
    setSelectedMeds(next);
    update('meds_list', next);
  }

  // Supplements state
  const [suppQuery, setSuppQuery] = useState<string>('');
  const [suppSuggestions, setSuppSuggestions] = useState<string[]>([]);
  const [showSuppDropdown, setShowSuppDropdown] = useState<boolean>(false);
  const [selectedSupps, setSelectedSupps] = useState<string[]>(Array.isArray(daily?.supps_list) ? daily.supps_list : []);
  const suppInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(()=>{ if (Array.isArray(daily?.supps_list)) setSelectedSupps(daily.supps_list); }, [daily?.supps_list]);
  useEffect(()=>{
    let active = true;
    const q = suppQuery.trim();
    const url = `/api/supps-suggest?q=${encodeURIComponent(q)}&limit=10`;
    fetch(url).then(r=>r.json()).then((d)=>{ if (active && Array.isArray(d?.suggestions)) setSuppSuggestions(d.suggestions); }).catch(()=>{});
    return () => { active = false; };
  }, [suppQuery]);
  function addSupp(raw: string) { const name=(raw||'').trim(); if(!name) return; if (selectedSupps.includes(name)) { setSuppQuery(''); return; } const next=[...selectedSupps, name]; setSelectedSupps(next); update('supps_list', next); setSuppQuery(''); setShowSuppDropdown(false); try { suppInputRef.current?.focus(); } catch {} }
  function removeSupp(name: string) { const next=selectedSupps.filter(x=>x!==name); setSelectedSupps(next); update('supps_list', next); }

  return (
    <div className="grid gap-5">
      <div>
        <div className="text-base font-semibold">{copy?.title || 'Daily habits & health'}</div>
        {copy?.subtitle && <div className="text-sm text-muted-foreground mt-1">{copy.subtitle}</div>}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Medications</label>
        <div className="relative" ref={medBoxRef}>
          <div className="flex flex-wrap gap-2 rounded-md border p-2">
            {selectedMeds.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300 px-2 py-0.5 text-xs">
                {m}
                <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={()=>removeMed(m)}>×</button>
              </span>
            ))}
            <input
              ref={medInputRef}
              className="min-w-[160px] flex-1 outline-none text-sm"
              placeholder={selectedMeds.length ? 'Add another…' : 'Start typing to search common meds…'}
              value={medQuery}
              onChange={(e)=>{ setMedQuery(e.target.value); setShowMedDropdown(true); }}
              onFocus={()=> setShowMedDropdown(true)}
              onKeyDown={(e)=>{
                if ((e.key === 'Enter' || e.key === ',') && medQuery.trim()) { e.preventDefault(); addMed(medQuery); }
                if (e.key === 'Backspace' && !medQuery && selectedMeds.length) { removeMed(selectedMeds[selectedMeds.length-1]); }
              }}
              onBlur={()=> setTimeout(()=> setShowMedDropdown(false), 150)}
            />
          </div>
          {showMedDropdown && medSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-md border bg-background shadow">
              {medSuggestions.map((s, i) => (
                <button key={`${s}-${i}`} type="button" className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(e)=> e.preventDefault()} onClick={()=>addMed(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Supplements</label>
        <div className="relative">
          <div className="flex flex-wrap gap-2 rounded-md border p-2">
            {selectedSupps.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300 px-2 py-0.5 text-xs">
                {m}
                <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={()=>removeSupp(m)}>×</button>
              </span>
            ))}
            <input
              ref={suppInputRef}
              className="min-w-[160px] flex-1 outline-none text-sm"
              placeholder={selectedSupps.length ? 'Add another…' : 'Start typing to search common supplements…'}
              value={suppQuery}
              onChange={(e)=>{ setSuppQuery(e.target.value); setShowSuppDropdown(true); }}
              onFocus={()=> setShowSuppDropdown(true)}
              onKeyDown={(e)=>{
                if ((e.key==='Enter' || e.key===',') && suppQuery.trim()) { e.preventDefault(); addSupp(suppQuery); }
                if (e.key==='Backspace' && !suppQuery && selectedSupps.length) { removeSupp(selectedSupps[selectedSupps.length-1]); }
              }}
              onBlur={()=> setTimeout(()=> setShowSuppDropdown(false), 150)}
            />
          </div>
          {showSuppDropdown && suppSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-md border bg-background shadow">
              {suppSuggestions.map((s, i) => (
                <button key={`${s}-${i}`} type="button" className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(e)=> e.preventDefault()} onClick={()=>addSupp(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Complicating factors</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {factorsList.map(f => {
            const checked = !!(daily?.factors?.[f.id]);
            return (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(v)=>{
                  const next = { ...(daily?.factors||{}) } as any;
                  if (v === true) { next[f.id] = true; } else { delete next[f.id]; }
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


