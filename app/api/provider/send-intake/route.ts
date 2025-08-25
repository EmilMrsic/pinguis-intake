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

    const { intakeId } = await req.json();
    if (!intakeId) return NextResponse.json({ ok:false, error:'intakeId required' }, { status:400 });

    const db = getFirestore(app);
    const ref = db.doc(`practices/${practiceId}/intakes/${intakeId}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok:false, error:'Not found' }, { status:404 });
    const data = snap.data() as any;
    const birthdate = data?.payload?.profile?.birthdate || '';
    const token = Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,6);
    const expires_at = new Date(Date.now() + 1000*60*60*24*7).toISOString();
    await ref.set({ patient_link: { token, expires_at } }, { merge: true });
    // Also write a lightweight resolver doc for O(1) lookups
    try {
      await db.collection('patient_links').doc(token).set({ practice_id: practiceId, intake_id: intakeId, client_id: data?.client_id || null, birthdate, expires_at }, { merge: true });
    } catch {}
    return NextResponse.json({ ok:true, link: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/patient/start?token=${token}`, token, expires_at, birthdate_present: !!birthdate });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Send failed' }, { status:500 });
  }
}


