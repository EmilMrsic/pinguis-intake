import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    credential: applicationDefault(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { practiceId, intakeId, email, clientId } = await req.json();
    if (!practiceId) return NextResponse.json({ ok: false, error: 'practiceId required' }, { status: 400 });
    const app = initAdmin();
    const db = getFirestore(app);
    const col = db.collection(`practices/${practiceId}/intakes`);

    async function docToResp(doc: FirebaseFirestore.DocumentSnapshot) {
      if (!doc.exists) return null;
      const data = doc.data() || {} as any;
      return { intakeId: data.intake_id || doc.id, payload: data.payload || {} };
    }

    if (intakeId) {
      const d = await col.doc(intakeId).get();
      const resp = await docToResp(d);
      return NextResponse.json({ ok: true, ...resp });
    }

    function pickLatest(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
      if (!docs.length) return null;
      let pick = docs[0];
      for (const d of docs) {
        const a = (d.data() as any)?.updated_at || '';
        const b = (pick.data() as any)?.updated_at || '';
        if (a > b) pick = d;
      }
      return pick;
    }

    // Prefer by email
    if (email) {
      const qs = await col.where('payload.profile.email', '==', email).get();
      if (!qs.empty) {
        // Prefer incomplete
        const incomplete = qs.docs.filter(d => (d.data() as any)?.complete !== true);
        const cand = pickLatest(incomplete.length ? incomplete : qs.docs);
        if (!cand) return NextResponse.json({ ok: true, intakeId: null, payload: {} });
        const resp = await docToResp(cand);
        return NextResponse.json({ ok: true, ...resp });
      }
    }

    // Fallback by client_id
    if (clientId) {
      const qs = await col.where('client_id', '==', clientId).get();
      if (!qs.empty) {
        const incomplete = qs.docs.filter(d => (d.data() as any)?.complete !== true);
        const cand = pickLatest(incomplete.length ? incomplete : qs.docs);
        if (!cand) return NextResponse.json({ ok: true, intakeId: null, payload: {} });
        const resp = await docToResp(cand);
        return NextResponse.json({ ok: true, ...resp });
      }
    }

    return NextResponse.json({ ok: true, intakeId: null, payload: {} });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Load failed' }, { status: 500 });
  }
}


