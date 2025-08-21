import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  // Prefer ADC when present; otherwise best-effort init
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
    const body = await req.json();
    const { practiceId, clientId, intakeId, payload, complete } = body || {};
    if (!practiceId || !clientId || !payload) return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 });

    const app = initAdmin();
    const db = getFirestore(app);
    const id = intakeId || (payload?.intakeId) || 'unknown';
    const ref = db.doc(`practices/${practiceId}/intakes/${id}`);
    const now = new Date().toISOString();
    const doc = await ref.get();
    const prev = doc.exists ? (doc.data() as any) : {};
    const data: any = {
      practice_id: practiceId,
      client_id: clientId,
      intake_id: id,
      // preserve created_at and complete if previously set
      created_at: prev?.created_at || now,
      complete: (prev?.complete === true) || (complete === true) ? true : undefined,
      updated_at: now,
      payload, // replace payload fully so removed nested keys are dropped
    };
    // Remove undefined fields so Firestore doesn't store them
    if (data.complete === undefined) delete data.complete;
    await ref.set(data, { merge: false });

    return NextResponse.json({ ok: true, intakeId: id, updated_at: now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Save failed' }, { status: 500 });
  }
}


