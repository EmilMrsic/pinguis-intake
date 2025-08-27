"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

firebaseClient();

export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace('/provider/login'); return; }
      try {
        const token = await u.getIdTokenResult();
        const role = (token.claims as any)?.role ?? '';
        if (role === 'clinician' || role === 'admin') router.replace('/provider');
        else router.replace('/start');
      } catch {
        router.replace('/provider/login');
      }
    });
    return () => { try { unsub(); } catch {} };
  }, [router]);

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <p className="text-sm text-muted-foreground">Redirecting…</p>
    </main>
  );
}


