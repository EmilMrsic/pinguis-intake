"use client";
import Link from 'next/link';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

firebaseClient();

export default function StartPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => setUserEmail(u?.email ?? null));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold">Start Intake</h1>
        <p className="mt-2 text-muted-foreground">Begin a new adaptive intake or resume a draft.</p>
        <div className="mt-6 flex items-center gap-3">
          {userEmail ? (
            <>
              <span className="text-sm">Signed in as {userEmail}</span>
              <Button variant="ghost" onClick={() => signOut(getAuth())}>Sign out</Button>
            </>
          ) : (
            <Link href="/login"><Button>Login</Button></Link>
          )}
          <Link href="/intake"><Button variant="secondary">Go to Intake</Button></Link>
        </div>
      </section>
    </main>
  );
}


