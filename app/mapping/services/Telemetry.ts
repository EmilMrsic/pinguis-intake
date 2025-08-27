type MinuteStat = { minute:number; artifactPctByChannel:number[]; avgBandRms:number[][] };
type SessionLog = {
  filename?: string;
  fs: number;
  labels: string[];
  startedAt: string;
  stoppedAt?: string;
  minutes: MinuteStat[];
};

let current: SessionLog | null = null;
let accumCount = 0;
let accumArtifacts: number[] = [];
let accumBandSums: number[][] = []; // [band][ch]
let lastFlushedMinute = -1;

export function startTelemetry(fs:number, labels:string[]): void {
  current = { fs, labels: [...labels], startedAt: new Date().toISOString(), minutes: [] };
  accumCount = 0; lastFlushedMinute = -1;
  accumArtifacts = Array.from({length: labels.length}, () => 0);
  accumBandSums = [];
}

export function ingestTelemetry(bandRms:number[][], tSec:number): void {
  if (!current) return;
  const chs = current.labels.length;
  const bands = bandRms.length ? bandRms.length : 0;
  if (!bands) return;
  if (!accumBandSums.length) accumBandSums = Array.from({length: bands}, () => Array.from({length: chs}, () => 0));
  // Simple artifact heuristic per channel: hi-beta over alpha > 6 dB, or frontal low/alpha > 3x
  const idxAlpha = 2, idxLow = 0, idxHi = 6;
  for (let ch=0; ch<chs; ch++) {
    const alpha = bandRms[idxAlpha]?.[ch] || 0;
    const hib = bandRms[idxHi]?.[ch] || 0;
    const low = (bandRms[idxLow]?.[ch] || 0);
    const ratioDb = 20*Math.log10((hib+1e-6)/(alpha+1e-6));
    const frontal = /Fp1|Fp2/.test(current.labels[ch]) && (low/(alpha+1e-6) > 3);
    if (ratioDb > 6 || frontal) accumArtifacts[ch] += 1;
  }
  for (let b=0; b<bands; b++) {
    for (let ch=0; ch<chs; ch++) accumBandSums[b][ch] += bandRms[b]?.[ch] || 0;
  }
  accumCount += 1;
  const minute = Math.floor(tSec/60);
  if (minute !== lastFlushedMinute && accumCount > 0) {
    // flush previous minute if any
    if (lastFlushedMinute >= 0) {
      const artifactPct = accumArtifacts.map(a => (a/accumCount)*100);
      const avgBand = accumBandSums.map(row => row.map(v => v/accumCount));
      current!.minutes.push({ minute: lastFlushedMinute, artifactPctByChannel: artifactPct, avgBandRms: avgBand });
    }
    // reset accum for next minute
    lastFlushedMinute = minute;
    accumCount = 0;
    accumArtifacts = Array.from({length: chs}, () => 0);
    accumBandSums = Array.from({length: bands}, () => Array.from({length: chs}, () => 0));
  }
}

export function stopTelemetry(filename:string): SessionLog | null {
  if (!current) return null;
  // flush tail if exists
  if (accumCount > 0) {
    const artifactPct = accumArtifacts.map(a => (a/accumCount)*100);
    const avgBand = accumBandSums.map(row => row.map(v => v/accumCount));
    current.minutes.push({ minute: lastFlushedMinute, artifactPctByChannel: artifactPct, avgBandRms: avgBand });
  }
  current.stoppedAt = new Date().toISOString();
  current.filename = filename;
  try {
    const key = `session_log:${filename}`;
    localStorage.setItem(key, JSON.stringify(current));
    localStorage.setItem('session_log:last', JSON.stringify(current));
  } catch {}
  const out = current; current = null; return out;
}

export function getLastSessionLog(): SessionLog | null {
  try { const raw = localStorage.getItem('session_log:last'); return raw ? JSON.parse(raw) as SessionLog : null; } catch { return null; }
}


