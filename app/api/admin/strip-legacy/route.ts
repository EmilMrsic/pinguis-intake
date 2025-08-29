import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  try {
    return initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      credential: applicationDefault(),
    });
  } catch {
    return initializeApp();
  }
}

export async function POST(req: NextRequest) {
  try {
    const app = initAdmin();
    const auth = getAuth(app);
    const db = getFirestore(app);

    const idToken = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (!idToken) return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 401 });
    const decoded = await auth.verifyIdToken(idToken);
    const role = (decoded as any)?.role ?? '';
    if (role !== 'admin') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { practiceId, intakeId, dryRun } = body || {};
    if (!practiceId) return NextResponse.json({ ok: false, error: 'practiceId required' }, { status: 400 });

    if (intakeId) {
      const ref = db.doc(`practices/${practiceId}/intakes/${intakeId}`);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
      const data = snap.data() as any;
      const payload = { ...(data?.payload || {}) } as any;
      const hasMetabolic = typeof payload?.metabolic === 'object' && payload.metabolic !== null;
      const hasIsi = typeof payload?.isi === 'object' && payload.isi !== null;
      if (!dryRun) {
        try { if (hasMetabolic) delete payload.metabolic; } catch {}
        try { if (hasIsi) delete payload.isi; } catch {}
        if (hasMetabolic || hasIsi) await ref.set({ payload }, { merge: true });
      }
      return NextResponse.json({ ok: true, total: 1, candidates: (hasMetabolic || hasIsi) ? 1 : 0, updated: (!dryRun && (hasMetabolic || hasIsi)) ? 1 : 0, dryRun: !!dryRun });
    }

    const col = db.collection(`practices/${practiceId}/intakes`);
    const qs = await col.get();
    let candidates = 0;
    let updated = 0;
    for (const d of qs.docs) {
      const data = d.data() as any;
      const payload = { ...(data?.payload || {}) } as any;
      const hasMetabolic = typeof payload?.metabolic === 'object' && payload.metabolic !== null;
      const hasIsi = typeof payload?.isi === 'object' && payload.isi !== null;
      if (hasMetabolic || hasIsi) {
        candidates++;
        if (!dryRun) {
          try { if (hasMetabolic) delete payload.metabolic; } catch {}
          try { if (hasIsi) delete payload.isi; } catch {}
          await d.ref.set({ payload }, { merge: true });
          updated++;
        }
      }
    }
    return NextResponse.json({ ok: true, total: qs.size, candidates, updated, dryRun: !!dryRun });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Cleanup failed' }, { status: 500 });
  }
}


