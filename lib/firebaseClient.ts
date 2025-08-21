import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

export function firebaseClient(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  } as const;
  try {
    if (typeof window !== 'undefined') {
      const masked = {
        apiKeyPrefix: (cfg.apiKey || '').slice(0, 6),
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        hasStorageBucket: !!cfg.storageBucket,
        hasAppId: !!cfg.appId,
      };
      (window as any).__FB_CFG__ = masked;
      // Enable via: localStorage.setItem('INTAKE_DEBUG','1')
      if (localStorage.getItem('INTAKE_DEBUG') === '1' || (window as any).__INTAKE_DEBUG__ === true) {
        // eslint-disable-next-line no-console
        console.log('[FB cfg]', masked);
      }
    }
  } catch {}
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId) {
    // eslint-disable-next-line no-console
    console.error('[FB cfg] Missing Firebase env. Check NEXT_PUBLIC_* in .env.local and restart dev server.');
  }
  const app = initializeApp(cfg);
  return app;
}


