import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { systemPrompt } from '@/lib/ai/systemPrompt';
import admin from 'firebase-admin';

// Initialize Firebase Admin once
function getAdmin() {
  if (admin.apps.length === 0) {
    try {
      // Use Application Default Credentials; do not require service-account.json
      admin.initializeApp();
    } catch {
      if (!admin.apps.length) admin.initializeApp();
    }
  }
  return admin;
}

type SuggestedCopy = {
  title?: string;
  subtitle?: string;
  prompt_line?: string;
  placeholder?: string;
};

type TurnRequest = {
  intakeId: string;
  screenId: string; // 'reason' | 'areas_select' | 'areas_rate' | 'deep_dive'
  event: 'enter' | 'change' | 'nav' | string;
  user_text?: string;
  context?: Record<string, any>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TurnRequest;
    const { intakeId, screenId, event, user_text, context = {} } = body ?? ({} as TurnRequest);
    if (!intakeId || !screenId || !event) {
      return NextResponse.json({ ok: false, error: 'Missing intakeId/screenId/event' }, { status: 400 });
    }

    const adminSdk = getAdmin();
    const db = adminSdk.firestore();
    const intakesRef = db.collection('intakes');
    const convRef = db.collection('intake_conversations').doc(intakeId);
    const msgsRef = convRef.collection('messages');

    // Fetch last summary and last few messages (limited payload)
    const intakeDoc = await intakesRef.doc(intakeId).get();
    const lastSummary = intakeDoc.exists ? (intakeDoc.data()?.ai?.last_summary as string | undefined) : undefined;
    const recentMsgsSnap = await msgsRef.orderBy('ts', 'desc').limit(12).get();
    const recent = recentMsgsSnap.docs.map(d => d.data()).reverse();

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'save_metric',
          description: 'Persist a single numeric field value for the intake.',
          parameters: {
            type: 'object',
            properties: {
              intake_id: { type: 'string' },
              field: { type: 'string' },
              scale: { type: 'string', enum: ['0-10', '1-5', '0-3', 'minutes'] },
              value: { type: 'number' },
              notes: { type: 'string' },
            },
            required: ['intake_id', 'field', 'scale', 'value'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'save_note',
          description: 'Persist a free-text note related to the intake.',
          parameters: {
            type: 'object',
            properties: {
              intake_id: { type: 'string' },
              field: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['intake_id', 'field', 'text'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'flag_risk',
          description: 'Flag a safety/medical risk for clinician review.',
          parameters: {
            type: 'object',
            properties: {
              intake_id: { type: 'string' },
              kind: { type: 'string', enum: ['safety', 'medical', 'other'] },
              note: { type: 'string' },
            },
            required: ['intake_id', 'kind'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_next_required_field',
          description: 'Server determines the next required field id for the intake.',
          parameters: {
            type: 'object',
            properties: { intake_id: { type: 'string' } },
            required: ['intake_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'suggest_ui',
          description: 'Suggest screen copy (title, subtitle, prompt_line, placeholder) and up to 6 chips.',
          parameters: {
            type: 'object',
            properties: {
              screen_id: { type: 'string' },
              copy: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  subtitle: { type: 'string' },
                  prompt_line: { type: 'string' },
                  placeholder: { type: 'string' },
                },
              },
              chips: { type: 'array', items: { type: 'string' } },
            },
            required: ['screen_id'],
          },
        },
      },
    ];

    const safeContext = {
      screenId,
      event,
      ...context,
    };

    // Log user turn (sanitized)
    const now = Date.now();
    await msgsRef.add({ role: 'user', content: { user_text, context: safeContext }, ts: now });

    const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      lastSummary
        ? { role: 'system', content: `Conversation summary so far: ${lastSummary}` }
        : { role: 'system', content: 'No prior summary.' },
      {
        role: 'user',
        content: JSON.stringify({ intake_id: intakeId, screen_id: screenId, event, context: safeContext }),
      },
    ];

    // First call: allow tool calls to suggest UI and/or write via tools
    const first = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      tools,
      messages: baseMessages,
    });

    // Collect tool outputs
    const toolCalls = first.choices?.[0]?.message?.tool_calls ?? [];
    const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    let suggestedCopy: SuggestedCopy | undefined;
    let suggestedChips: string[] | undefined;

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      const argsStr = tc.function?.arguments || '{}';
      let args: any = {};
      try { args = JSON.parse(argsStr); } catch {}

      let result: any = {};
      if (name === 'save_metric') {
        const { intake_id, field, value, scale, notes } = args ?? {};
        if (intake_id === intakeId && typeof field === 'string') {
          // Persist field update under intakes/{id}
          try {
            await intakesRef.doc(intakeId).set({
              payload: { [field]: value },
              payloadMeta: { [field]: { scale, notes, updatedAt: adminSdk.firestore.FieldValue.serverTimestamp() } },
            }, { merge: true });
          } catch {}
        }
        result = { ok: true };
      } else if (name === 'save_note') {
        const { intake_id, field, text } = args ?? {};
        if (intake_id === intakeId) {
          try {
            await intakesRef.doc(intakeId).set({
              notes: adminSdk.firestore.FieldValue.arrayUnion({ field, text, ts: adminSdk.firestore.FieldValue.serverTimestamp() }),
            }, { merge: true });
          } catch {}
        }
        result = { ok: true };
      } else if (name === 'flag_risk') {
        const { intake_id, kind, note } = args ?? {};
        if (intake_id === intakeId) {
          try {
            await intakesRef.doc(intakeId).set({
              flags: adminSdk.firestore.FieldValue.arrayUnion({ kind, note, ts: adminSdk.firestore.FieldValue.serverTimestamp() }),
            }, { merge: true });
          } catch {}
        }
        result = { ok: true };
      } else if (name === 'get_next_required_field') {
        // Minimal placeholder: rely on client flow; server suggests none.
        result = { field_id: null };
      } else if (name === 'suggest_ui') {
        const copy = (args?.copy ?? {}) as SuggestedCopy;
        const chips = Array.isArray(args?.chips) ? (args.chips as string[]).slice(0, 6) : [];
        suggestedCopy = copy;
        suggestedChips = chips;
        result = { ok: true };
      } else {
        result = { ok: false, error: 'unknown_tool' };
      }

      // Log tool call and result
      await msgsRef.add({ role: 'tool', name, args, result, ts: Date.now() });

      toolResults.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      } as any);
    }

    // Second call to get assistant final text, including tool results
    const second = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      tools,
      messages: [...baseMessages, ...(first.choices?.[0]?.message ? [first.choices[0].message as any] : []), ...toolResults],
    });
    const assistantText = second.choices?.[0]?.message?.content ?? '';

    // Log assistant message
    await msgsRef.add({ role: 'assistant', content: assistantText, ts: Date.now() });

    // Occasional cheap summarizer (~every 5 turns)
    const totalTurnsSnap = await msgsRef.get();
    const totalCount = totalTurnsSnap.size;
    if (totalCount % 5 === 0) {
      try {
        const convoSnippet = recent
          .map((m: any) => {
            if (m.role === 'user') return `User: ${m?.content?.user_text ?? ''}`;
            if (m.role === 'assistant') return `Assistant: ${m?.content ?? ''}`;
            return `Tool(${m?.name}): ok`;
          })
          .join('\n')
          .slice(0, 3000);
        const sum = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'Summarize the conversation in under 100 words, plain language, no PHI.' },
            { role: 'user', content: convoSnippet },
          ],
        });
        const summary = sum.choices?.[0]?.message?.content ?? '';
        await intakesRef.doc(intakeId).set({ ai: { last_summary: summary, updatedAt: adminSdk.firestore.FieldValue.serverTimestamp() } }, { merge: true });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      assistant_text: assistantText,
      suggested_copy: suggestedCopy,
      suggested_chips: suggestedChips ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}


