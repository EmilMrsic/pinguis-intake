import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import OpenAI from 'openai';

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
    const intakeDoc = snap.data() as any;
    const payload = intakeDoc?.payload || {};

    // Build the strict instruction per spec
    const systemPrompt = [
      'You are a clinical intake synthesizer for neurofeedback providers (MD, DC, LMHC, DCs).',
      'From a single patient intake JSON, produce:',
      '1) an editable report, and 2) a targeted Gap Questionnaire (5–20 items).',
      'Hard rules:',
      '- Use only provided JSON; unknown => "not reported".',
      '- No diagnosis, no treatment/protocol advice.',
      '- Do not compute scores; use qualitative language only.',
      '- Present questions twofold: Q (patient‑ready) and Provider note (why).',
      '- If bio.flags.seizure === true OR flags.seizure === true, place a top alert: "⚠️ SEIZURE HISTORY: YES — verify before any stimulation decisions."',
      '- For any medication/supplement/sleep‑aid/substance present, capture/ask for: name, dose, frequency, timing, duration of use, last change, purpose (generate gap questions for missing).',
      '- Derive domains from existing fields; do not invent domains.',
      '- Scale cues: include detected scale in parentheses when from a rating set (e.g., 0–5 or 0–3); if unclear default to 0–5.',
      '- Be concise, chart‑ready, organized.',
      'Output both: a rendered page and a write‑back object that fits intake.gap.',
      'Return EXACT JSON wrapper with keys: render{mode,content} and writeback{intake_id,gap{must_include{seizure},questionnaire[]}}. No extra commentary.'
    ].join('\n');

    const controls = { output_mode: 'html', gap_question_count: { min: 5, max: 20 } };
    const practiceContext = null;
    const userMsg = {
      Controls: controls,
      'Practice context': practiceContext,
      'Patient intake JSON': { intake_id: intakeDoc?.intake_id || intakeId, created_at: intakeDoc?.created_at || null, updated_at: intakeDoc?.updated_at || null, payload },
      'Return this exact JSON wrapper': {
        render: { mode: 'html', content: '<...>' },
        writeback: {
          intake_id: String(intakeDoc?.intake_id || intakeId),
          gap: {
            must_include: { seizure: Boolean(payload?.bio?.flags?.seizure || payload?.flags?.seizure || false) },
            questionnaire: [
              {
                id: 'kebab-case-stable-id', topic: 'topic', patient_question: 'Q', provider_note: 'why', expected_answer_type: 'scale|number|text|choice|multi',
                scale: '0–5', target_paths: ['json.path'], priority: 'high|med|low', required: true
              }
            ]
          }
        }
      },
      'Render order must be': [
        'Patient Header (+ seizure alert if true)',
        'Executive Summary (3–6 sentences)',
        'Medication / Supplement / Substance Snapshot',
        'Sleep Snapshot',
        'Domain Highlights (qualitative: low/moderate/high)',
        'Anomalies & Omissions Worth Clarifying (issue → evidence → why)',
        'Targeted Gap Questionnaire (5–20) with Q and Provider note',
        'All Intake Questions to Ask/Confirm (collapsible, grouped by domain, include scales and [value] or [ ])',
        'Limiting Factors (provider‑editable placeholders)',
        'Data Quality (missing/null paths; internal consistency: good|fair|poor + one line)',
        'Triage Level (routine|expedite|urgent; self‑report only)',
        'Disclaimer'
      ]
    };

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userMsg) }
      ]
    });

    const content = resp.choices?.[0]?.message?.content || '';
    let wrapper: any = null;
    try { wrapper = JSON.parse(content); } catch {}
    if (!wrapper || !wrapper?.render || !wrapper?.writeback) {
      return NextResponse.json({ ok:false, error:'Model did not return expected structure' }, { status:500 });
    }

    // Persist under intake
    try {
      await intakeRef.set({ gap_report: { render: wrapper.render, writeback: wrapper.writeback, generated_at: new Date().toISOString() } }, { merge: true });
    } catch {}

    return NextResponse.json({ ok:true, render: wrapper.render, writeback: wrapper.writeback, cached: false });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || 'Generate failed' }, { status:500 });
  }
}


