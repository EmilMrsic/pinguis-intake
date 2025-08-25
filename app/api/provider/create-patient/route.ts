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

    const body = await req.json();
    const { first_name, last_name, email, phone, birth_month, birth_day, birth_year } = body || {};
    const birthdate = (birth_year && birth_month && birth_day) ? `${birth_year}-${birth_month}-${birth_day}` : (body?.birthdate || null);
    if (!first_name || !last_name || !email) {
      return NextResponse.json({ ok:false, error:'Missing fields' }, { status:400 });
    }

    const db = getFirestore(app);
    const now = new Date().toISOString();
    // Create client document
    const clientRef = await db.collection(`practices/${practiceId}/clients`).add({
      practice_id: practiceId,
      first_name, last_name, email, phone: phone || null, birthdate: birthdate || null,
      created_at: now,
      updated_at: now,
    });
    const client_id = clientRef.id;

    // Create initial intake placeholder (not complete, no map)
    const intake_id = `${(first_name as string).slice(0,1)}${(last_name as string).slice(0,1)}`.toLowerCase() + Math.random().toString().slice(2,8);
    const intakeRef = db.doc(`practices/${practiceId}/intakes/${intake_id}`);
    const payload = {
      intakeId: intake_id,
      profile: { first_name, last_name, email, phone: phone || '', birthdate: birthdate || '' },
    };
    await intakeRef.set({
      practice_id: practiceId,
      client_id,
      intake_id,
      payload,
      created_at: now,
      updated_at: now,
      complete: false,
      map_complete: false,
    }, { merge: false });

    return NextResponse.json({ ok:true, client_id, intake_id });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Create failed' }, { status:500 });
  }
}


