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

export async function GET(req: NextRequest) {
  try {
    const app = initAdmin();
    const idToken = (req.headers.get('authorization') || '').replace('Bearer ','');
    if (!idToken) return NextResponse.json({ ok:false, error:'Missing token' }, { status:401 });
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);
    const role = (decoded as any)?.role ?? '';
    if (role !== 'clinician' && role !== 'admin') {
      return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
    }
    const practiceId = (decoded as any)?.practice_id as string | undefined;
    if (!practiceId) return NextResponse.json({ ok:false, error:'Missing practice claim' }, { status:400 });

    const db = getFirestore(app);
    const col = db.collection(`practices/${practiceId}/intakes`);
    const qs = await col.get();
    const items = qs.docs.map(d => {
      const data = d.data() as any;
      const profile = data?.payload?.profile || {};
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || d.id;
      return {
        intake_id: data.intake_id || d.id,
        client_id: data.client_id,
        name,
        email: profile.email || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        complete: !!data.complete,
        map_complete: !!data.map_complete,
      };
    });
    return NextResponse.json({ ok:true, items });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || 'List failed' }, { status:500 });
  }
}


