import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

export async function GET(_req: NextRequest, { params }: { params: { intakeId: string } }) {
  try {
    const app = initAdmin();
    // Get token from cookies isn't accessible in Route Handler here reliably; use Authorization header instead
    // This endpoint is called from client with fetch including Authorization: Bearer <idToken>
    const idToken = (_req.headers.get('authorization') || '').replace('Bearer ','');
    if (!idToken) return NextResponse.json({ ok:false, error:'Missing token' }, { status:401 });
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);
    const role = (decoded as any)?.role ?? '';
    if (role !== 'clinician' && role !== 'admin') return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
    const practiceId = (decoded as any)?.practice_id as string | undefined;
    if (!practiceId) return NextResponse.json({ ok:false, error:'Missing practice claim' }, { status:400 });

    const intakeId = params.intakeId;
    const db = getFirestore(app);
    const ref = db.doc(`practices/${practiceId}/intakes/${intakeId}`);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ ok:false, error:'Not found' }, { status:404 });
    const data = doc.data() as any;
    return NextResponse.json({ ok:true, item: { ...data, intake_id: data?.intake_id || intakeId } });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Load failed' }, { status:500 });
  }
}


