import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { POPULAR_MEDS, suggestMedsLocal } from '@/lib/intake/popularMeds';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get('q') || '').trim();
    const limit = Number(searchParams.get('limit') || 10);

    // Start with local suggestions for speed
    const local = suggestMedsLocal(q, limit);

    // Optionally ask OpenAI to expand suggestions
    let combined = local;
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && q.length >= 2) {
      try {
        const client = new OpenAI({ apiKey });
        const prompt = `Return a JSON array of up to ${limit} common medication names matching the query string, deduplicated and title-cased. Query: "${q}".`;
        const resp = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'You output only strict JSON arrays of strings. No prose.' },
            { role: 'user', content: prompt },
          ],
        });
        const txt = resp.choices?.[0]?.message?.content || '[]';
        const arr = JSON.parse(txt);
        if (Array.isArray(arr)) {
          const all = Array.from(new Set([...local, ...arr.map((s: any)=> String(s||'').trim()).filter(Boolean)]));
          combined = all.slice(0, limit);
        }
      } catch {
        // ignore and use local only
      }
    }

    // Ensure we always return something reasonable when q empty
    if (!q) combined = POPULAR_MEDS.slice(0, limit);

    return NextResponse.json({ ok: true, suggestions: combined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'suggest failed' }, { status: 500 });
  }
}


