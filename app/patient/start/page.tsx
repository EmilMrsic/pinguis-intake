"use client";
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function PatientStartPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string>('');
  const [intakeId, setIntakeId] = useState<string>('');
  const [birthdateOnFile, setBirthdateOnFile] = useState<string>('');
  const [mm, setMM] = useState<string>('');
  const [dd, setDD] = useState<string>('');
  const [yyyy, setYYYY] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/patient/resolve?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok || data.ok === false) throw new Error(data?.error || 'Invalid link');
        setPracticeId(data.practiceId);
        setIntakeId(data.intakeId);
        setBirthdateOnFile(data.birthdate || '');
      } catch (e:any) { setError(e?.message || 'Invalid link'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  function toIsoFromParts(m: string, d: string, y: string): string | null {
    if (!m || !d || !y) return null;
    if (!/^\d{2}$/.test(m) || !/^\d{2}$/.test(d) || !/^\d{4}$/.test(y)) return null;
    return `${y}-${m}-${d}`;
  }

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    const isoEntered = toIsoFromParts(mm, dd, yyyy);
    if (!birthdateOnFile || (isoEntered && isoEntered === birthdateOnFile)) {
      // route to intake runner with query override
      router.push(`/intake?practiceId=${encodeURIComponent(practiceId)}&intakeId=${encodeURIComponent(intakeId)}&asPatient=1&token=${encodeURIComponent(token)}`);
    } else {
      setError('Birthdate does not match. Please enter as MM/DD/YYYY and try again.');
    }
  }

  if (loading) return <main className="min-h-dvh grid place-items-center"><p>Loading…</p></main>;
  if (error) return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-xl font-semibold">Patient link</h1>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    </main>
  );

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <form onSubmit={onContinue} className="w-full max-w-md grid gap-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Confirm your birthdate</h1>
          <p className="text-sm text-muted-foreground">We use this to make sure your information stays private.</p>
        </div>
        {!!birthdateOnFile && (
          <div className="grid grid-cols-3 gap-2">
            <select aria-label="Month" value={mm} onChange={e=>setMM(e.target.value)} required className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">MM</option>
              <option value="01">Jan - 01</option>
              <option value="02">Feb - 02</option>
              <option value="03">Mar - 03</option>
              <option value="04">Apr - 04</option>
              <option value="05">May - 05</option>
              <option value="06">Jun - 06</option>
              <option value="07">Jul - 07</option>
              <option value="08">Aug - 08</option>
              <option value="09">Sep - 09</option>
              <option value="10">Oct - 10</option>
              <option value="11">Nov - 11</option>
              <option value="12">Dec - 12</option>
            </select>
            <select aria-label="Day" value={dd} onChange={e=>setDD(e.target.value)} required className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">DD</option>
              {Array.from({length:31},(_,i)=>i+1).map(d=> <option key={d} value={String(d).padStart(2,'0')}>{String(d).padStart(2,'0')}</option>)}
            </select>
            <select aria-label="Year" value={yyyy} onChange={e=>setYYYY(e.target.value)} required className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">YYYY</option>
              {Array.from({length:120},(_,i)=>new Date().getFullYear()-i).map(y=> <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {!birthdateOnFile && <p className="text-sm text-muted-foreground">No birthdate on file. Continue to start your intake.</p>}
        <Button type="submit">Continue</Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}


