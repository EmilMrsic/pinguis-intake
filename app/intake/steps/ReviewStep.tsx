"use client";
import React from 'react';
import { Button } from '@/components/ui/button';

const ORDER = ['daily','sleep','cec','metabolic','isi'];

export default function ReviewStep({
  recaps,
  onEdit,
  loadingSection,
}: {
  recaps: Record<string, any>;
  onEdit: (section: string) => void;
  loadingSection?: string | null;
}) {
  const entries = ORDER
    .map(key => [key, (recaps||{})[key]] as [string, any])
    .filter(([,card]) => !!card);
  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground">Summaries will appear here as you complete sections.</div>;
  }
  return (
    <div className="grid gap-4">
      {entries.map(([section, card]) => (
        <div key={section} className="rounded-md border p-4 bg-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-base font-semibold">{card?.title || 'Section Summary'}</div>
              <div className="text-sm mt-1">{card?.recap}</div>
            </div>
            <div className="text-xs text-muted-foreground" />
          </div>
          {Array.isArray(card?.highlights) && card.highlights.length>0 && (
            <ul className="list-disc pl-5 mt-2 text-sm">
              {card.highlights.slice(0,4).map((h:string,i:number)=>(<li key={i}>{h}</li>))}
            </ul>
          )}
          {Array.isArray(card?.flags) && card.flags.length>0 && (
            <div className="mt-2 text-xs text-amber-700">{card.flags[0]}</div>
          )}
          <div className="mt-3">
            <Button size="sm" onClick={()=>onEdit(section)} disabled={loadingSection===section}>
              {loadingSection===section ? 'Polishing your summary…' : 'Edit this section'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}


