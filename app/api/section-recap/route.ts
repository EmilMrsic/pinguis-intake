import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>({}));
    const { section, inputs, name } = body || {};
    const now = Date.now();

    // Heuristic fallback recap if LLM not used
    const recap = buildHeuristicRecap(section, inputs, name);

    return NextResponse.json({ ok: true, recap });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status: 500 });
  }
}

function buildHeuristicRecap(section: string, inputs: any, name?: string) {
  const safe = (v:any)=> (v==null? '' : String(v));
  const title = sectionTitle(section);
  const ts = Date.now();
  let recap = '';
  const highlights: string[] = [];
  let score = 3; let confidence: 'high'|'medium'|'low' = 'medium';
  const flags: string[] = [];

  switch(section) {
    case 'metabolic': {
      const caf = inputs?.caffeine_simple;
      const ctx = inputs?.caffeine_context;
      const exFreq = inputs?.exercise_frequency;
      const exPer = inputs?.exercise_period || 'per week';
      const cafMap: Record<string,string> = {
        at_least_one: 'at least one caffeinated drink daily',
        less_than_one: 'less than one per day',
        daily_energy: 'a daily energy drink',
        multiple: 'multiple caffeinated drinks each day',
      };
      const cafPhrase = caf ? cafMap[String(caf)] || String(caf).replace(/_/g,' ') : '';
      recap = `${name?`Thanks, ${name}. `:''}${ctx ? `We noted: ${ctx}.` : cafPhrase ? `You typically have ${cafPhrase}.` : 'Caffeine details noted.'}`.trim();
      if (ctx) highlights.push(ctx);
      else if (cafPhrase) highlights.push(`Caffeine: ${cafPhrase}`);
      if (exFreq) highlights.push(`Exercise: ${exFreq} ${exPer}`);
      score = (caf||ctx||exFreq)?4:2; confidence = (caf||ctx)?'medium':'low';
      break;
    }
    case 'sleep': {
      const sol = Number(inputs?.sleep_latency_minutes||0);
      const wakes = Number(inputs?.night_awakenings_count||0);
      const waso = Number(inputs?.awake_time_at_night_minutes||0);
      const rested = Number(inputs?.rested_on_waking_0to10||0);
      recap = `${name?`Thanks, ${name}. `:''}You usually fall asleep in ~${sol} minutes, wake about ${wakes} time${wakes===1?'':'s'}, and feel ${rested}/10 on waking.`;
      highlights.push(`Awake at night ~${waso} min`, `We’ll share this snapshot with your provider.`);
      score = 4; confidence = 'high';
      break;
    }
    case 'daily': {
      const medsList: string[] = Array.isArray(inputs?.meds_list)?inputs.meds_list:[];
      const suppsList: string[] = Array.isArray(inputs?.supps_list)?inputs.supps_list:[];
      const meds = medsList.length; const supps = suppsList.length;
      recap = `${name?`Thanks, ${name}. `:''}We captured the items you take regularly.`;
      if (meds>0) highlights.push(`Medications: ${medsList.slice(0,4).join(', ')}`);
      if (supps>0) highlights.push(`Supplements: ${suppsList.slice(0,4).join(', ')}`);
      score = 4; confidence = 'high';
      break;
    }
    case 'cec': {
      const vals = Object.values(inputs||{}).map((n:any)=> Number(n)).filter((n:number)=>!Number.isNaN(n));
      const avg = vals.length>0 ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      const often = vals.filter(n=>n>=2).length;
      if (often>=5) recap = `${name?`Thanks, ${name}. `:''}A handful of items showed up often — we’ll pass that along so it’s reviewed.`;
      else if (often>=1) recap = `${name?`Thanks, ${name}. `:''}A few items stood out; most were on the lower end.`;
      else recap = `${name?`Thanks, ${name}. `:''}Most answers were in the low range.`;
      highlights.push(`Answered: ${vals.length}`, often>0?`${often} item${often>1?'s':''} marked often/always`:'Mostly never/sometimes');
      score = vals.length>0?4:2; confidence = vals.length>0?'high':'low';
      break;
    }
    case 'isi': {
      const vals = Object.values(inputs||{}).map((n:any)=> Number(n)).filter((n:number)=>!Number.isNaN(n));
      const total = vals.reduce((a,b)=>a+b,0);
      const band = total<8?'none': total<15?'subthreshold': total<22?'moderate':'severe';
      const phr: Record<string,string> = {
        none: 'Your sleep answers don’t suggest insomnia right now.',
        subthreshold: 'Some occasional sleep difficulty showed up.',
        moderate: 'Ongoing sleep difficulties showed up; we’ll make sure your provider sees this.',
        severe: 'Significant sleep difficulties showed up; we’ll highlight this for your provider.',
      };
      recap = `${name?`Thanks, ${name}. `:''}${phr[band] || 'Sleep answers recorded.'}`;
      highlights.push('If anything looks off, tap Edit to adjust.');
      score = vals.length===7?5:3; confidence = vals.length===7?'high':'medium';
      break;
    }
    default: {
      recap = 'Section saved.'; score = 3; confidence='medium';
    }
  }

  let payload = {
    section,
    title,
    recap,
    highlights,
    score,
    confidence,
    flags,
    updated_at: ts,
    llm_version: 'heuristic-v1'
  };

  // Note: For full LLM summaries, upgrade this route to async and integrate OpenAI as needed.

  return payload;
}

function sectionTitle(section: string) {
  switch(section) {
    case 'sleep': return 'Sleep Summary';
    case 'metabolic': return 'Metabolic Summary';
    case 'daily': return 'Daily Habits Summary';
    case 'cec': return 'CEC Summary';
    case 'isi': return 'Insomnia Severity Index';
    default: return 'Section Summary';
  }
}


