"use client";
import { useEffect, useMemo, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type GapQ = { id: string; text: string; rationale?: string; type?: string };
type GapSection = { title: string; questions: GapQ[] };

export function GapReportForm({ intakeId, initial }: { intakeId: string; initial?: { sections?: GapSection[]; answers?: Record<string, any> } }) {
  const [sections, setSections] = useState<GapSection[]>(initial?.sections || []);
  const [answers, setAnswers] = useState<Record<string, any>>(initial?.answers || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (initial?.sections) setSections(initial.sections); if (initial?.answers) setAnswers(initial.answers); }, [initial]);

  async function onSave() {
    setSaving(true); setError(null);
    try {
      const auth = getAuth();
      const u = auth.currentUser!;
      const res = await fetch('/api/provider/gap-report/save', { method:'POST', headers:{'Content-Type':'application/json', Authorization: `Bearer ${await u.getIdToken()}`}, body: JSON.stringify({ intakeId, answers }) });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.error || 'Save failed');
    } catch (e:any) { setError(e?.message || 'Save failed'); } finally { setSaving(false); }
  }

  if (!sections?.length) return null;
  return (
    <Card>
      <CardHeader className="flex items-center justify-between sm:flex-row sm:items-center">
        <CardTitle>Gap Report — Provider Questionnaire</CardTitle>
        <div className="flex gap-2">
          {error && <span className="text-sm text-red-600">{error}</span>}
          <Button size="sm" onClick={onSave} disabled={saving}>{saving?'Saving…':'Save'}</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {sections.map((s) => (
          <div key={s.title} className="space-y-2">
            <div className="text-sm font-semibold text-slate-800 sticky top-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-l-4 border-slate-300 pl-2">{s.title}</div>
            <div className="grid gap-3">
              {s.questions.map((q) => (
                <div key={q.id} className="grid gap-1 rounded-md border p-3 bg-white shadow-sm">
                  <span className="text-sm font-medium">{q.text}</span>
                  {q.rationale && <span className="text-xs text-slate-600">Why this matters: {q.rationale}</span>}
                  {q.type === 'rating_0_10' ? (
                    <div className="grid gap-1">
                      <Slider min={0} max={10} step={1} value={[Number(answers[q.id] ?? 0)]} onValueChange={(v)=>setAnswers(prev=>({ ...prev, [q.id]: v[0] }))} />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        {Array.from({length:11},(_,i)=>i).map(n=> <span key={n}>{n}</span>)}
                      </div>
                    </div>
                  ) : (
                    <input className="border rounded px-2 py-1" value={answers[q.id] ?? ''} onChange={(e)=>setAnswers(prev=>({ ...prev, [q.id]: e.target.value }))} placeholder="Type short answer…" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


