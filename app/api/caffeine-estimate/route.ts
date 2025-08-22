import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { heuristicEstimate } from '@/lib/intake/caffeine';

const DEFAULTS: Record<string, number> = {
  coffee_small: 80,
  coffee_medium: 150,
  coffee_large: 200,
  espresso_single: 60,
  espresso_double: 120,
  cold_brew: 200,
  soda_diet_cola: 45,
  energy_drink_small: 80,
  energy_drink_standard: 160,
  energy_drink_standard_half: 80,
  five_hour_energy: 200,
  tea_black: 40,
  tea_green: 30,
  matcha: 60,
  preworkout_packet: 200,
  other: 100,
};

function simpleHash(t: string): string {
  let h = 0; for (let i=0;i<t.length;i++){ h = ((h<<5)-h) + t.charCodeAt(i); h|=0; }
  return Math.abs(h).toString(16);
}

export async function POST(req: NextRequest) {
  try {
    const { text, answers, name } = await req.json();
    const local = heuristicEstimate(String(text||''));
    let result = local;

    // If answers are provided, finalize a normalized entry
    if (answers && typeof answers === 'object') {
      const typeKey = String(answers.type || 'other');
      const amountVal = String(answers.amount_per_day || '1');
      const amt = amountVal === '3_plus' ? 3 : Number(amountVal || 1);
      const times: string[] = Array.isArray(answers.time_of_day) ? answers.time_of_day : [];
      const mgPer = DEFAULTS[typeKey] ?? DEFAULTS.other;
      const total = Math.max(0, Math.min(1200, mgPer * Math.max(0, amt)));
      const primaryTime = times[0] || 'unspecified';
      const items = [ { beverage_type: typeKey, amount_mg: mgPer, time_of_day: primaryTime, source_text: String(text||'') } ];
      const confidence = (typeKey==='other' || amountVal==='3_plus') ? 'low' : (total>600 ? 'low' : (times.length>0 ? 'high' : 'medium'));
      const entry = {
        dateISO: new Date().toISOString().slice(0,10),
        items,
        total_mg_today: total,
        notes: `${typeKey.replace(/_/g,' ')} ~${mgPer} mg; about ${amt}/day${times.length?` (${times.join(', ')})`:''}.`,
        confidence,
        last_updated_ts: Date.now(),
      };
      return NextResponse.json({ ok:true, estimate:{ servings: amt, estimated_mg: total }, entry });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && text && text.length >= 1) {
      try {
        const client = new OpenAI({ apiKey });
        const prompt = `You are a friendly, concise assistant that helps collect caffeine details.\nGiven the user's short note, return STRICT JSON with this schema:\n{\n  ok: true,\n  echo: string,\n  estimate: { servings: number, estimated_mg: number },\n  questionnaire: {\n    id: string, intro: string,\n    sections: [\n      { id:'type', kind:'type', prompt:string, selection:'single', options:[{label:string,value:string}], preselect?:string|null },\n      { id:'amount', kind:'amount_per_day', prompt:string, selection:'single', options:[{label:string,value:string}] },\n      { id:'time', kind:'time_of_day', prompt:string, selection:'multi', options:[{label:string,value:string}] }\n    ]\n  }\n}\nRules:\n- Use defaults: ${JSON.stringify(DEFAULTS)}\n- Tailor options to brands if present (Starbucks, Diet Coke, Monster, Red Bull, 5‑Hour Energy).\n- Intro should be personable: e.g., \"We all love some {{brand}}, {{name}}.\" Fill {{name}} with '${name||''}'.\n- Never return prose outside JSON. Keep prompts short.\nUser text: ${text}`;
        const r = await client.chat.completions.create({ model:'gpt-4o-mini', temperature:0.2, messages:[{role:'system',content:'Return only JSON.'},{role:'user',content:prompt}] });
        const raw = r.choices?.[0]?.message?.content || '{}';
        const j = JSON.parse(raw);
        if (j?.questionnaire) {
          const echo = simpleHash(String(text||''));
          // quick estimate seed
          const mg = Number(j?.estimate?.estimated_mg || result?.estimated_mg || 0);
          return NextResponse.json({ ok:true, echo, estimate:{ servings:Number(j?.estimate?.servings||result?.servings||0), estimated_mg: Math.max(0,Math.min(1200,mg)) }, questionnaire:j.questionnaire });
        }
      } catch {}
    }
    // Fallback questionnaire if LLM unavailable
    const echo = simpleHash(String(text||''));
    const questionnaire = {
      id: `cq_${Date.now()}`,
      intro: `Quick caffeine check${name?`, ${name}`:''}.`,
      sections: [
        { id:'type', kind:'type', prompt:'What are we talking about?', selection:'single', options:[
          {label:'Coffee (medium)', value:'coffee_medium'}, {label:'Cold brew', value:'cold_brew'}, {label:'Espresso (1–2 shots)', value:'espresso_double'}, {label:'Tea', value:'tea_black'}, {label:'Energy drink', value:'energy_drink_standard'}, {label:'Soda (diet cola)', value:'soda_diet_cola'}, {label:'Other', value:'other'} ], preselect:null },
        { id:'amount', kind:'amount_per_day', prompt:'How many per day?', selection:'single', options:[ {label:'½',value:'0.5'},{label:'1',value:'1'},{label:'2',value:'2'},{label:'3+',value:'3_plus'} ] },
        { id:'time', kind:'time_of_day', prompt:'When do you usually have it? (click all that apply)', selection:'multi', options:[ {label:'Morning',value:'morning'},{label:'Afternoon',value:'afternoon'},{label:'Evening',value:'evening'},{label:'Late night',value:'latenight'} ] },
      ],
    };
    return NextResponse.json({ ok:true, echo, estimate: result || { servings:0, estimated_mg:0 }, questionnaire });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message||'failed' }, { status:500 });
  }
}


