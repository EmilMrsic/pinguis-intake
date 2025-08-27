"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMap } from '@/app/provider/services/SessionService';

export default function OverviewPage({ params }: { params: { patientId: string; sessionId: string } }) {
  const { patientId, sessionId } = params;
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => { (async () => { try { const m = await getMap(patientId, sessionId); setThumb(m?.files?.pngThumbUrl || null); } catch {} })(); }, [patientId, sessionId]);
  return (
    <main className="p-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Link href={`/provider/patients/${patientId}/sessions/${sessionId}/intake`} className="rounded-2xl border sel-card p-5 block">
          <div className="font-semibold">Intake</div>
          <div className="text-sm text-muted-foreground">Open intake for this session</div>
        </Link>
        <Link href={`/provider/patients/${patientId}/sessions/${sessionId}/gap`} className="rounded-2xl border sel-card p-5 block">
          <div className="font-semibold">Gap reports</div>
          <div className="text-sm text-muted-foreground">View or create reports</div>
        </Link>
        <Link href={`/provider/patients/${patientId}/sessions/${sessionId}/map`} className="rounded-2xl border sel-card p-5 block">
          <div className="font-semibold">Map</div>
          <div className="text-sm text-muted-foreground">Brain mapping</div>
          {thumb && (
            <div className="mt-3 rounded border overflow-hidden bg-black/80" style={{ aspectRatio:'16/9' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Map thumbnail" src={thumb} className="w-full h-full object-contain" />
            </div>
          )}
        </Link>
      </div>
    </main>
  );
}


