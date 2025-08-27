"use client";
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseClient } from '@/lib/firebaseClient';
import { Button } from '@/components/ui/button';
import { getIntake, upsertIntake } from '@/app/provider/services/SessionService';

firebaseClient();

export default function SessionIntakePage({ params }: { params: { patientId: string; sessionId: string } }) {
  const { patientId, sessionId } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|undefined>();
  const [answers, setAnswers] = useState<any>({});

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setError('Not signed in'); setLoading(false); return; }
      try {
        const doc = await getIntake(patientId, sessionId);
        setAnswers(doc?.answers || {});
      } catch (e:any) { setError(e?.message || 'Failed to load'); }
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, [patientId, sessionId]);

  async function save() {
    try {
      await upsertIntake(patientId, sessionId, { answers });
    } catch (e:any) { setError(e?.message || 'Save failed'); }
  }

  if (loading) return <main className="p-6">Loading…</main>;
  if (error) return <main className="p-6 text-red-600">{error}</main>;

  return (
    <main className="p-6 space-y-4">
      <div className="rounded-2xl border sel-card p-6">
        <h1 className="text-xl font-semibold">Intake</h1>
        <p className="text-sm text-muted-foreground">Provider view (WIP). Editing saves to this session.</p>
      </div>
      <div className="rounded-2xl border p-4">
        <textarea className="w-full h-48 border rounded p-2" value={JSON.stringify(answers, null, 2)} onChange={(e)=>{
          try { setAnswers(JSON.parse(e.target.value)); } catch {}
        }} />
        <div className="mt-3"><Button onClick={save}>Save</Button></div>
      </div>
    </main>
  );
}


