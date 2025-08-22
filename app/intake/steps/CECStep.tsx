import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CEC_ITEMS, CEC_SCALE } from '@/lib/intake/cecItems';
import { ArrowLeft } from 'lucide-react';

export default function CECStep({
  values,
  update,
  onComplete,
}: {
  values: Record<string, number>;
  update: (id: string, v: number) => void;
  onComplete?: () => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 1; // one question per screen
  const all = CEC_ITEMS;
  const pages = all.length;
  const item = all[Math.max(0, Math.min(page, pages - 1))];
  const cardRef = useRef<HTMLDivElement|null>(null);
  const [highlight, setHighlight] = useState<boolean>(false);

  useEffect(() => {
    try { cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    setHighlight(true);
    const t = setTimeout(() => setHighlight(false), 700);
    return () => clearTimeout(t);
  }, [item?.id]);

  return (
    <div className="grid gap-5">
      {/* Sub progress dashes */}
      <div className="flex items-center gap-1">
        {all.map((_, i) => (
          <div key={i} className={[
            'h-1.5 rounded-full',
            i === page ? 'w-8 bg-sky-500' : 'w-4 bg-muted'
          ].join(' ')} />
        ))}
      </div>

      {/* Single question card */}
      <div
        ref={cardRef}
        className={[
          'rounded-md border p-4 transition-shadow',
          (page % 2 === 0) ? 'border-sky-100 bg-sky-50' : 'border-amber-100 bg-amber-50',
          highlight ? ((page % 2 === 0) ? 'ring-2 ring-sky-400 shadow-[0_0_0_6px_rgba(56,189,248,.12)] animate-pulse' : 'ring-2 ring-amber-400 shadow-[0_0_0_6px_rgba(251,191,36,.12)] animate-pulse') : ''
        ].join(' ')}
      >
        <div className="mb-2 text-sm font-semibold">{item.text}</div>
        <div className="flex flex-wrap gap-2">
          {CEC_SCALE.map(s => {
            const current = values?.[item.id] ?? -1;
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={current === s.value}
                onClick={()=> {
                  update(item.id, s.value);
                  if (page >= pages - 1) { onComplete && onComplete(); }
                  else { setPage(p => Math.min(pages - 1, p + 1)); }
                }}
                className={[
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  current === s.value ? 'border-sky-500 bg-white text-sky-700 shadow-[0_0_0_2px_rgba(56,189,248,.25)]' : 'hover:bg-white/70'
                ].join(' ')}
              >{s.value} {s.label}</button>
            );
          })}
        </div>
      </div>

      {/* Back arrow (icon-only, below card) */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={()=> setPage(Math.max(0, page-1))}
          disabled={page===0}
          aria-label="Back"
          className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


