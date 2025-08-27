"use client";
import Link from 'next/link';

export default function SessionOverviewShell({ params }: { params: { patientId: string; sessionId: string } }) {
  const { patientId, sessionId } = params;
  return (
    <main className="min-h-dvh grid grid-cols-[18rem_1fr]">
      <aside className="border-r bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 p-4">
        <div className="mb-2 text-sm"><Link className="underline" href={`/provider/patients/${patientId}`}>← Sessions</Link></div>
        <nav className="space-y-1 text-sm">
          <Link className="block rounded px-3 py-2 hover:bg-slate-50" href={`/provider/patients/${patientId}/sessions/${sessionId}`}>Overview</Link>
          <Link className="block rounded px-3 py-2 hover:bg-slate-50" href={`/provider/patients/${patientId}/sessions/${sessionId}/intake`}>Intake</Link>
          <Link className="block rounded px-3 py-2 hover:bg-slate-50" href={`/provider/patients/${patientId}/sessions/${sessionId}/gap`}>Gap</Link>
          <Link className="block rounded px-3 py-2 hover:bg-slate-50" href={`/provider/patients/${patientId}/sessions/${sessionId}/map`}>Map</Link>
        </nav>
      </aside>
      <section className="p-6">
        <div className="rounded-2xl border sel-card p-6">
          <h1 className="text-xl font-semibold">Session Overview</h1>
          <p className="text-sm text-muted-foreground">Use tabs on the left to open artifacts.</p>
        </div>
      </section>
    </main>
  );
}


