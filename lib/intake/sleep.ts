export type SdsPreview = { wouldShow: boolean; level: 'skip'|'optional'|'require'; reason: string };

export function computeSdsPreview(sleep: any): SdsPreview {
  const sol = Number(sleep?.sleep_latency_minutes);
  const wakes = Number(sleep?.night_awakenings_count);
  const waso = Number(sleep?.awake_time_at_night_minutes);
  const rested = Number(sleep?.rested_on_waking_0to10);
  const parseM = (t:string)=>{ try { const [hh,mm]=String(t||'').split(':').map(n=>parseInt(n,10)); if(Number.isNaN(hh)||Number.isNaN(mm)) return null; return hh*60+mm; } catch { return null; } };
  const bedM = parseM(String(sleep?.bedtime||'')); const wakeM = parseM(String(sleep?.wake_time||''));
  let timeInBed: number | null = null; if (bedM!=null && wakeM!=null) timeInBed = (wakeM>=bedM)?(wakeM-bedM):(24*60-bedM+wakeM);
  const totalSleep = (timeInBed!=null && !Number.isNaN(sol) && !Number.isNaN(waso)) ? Math.max(0, timeInBed - sol - waso) : null;
  const eff = (timeInBed!=null && totalSleep!=null && timeInBed>0) ? Math.round((totalSleep/timeInBed)*100) : NaN;
  const score =
    (Number.isNaN(sol)?0:(sol<20?0:sol<30?1:sol<45?2:sol<60?3:4)) +
    (Number.isNaN(wakes)?0:(wakes<=1?0:wakes===2?1:wakes===3?2:wakes===4?3:4)) +
    (Number.isNaN(waso)?0:(waso<20?0:waso<30?1:waso<45?2:waso<60?3:4)) +
    (Number.isNaN(rested)?0:(rested>=8?0:rested>=6?1:rested>=4?2:rested>=2?3:4)) +
    (Number.isNaN(eff)?0:(eff>=90?0:eff>=85?1:eff>=80?2:eff>=75?3:4)) +
    ((sleep?.flags && Object.keys(sleep.flags||{}).length>=2)?1:0);
  const majorHits = [ (!Number.isNaN(sol) && sol>=30), (!Number.isNaN(waso) && waso>=30), (!Number.isNaN(wakes) && wakes>=3), (!Number.isNaN(eff) && eff<85) ].filter(Boolean).length;
  const majorOverride = (majorHits>=2) || (!Number.isNaN(rested) && rested<=4 && ((!Number.isNaN(sol) && sol>=30) || (!Number.isNaN(wakes) && wakes>=3)));
  let wouldShow = true; let level: 'skip'|'optional'|'require' = 'optional';
  if (score <= 3 && !majorOverride) { wouldShow = false; level = 'skip'; }
  else if (score >= 8) { wouldShow = true; level = 'require'; }
  else { wouldShow = true; level = 'optional'; }
  const reason = !wouldShow ? 'SDS ≤ 3 with no major red flags.' : (level==='require' ? 'SDS ≥ 8 or major override triggered.' : 'SDS 4–7 (mild disturbance).');
  return { wouldShow, level, reason };
}


