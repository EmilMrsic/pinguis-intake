import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const ALLOWED = ['sleep','dep','anx','focus','mem','imp','trauma','addictive','learn'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing text' }, { status: 400 });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You are a concise triage classifier. Categorize the user's concern into one of these buckets only: sleep, dep (mood & depression), anx (stress & anxiety), focus (focus & attention), mem (memory & thinking), imp (impulsivity), trauma (emotional trauma), addictive (addictive behavior), learn (learning issues).

Return strict JSON of the form {"category":"<one of: sleep|dep|anx|focus|mem|imp|trauma|addictive|learn>","reason":"<one sentence why>"}.

Concern: ${text}`;
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Classify succinctly and return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    });
    const content = resp.choices?.[0]?.message?.content || '';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {}
    const cat = String(parsed?.category || '').trim();
    const reason = String(parsed?.reason || '').trim();
    if (!ALLOWED.includes(cat as any)) {
      return NextResponse.json({ ok: true, category: null, reason: 'uncertain' });
    }
    return NextResponse.json({ ok: true, category: cat, reason });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to classify' }, { status: 500 });
  }
}


