let sampleCb: ((t:number, chans:number[])=>void) | null = null;
let timer: any = null;

export async function connect(): Promise<{ model?:string; serial?:string; sampleRate:number }>{
  if (typeof window === 'undefined') throw new Error('browser-only');
  // Stub: pretend we connected via WebSerial/WebUSB
  return { model: 'MockEEG-256', serial: 'MOCK1234', sampleRate: 256 };
}

export function onSamples(cb:(t:number, chans:number[])=>void): () => void {
  sampleCb = cb;
  if (!timer) {
    let t = 0;
    timer = setInterval(() => {
      t += 1/256;
      const chans = Array.from({length:12},(_,i)=>Math.sin(2*Math.PI*10*(t)+(i*0.1)) * 10);
      sampleCb && sampleCb(t, chans);
    }, 4);
  }
  return () => { sampleCb = null; if (timer) { clearInterval(timer); timer = null; } };
}

export async function getImpedance(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const ch of ['Fz','Cz','Pz','Oz','F3','F4','C3','C4','P3','P4','O1','O2']) out[ch] = Math.round(Math.random()*15)+5;
  return out;
}

export async function disconnect(): Promise<void> {
  if (timer) { clearInterval(timer); timer = null; }
  sampleCb = null;
}


