import { useEffect, useState } from 'react';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { loadIntake } from '../../intake/intakeApi';

export function useIntakeBootstrap(applyLoaded: (loaded: any)=>void, opts: { practiceId: string; clientId: string }) {
  const [loadingIntake, setLoadingIntake] = useState<boolean>(true);
  useEffect(() => {
    const app = firebaseClient();
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        const email = u?.email || '';
        if (!email) { setLoadingIntake(false); return; }
        const data = await loadIntake({ practiceId: opts.practiceId, email, clientId: opts.clientId });
        if (data?.payload) applyLoaded(data.payload);
      } catch {} finally { setLoadingIntake(false); }
    });
    return () => { try { unsub(); } catch {} };
  }, [applyLoaded, opts.clientId, opts.practiceId]);
  return { loadingIntake } as const;
}


