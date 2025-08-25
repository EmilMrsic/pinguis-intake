"use client";
import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseClient } from '@/lib/firebaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

firebaseClient();

export default function ProviderLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdTokenResult();
      const role = (token.claims as any)?.role ?? "";
      if (role !== "clinician" && role !== "admin") {
        setError("Provider account required. Please contact support.");
        return;
      }
      router.push('/provider');
    } catch (err: any) {
      setError(err?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-gradient-to-b from-white to-slate-50 px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Provider sign in</h1>
          <p className="text-sm text-muted-foreground">Use your clinician/admin credentials.</p>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <Input id="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} type="email" required />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <Input id="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} type="password" required />
          </div>
          <Button disabled={loading} type="submit" className="mt-2">{loading ? 'Signing in…' : 'Sign in'}</Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </main>
  );
}


