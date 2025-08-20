import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { systemPrompt } from '@/lib/ai/systemPrompt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { context } = body ?? {};

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ context }) }
      ]
    });

    const text = resp.choices?.[0]?.message?.content ?? 'Let’s begin. What brings you in today?';
    return NextResponse.json({ ok: true, question: text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}


