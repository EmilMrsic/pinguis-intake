"use client";
import { useEffect, useMemo, useState } from 'react';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendIntakeButton } from './SendIntakeButton';

firebaseClient();

type IntakeRow = {
  intake_id: string;
  client_id: string;
  name: string;
  updated_at?: string;
  created_at?: string;
  complete?: boolean;
  map_complete?: boolean;
};

export default function ProviderDashboardPage() {
  const [rows, setRows] = useState<IntakeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [practiceId, setPracticeId] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); setError('Not signed in'); return; }
      const token = await u.getIdTokenResult();
      const role = (token.claims as any)?.role ?? '';
      if (role !== 'clinician' && role !== 'admin') { setError('Provider role required'); setLoading(false); return; }
      const pid = (token.claims as any)?.practice_id as string | undefined;
      if (!pid) { setError('No practice claim found'); setLoading(false); return; }
      setPracticeId(pid);
      try {
        const res = await fetch('/api/provider/intakes', { method:'GET', headers:{'Authorization': `Bearer ${await u.getIdToken()}`}});
        const data = await res.json();
        if (!res.ok || data.ok === false) throw new Error(data?.error || 'Failed to load');
        setRows(data.items || []);
      } catch (e: any) { setError(e?.message || 'Failed to load'); }
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a,b) => (b.updated_at||'').localeCompare(a.updated_at||''));
  }, [rows]);

  function formatMDY(dateIso?: string) {
    if (!dateIso) return '';
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'2-digit' });
  }

  async function onCreatePatient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget as HTMLFormElement;
    const fd = new FormData(formEl);
    const payload = Object.fromEntries(fd.entries());
    try {
      const auth = getAuth();
      const u = auth.currentUser!;
      const res = await fetch('/api/provider/create-patient', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await u.getIdToken()}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.error || 'Create failed');
      // refresh list
      const listRes = await fetch('/api/provider/intakes', { method:'GET', headers:{'Authorization': `Bearer ${await u.getIdToken()}`}});
      const list = await listRes.json();
      setRows(list.items || []);
      formEl.reset();
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    }
  }

  if (loading) return <main className="min-h-dvh grid place-items-center"><p>Loading…</p></main>;
  if (error) return <main className="min-h-dvh grid place-items-center"><p className="text-red-600">{error}</p></main>;

  return (
    <div className="min-h-dvh grid grid-cols-[16rem_1fr]">
      {/* Sidebar */}
      <aside className="border-r bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="p-4 text-lg font-semibold">Practice</div>
        <nav className="px-2 space-y-1">
          <a className="block rounded px-3 py-2 bg-slate-100 font-medium">Patients</a>
          <a className="block rounded px-3 py-2 hover:bg-slate-50">Appointments</a>
          <a className="block rounded px-3 py-2 hover:bg-slate-50">Profile</a>
        </nav>
      </aside>
      {/* Main */}
      <main className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Patients</h1>
            <p className="text-sm text-muted-foreground">Practice: {practiceId}</p>
          </div>
          {/* Modal trigger */}
          <PatientCreateDialog onSubmit={onCreatePatient} />
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] bg-slate-50 px-4 py-2 text-sm font-medium">
            <div>Name</div>
            <div>Updated</div>
            <div>Intake</div>
            <div>Map</div>
            <div>Actions</div>
          </div>
          {sorted.map((r) => (
            <div key={r.intake_id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-3 border-t text-sm">
              <a href={`/provider/patients/${r.intake_id}`} className="font-medium hover:underline">{r.name}</a>
              <div className="text-muted-foreground">{formatMDY(r.updated_at)}</div>
              <div>
                <span className={r.complete ? 'text-emerald-700' : 'text-slate-700'}>
                  {r.complete ? 'Complete' : 'In progress'}
                </span>
              </div>
              <div>
                <span className={r.map_complete ? 'text-emerald-700' : 'text-slate-700'}>
                  {r.map_complete ? 'Complete' : 'Not complete'}
                </span>
              </div>
              <div className="flex gap-2">
                <SendIntakeButton intakeId={r.intake_id} />
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No patients yet.</div>
          )}
        </div>
      </main>
    </div>
  );
}

function PatientCreateDialog({ onSubmit }: { onSubmit: (e: React.FormEvent<HTMLFormElement>) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button onClick={()=>setOpen(true)}>New patient</Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={()=>setOpen(false)}>
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg" onClick={e=>e.stopPropagation()}>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Create patient</h3>
              <p className="text-sm text-muted-foreground">Basic contact information</p>
            </div>
            <form className="grid gap-3" onSubmit={(e)=>{ onSubmit(e); setOpen(false); }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-sm font-medium">First name</label>
                  <Input name="first_name" required />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium">Last name</label>
                  <Input name="last_name" required />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" name="email" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-sm font-medium">Phone</label>
                  <Input name="phone" />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium">Birthdate</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select name="birth_month" className="h-10 rounded-md border border-input bg-background px-2 text-sm" required>
                      <option value="">Month</option>
                      <option value="01">Jan - 1</option>
                      <option value="02">Feb - 2</option>
                      <option value="03">Mar - 3</option>
                      <option value="04">Apr - 4</option>
                      <option value="05">May - 5</option>
                      <option value="06">Jun - 6</option>
                      <option value="07">Jul - 7</option>
                      <option value="08">Aug - 8</option>
                      <option value="09">Sep - 9</option>
                      <option value="10">Oct - 10</option>
                      <option value="11">Nov - 11</option>
                      <option value="12">Dec - 12</option>
                    </select>
                    <select name="birth_day" className="h-10 rounded-md border border-input bg-background px-2 text-sm" required>
                      <option value="">Day</option>
                      {Array.from({length:31},(_,i)=>i+1).map(d=> <option key={d} value={String(d).padStart(2,'0')}>{d}</option>)}
                    </select>
                    <select name="birth_year" className="h-10 rounded-md border border-input bg-background px-2 text-sm" required>
                      <option value="">Year</option>
                      {Array.from({length:120},(_,i)=>new Date().getFullYear()-i).map(y=> <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={()=>setOpen(false)}>Cancel</Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


