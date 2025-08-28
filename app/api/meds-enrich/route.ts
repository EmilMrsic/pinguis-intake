import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  try {
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, credential: applicationDefault() });
  } catch {
    return initializeApp();
  }
}

function slugify(input: string): string {
  const base = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
  return base.slice(0, 96);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const practiceId: string = String(body?.practiceId || '').trim();
    const intakeId: string = String(body?.intakeId || '').trim();
    const kind: 'med' | 'supp' = (body?.kind === 'supp' ? 'supp' : 'med');
    const name: string = String(body?.name || '').trim();
    if (!practiceId || !intakeId || !name) {
      return NextResponse.json({ ok: false, error: 'Missing practiceId/intakeId/name' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sys = 'You are a careful medical information summarizer. Respond with strict JSON only. No advice or diagnosis.';
    const user = `For the ${kind === 'med' ? 'medication' : 'supplement'} "${name}", provide:
1) top_reasons: 1-3 most common clinical reasons/indications in plain language.
2) side_effects: 1-5 common side effects in plain language.
Output strict JSON: {"top_reasons":["..."],"side_effects":["..."]}.`;
    let top_reasons: string[] = [];
    let side_effects: string[] = [];
    try {
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini', temperature: 0.2,
        messages: [ { role: 'system', content: sys }, { role: 'user', content: user } ],
      });
      const txt = resp.choices?.[0]?.message?.content || '{}';
      const data = JSON.parse(txt);
      if (Array.isArray(data?.top_reasons)) top_reasons = data.top_reasons.map((s: any)=> String(s||'').trim()).filter(Boolean).slice(0,3);
      if (Array.isArray(data?.side_effects)) side_effects = data.side_effects.map((s: any)=> String(s||'').trim()).filter(Boolean).slice(0,5);
    } catch {}

    const app = initAdmin();
    const db = getFirestore(app);
    const col = kind === 'med' ? 'meds_enrichment' : 'supps_enrichment';
    const id = slugify(name);
    const ref = db.doc(`practices/${practiceId}/intakes/${intakeId}/${col}/${id}`);
    const now = new Date().toISOString();
    await ref.set({
      name,
      top_reasons,
      side_effects,
      updated_at: now,
    }, { merge: true });

    return NextResponse.json({ ok: true, name, top_reasons, side_effects });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'enrich failed' }, { status: 500 });
  }
}


