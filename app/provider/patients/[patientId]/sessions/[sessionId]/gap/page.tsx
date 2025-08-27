"use client";
import { useEffect, useState } from 'react';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { listGapReports, createGapReport } from '@/app/provider/services/SessionService';
import { Button } from '@/components/ui/button';

firebaseClient();

export default function GapListPage({ params }: { params: { patientId: string; sessionId: string } }) {
  const { patientId, sessionId } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|undefined>();
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setError('Not signed in'); setLoading(false); return; }
      try {
        const items = await listGapReports(patientId, sessionId);
        setReports(items);
      } catch (e:any) { setError(e?.message || 'Failed to load'); }
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, [patientId, sessionId]);

  async function onCreate() {
    try {
      const r = await createGapReport(patientId, sessionId, {});
      setReports((prev)=>[r, ...prev]);
    } catch (e:any) { setError(e?.message || 'Create failed'); }
  }

  if (loading) return <main className="p-6">Loading…</main>;
  if (error) return <main className="p-6 text-red-600">{error}</main>;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">Gap reports</div>
        <Button onClick={onCreate}>New gap report</Button>
      </div>
      <div className="space-y-2">
        {reports.map(r=> (
          <div key={r.id} className="rounded-2xl border sel-card p-4">
            <div className="font-medium">Report {r.id.slice(0,6)}</div>
            <div className="text-xs text-muted-foreground">Updated {r.updatedAt}</div>
          </div>
        ))}
        {reports.length===0 && <div className="text-sm text-muted-foreground">No reports yet.</div>}
      </div>
    </main>
  );
}


