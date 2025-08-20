"use client";
import { useEffect, useState } from 'react';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Runner from './Runner';

firebaseClient();

export default function IntakePage() {
  const [status, setStatus] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => setUserEmail(u?.email ?? null));
  }, []);


  return (
    <main style={{ display: 'grid', gap: 12 }}>
      <h1>Intake</h1>
      <p>{userEmail ? `Signed in as ${userEmail}` : 'Not signed in'}</p>
      <Runner />
    </main>
  );
}


