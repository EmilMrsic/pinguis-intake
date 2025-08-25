import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  try { return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, credential: applicationDefault() }); }
  catch { return initializeApp(); }
}

export async function POST(req: NextRequest) {
  try {
    const app = initAdmin();
    const idToken = (req.headers.get('authorization') || '').replace('Bearer ','');
    if (!idToken) return NextResponse.json({ ok:false, error:'Missing token' }, { status:401 });
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);
    const role = (decoded as any)?.role ?? '';
    if (role !== 'clinician' && role !== 'admin') return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
    const practiceId = (decoded as any)?.practice_id as string | undefined;
    if (!practiceId) return NextResponse.json({ ok:false, error:'Missing practice claim' }, { status:400 });

    const { intakeId, answers } = await req.json();
    if (!intakeId || typeof answers !== 'object') return NextResponse.json({ ok:false, error:'intakeId and answers required' }, { status:400 });

    const db = getFirestore(app);
    const ref = db.doc(`practices/${practiceId}/intakes/${intakeId}`);
    const now = new Date().toISOString();
    await ref.set({ gap_report: { answers, updated_at: now } }, { merge: true });
    return NextResponse.json({ ok:true, updated_at: now });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Save failed' }, { status:500 });
  }
}


