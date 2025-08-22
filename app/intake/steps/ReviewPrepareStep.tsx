"use client";
import React from 'react';
import { Button } from '@/components/ui/button';

export default function ReviewPrepareStep({
  payload,
  onReady,
  onBack,
}: {
  payload: any;
  onReady: () => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function buildAll() {
    setBusy(true);
    try {
      const sections = ['daily','sleep','cec','metabolic','isi'];
      const recaps: Record<string, any> = { ...(payload?.recaps||{}) };
      for (const section of sections) {
        const inputs = (payload||{})[section] || {};
        const res = await fetch('/api/section-recap', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ section, inputs, name: payload?.profile?.first_name||'' }) });
        const data = await res.json().catch(()=>({}));
        if (data?.recap) recaps[section] = data.recap;
      }
      // write back via event (Flow updates on navigate)
      try { (window as any).dispatchEvent(new CustomEvent('review-recaps-ready', { detail: { recaps } })); } catch {}
    } finally {
      setBusy(false);
      onReady();
    }
  }

  return (
    <div className="grid gap-4">
      <div className="text-sm text-muted-foreground">Before we show your review, we’ll quickly polish your summaries so nothing is missing.</div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack} disabled={busy}>Back</Button>
        <Button onClick={buildAll} disabled={busy}>{busy ? 'Building summaries…' : 'Build my summaries'}</Button>
      </div>
    </div>
  );
}


