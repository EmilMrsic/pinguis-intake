import React, { useMemo } from 'react';
import { topics as topicsCatalog } from '@/lib/intake/topics';
import { DEEP_ITEMS as DEEP_ITEMS_CONST } from '@/lib/intake/deepItems';
import { getByPath as getByPathLib } from '@/lib/intake/paths';

export default function SleepIntroStep({ payload }: { payload: any }) {
  const topics: { id: string; label: string }[] = topicsCatalog;
  const DEEP_ITEMS: Record<string, { key:string; label:string }[]> = DEEP_ITEMS_CONST;
  const getByPath = getByPathLib;
  const selected: string[] = payload?.areas?.selected ?? [];

  const message = useMemo(() => {
    const name = String(payload?.profile?.first_name || '').trim();
    return name ? `${name}, thank you for sharing this with us.` : 'Thank you for sharing this with us.';
  }, [payload?.profile?.first_name]);

  const rows = selected.map((topicId) => {
    const tLabel = topics.find(t=>t.id===topicId)?.label || topicId;
    const severity = Number(payload?.areas?.severity?.[topicId] ?? 0);
    const note: string = getByPath(payload, `notes.byTopic.${topicId}`) ?? '';
    const ddVals: Record<string, number> = Object.fromEntries((DEEP_ITEMS[topicId]||[]).map(it => [it.key, Number(getByPath(payload, `deepdive.${topicId}.${it.key}`) ?? 0)]));
    const ddWhy: Record<string, string> = Object.fromEntries((DEEP_ITEMS[topicId]||[]).map(it => [it.key, String(getByPath(payload, `deepdive_meta.${topicId}.${it.key}.why`) ?? '')]));
    const items = (DEEP_ITEMS[topicId]||[]).filter(it => (ddVals[it.key] ?? 0) > 0);
    return { topicId, tLabel, severity, note, items, ddVals, ddWhy };
  });

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <div className="text-base font-semibold">Captured</div>
        {message && <div className="text-sm text-muted-foreground">{message}</div>}
      </div>
      <div className="grid gap-4">
        {rows.length === 0 && (
          <div className="text-sm text-muted-foreground">No selections captured yet.</div>
        )}
        {rows.map(row => (
          <div key={row.topicId} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{row.tLabel}</div>
              <div className="text-xs text-muted-foreground">Severity: {row.severity || '—'} / 5</div>
            </div>
            {row.note && <div className="mt-1 text-sm">Note: {row.note}</div>}
            {row.items.length > 0 && (
              <div className="mt-2 grid gap-1">
                {row.items.map(it => (
                  <div key={it.key} className="text-sm">
                    <span className="font-medium">{it.label}</span>: {Math.round(row.ddVals[it.key] ?? 0)} / 10
                    {row.ddWhy[it.key] && <div className="text-xs text-muted-foreground">Why: {row.ddWhy[it.key]}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {/* Daily habits & health recap */}
        <DailyRecap payload={payload} />
      </div>
    </div>
  );
}

function DailyRecap({ payload }: { payload: any }) {
  const daily = payload?.daily || {};
  const meds: string[] = Array.isArray(daily?.meds_list)
    ? daily.meds_list
    : (typeof daily?.meds === 'string' ? daily.meds.split(',').map((s:string)=>s.trim()).filter(Boolean) : []);
  const supps: string[] = Array.isArray(daily?.supps_list)
    ? daily.supps_list
    : (typeof daily?.supps === 'string' ? daily.supps.split(',').map((s:string)=>s.trim()).filter(Boolean) : []);
  const factorsObj: Record<string, boolean> = (daily?.factors || {}) as any;
  const factorDefs: { id: string; label: string }[] = [
    { id: 'head_injury_history', label: 'Head injury history' },
    { id: 'seizure_disorder', label: 'Seizure disorder' },
    { id: 'developmental_disorder', label: 'Developmental disorder' },
    { id: 'chronic_illness', label: 'Chronic illness' },
    { id: 'substance_use_issues', label: 'Substance use issues' },
    { id: 'significant_trauma', label: 'Significant trauma' },
    { id: 'pregnancy_current', label: 'Current pregnancy' },
    { id: 'other_major_medical', label: 'Other major medical' },
  ];
  const factors = factorDefs.filter(f => !!factorsObj?.[f.id]);

  if (!daily || (meds.length===0 && supps.length===0 && factors.length===0 && !daily?.note)) return null;
  return (
    <div className="rounded-md border p-3">
      <div className="font-medium">Daily habits &amp; health</div>
      {meds.length>0 && (
        <div className="mt-2 text-sm">
          <div className="text-xs text-muted-foreground mb-1">Medications</div>
          <div className="flex flex-wrap gap-2">
            {meds.map((m,i)=> (
              <span key={`${m}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-100 text-sky-800 px-2 py-0.5 text-xs">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
      {supps.length>0 && (
        <div className="mt-3 text-sm">
          <div className="text-xs text-muted-foreground mb-1">Supplements</div>
          <div className="flex flex-wrap gap-2">
            {supps.map((m,i)=> (
              <span key={`${m}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-100 text-sky-800 px-2 py-0.5 text-xs">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
      {factors.length>0 && (
        <div className="mt-3 text-sm">
          <div className="text-xs text-muted-foreground mb-1">Complicating factors</div>
          <ul className="list-disc pl-5">
            {factors.map(f => (<li key={f.id}>{f.label}</li>))}
          </ul>
        </div>
      )}
      {daily?.note && (
        <div className="mt-3 text-sm">
          <div className="text-xs text-muted-foreground mb-1">Note</div>
          <div>{daily.note}</div>
        </div>
      )}
    </div>
  );
}


