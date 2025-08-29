import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
    const body = await req.json();
    const { practiceId, intakeId } = body || {};
    if (!practiceId || !intakeId) {
      return NextResponse.json({ ok: false, error: 'Missing practiceId or intakeId' }, { status: 400 });
    }
    const app = initAdmin();
    const db = getFirestore(app);
    const ref = db.doc(`practices/${practiceId}/intakes/${intakeId}`);
    await ref.update({ 'payload.adaptive': FieldValue.delete() });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to clear adaptive' }, { status: 500 });
  }
}


