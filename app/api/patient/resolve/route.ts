import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  try { return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, credential: applicationDefault() }); }
  catch { return initializeApp(); }
}

export async function GET(req: NextRequest) {
  try {
    const app = initAdmin();
    const db = getFirestore(app);
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    if (!token) return NextResponse.json({ ok:false, error:'token required' }, { status:400 });

    // Fast path via central index
    const linkDoc = await db.collection('patient_links').doc(token).get();
    if (linkDoc.exists) {
      const d = linkDoc.data() as any;
      return NextResponse.json({ ok:true, practiceId: d.practice_id, intakeId: d.intake_id, birthdate: d.birthdate || '' });
    }
    // Fallback: search per practice (slower)
    const practicesSnap = await db.collection('practices').get();
    for (const p of practicesSnap.docs) {
      const qs = await db.collection(`practices/${p.id}/intakes`).where('patient_link.token', '==', token).limit(1).get();
      if (!qs.empty) {
        const found = qs.docs[0].data() as any;
        return NextResponse.json({ ok:true, practiceId: p.id, intakeId: found.intake_id, birthdate: found?.payload?.profile?.birthdate || '' });
      }
    }
    return NextResponse.json({ ok:false, error:'Not found' }, { status:404 });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Resolve failed' }, { status:500 });
  }
}


