import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  try { return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, credential: applicationDefault() }); }
  catch { return initializeApp(); }
}

export async function GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const intakeId = url.searchParams.get('intakeId') || '';
    if (!intakeId) return NextResponse.json({ ok:false, error:'intakeId required' }, { status:400 });

    const db = getFirestore(app);
    const intakeRef = db.doc(`practices/${practiceId}/intakes/${intakeId}`);
    const snap = await intakeRef.get();
    if (!snap.exists) return NextResponse.json({ ok:false, error:'Not found' }, { status:404 });
    const intake = snap.data() as any;

    // Load spec (if present)
    let specMd = '';
    try { specMd = await readFile(join(process.cwd(), 'intake', 'specs', 'gap_spec.md'), 'utf8'); } catch {}

    // Call OpenAI to generate Markdown + JSON
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sys = 'You are a clinical assistant that generates provider-only follow-up questionnaires (Gap Report) based on intake JSON and a specification. Include at least one rating_0_10 question if any symptom severity or frequency is discussed.';
    const userPayload = {
      instruction: 'Generate a Gap Report with provider-only tone. Return both markdown and JSON. Keep concise but clinically meaningful.',
      intake,
      spec: specMd || 'No spec provided; use reasonable clinical heuristics.',
    };
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0.2,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    });
    const content = resp.choices?.[0]?.message?.content || '';

    // Simple splitter: expect JSON block then Markdown or vice versa; fallback to plain
    let outJson: any = null; let outMd = '';
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) outJson = JSON.parse(jsonMatch[0]);
    } catch {}
    // If content contains a markdown section beginning with #, keep that as markdown
    const mdIdx = content.indexOf('# ');
    outMd = mdIdx >= 0 ? content.slice(mdIdx).trim() : content;

    // Persist once under the intake to avoid re-generation on next open
    try {
      await intakeRef.set({ gap_report: { markdown: outMd, json: outJson, generated_at: new Date().toISOString() } }, { merge: true });
    } catch {}

    return NextResponse.json({ ok:true, markdown: outMd, json: outJson, cached: false });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Generate failed' }, { status:500 });
  }
}


