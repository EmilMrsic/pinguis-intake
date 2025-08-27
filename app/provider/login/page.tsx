"use client";
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup } from 'firebase/auth';
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
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const token = await u.getIdTokenResult();
      const role = (token.claims as any)?.role ?? '';
      if (role === 'clinician' || role === 'admin') router.replace('/provider');
    });
    return () => { try { unsub(); } catch {} };
  }, [router]);

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

  async function signInWithGoogle() {
    setError(null);
    setOauthLoading('google');
    try {
      const auth = getAuth();
      const prov = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, prov);
      const token = await cred.user.getIdTokenResult();
      const role = (token.claims as any)?.role ?? '';
      if (role !== 'clinician' && role !== 'admin') throw new Error('Provider role required');
      router.push('/provider');
    } catch (e:any) {
      setError(e?.message || 'Google sign-in failed');
    } finally {
      setOauthLoading(null);
    }
  }

  async function signInWithApple() {
    setError(null);
    setOauthLoading('apple');
    try {
      const auth = getAuth();
      const prov = new OAuthProvider('apple.com');
      const cred = await signInWithPopup(auth, prov);
      const token = await cred.user.getIdTokenResult();
      const role = (token.claims as any)?.role ?? '';
      if (role !== 'clinician' && role !== 'admin') throw new Error('Provider role required');
      router.push('/provider');
    } catch (e:any) {
      setError(e?.message || 'Apple sign-in failed');
    } finally {
      setOauthLoading(null);
    }
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Form column */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-xl rounded-2xl border sel-card bg-card shadow-sm p-8 md:p-10" role="region" aria-labelledby="login-heading" aria-describedby="login-subtext" aria-live="polite">
          {/* Brand row */}
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <div aria-hidden>🧨</div>
            <div>Pinguis Vir</div>
          </div>
          {/* Heading */}
          <h1 id="login-heading" className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back</h1>
          <p id="login-subtext" className="mt-1 text-muted-foreground">Hello Providers</p>

          <form onSubmit={onSubmit} className="mt-8 grid gap-6" aria-live="polite">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <Input id="email" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="h-11" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <Input id="password" value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="h-11" />
            </div>

            {/* Options row */}
            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-sm underline hover:no-underline">Forgot password?</a>
            </div>

            <Button disabled={loading || !!oauthLoading} type="submit" className="h-11 w-full">
              {loading ? 'Signing in…' : 'Sign in to your account'}
            </Button>

            {/* Divider */}
            <div className="relative text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative inline-block bg-card px-3 text-sm text-muted-foreground">or</div>
            </div>

            {/* OAuth */}
            <div className="grid gap-3">
              <Button type="button" variant="outline" className="h-11 w-full justify-start gap-3" disabled={!!oauthLoading || loading} onClick={signInWithGoogle}>
                <span aria-hidden className="inline-block">🟦</span>
                <span>Sign in with Google</span>
              </Button>
              <Button type="button" variant="outline" className="h-11 w-full justify-start gap-3" disabled={!!oauthLoading || loading} onClick={signInWithApple}>
                <span aria-hidden className="inline-block"></span>
                <span>Sign in with Apple</span>
              </Button>
            </div>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </form>
        </div>
      </div>

      {/* Illustration column */}
      <div className="hidden md:flex items-center justify-center p-10">
        <div className="aspect-[4/3] w-full max-w-2xl rounded-2xl border bg-muted/40 grid place-content-center text-muted-foreground">
          Illustration Placeholder
        </div>
      </div>
    </main>
  );
}


