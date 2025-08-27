export type ArtifactFlags = { blink:boolean; emg:boolean; clip:boolean; pop:boolean };

type DetectInput = {
  filtered: number[][]; // [ch][n]
  bandRms: number[][]; // [band][ch]
  fs: number;
  labels: string[];
  fullScaleUv: number;
};

// rolling state
const alphaHistory: Record<number, number[]> = {}; // per channel recent alpha RMS
const lastSamples: Record<number, number> = {}; // last sample per channel for pop

export function detectArtifacts(input: DetectInput): ArtifactFlags {
  const { filtered, bandRms, fs, labels, fullScaleUv } = input;
  const chs = filtered.length;
  const N = filtered[0]?.length || 0;
  // indices for bands per worker's ordering: [0.5-4,4-7,8-12,12-15,15-20,20-30,30-45]
  const idxDelta = 0, idxTheta = 1, idxAlpha = 2, idxHiBeta = 6;
  // Blink: compare frontal Fp1/Fp2 low vs alpha
  const fp1 = labels.indexOf('Fp1');
  const fp2 = labels.indexOf('Fp2');
  let blink = false;
  if (fp1>=0 || fp2>=0) {
    const check = (chIdx:number) => {
      if (chIdx<0) return false;
      const low = (bandRms[idxDelta]?.[chIdx] || 0) + (bandRms[idxTheta]?.[chIdx] || 0);
      const alpha = bandRms[idxAlpha]?.[chIdx] || 1e-6;
      return (low / alpha) > 3;
    };
    blink = check(fp1) || check(fp2);
  }
  // EMG: 30-45 vs rolling alpha median per channel
  let emg = false;
  for (let ch=0; ch<chs; ch++) {
    const alpha = bandRms[idxAlpha]?.[ch] || 0;
    const emgR = bandRms[idxHiBeta]?.[ch] || 0;
    const hist = (alphaHistory[ch] ||= []);
    hist.push(alpha);
    if (hist.length > 200) hist.shift(); // ~few seconds
    const sorted = [...hist].sort((a,b)=>a-b);
    const median = sorted.length ? sorted[Math.floor(sorted.length/2)] : alpha;
    const ratio = (emgR+1e-6)/(median+1e-6);
    if (20*Math.log10(ratio) > 6) { emg = true; break; }
  }
  // Clip: any sample exceeds 0.9*FS
  let clip = false;
  const clipThresh = 0.9 * fullScaleUv;
  outer: for (let ch=0; ch<chs; ch++) {
    for (let i=0;i<N;i++) { if (Math.abs(filtered[ch][i]) > clipThresh) { clip = true; break outer; } }
  }
  // Pop: delta > 80 µV within <4 ms
  let pop = false; const maxDt = Math.max(1, Math.floor(0.004 * fs));
  for (let ch=0; ch<chs; ch++) {
    let prev = lastSamples[ch] ?? filtered[ch][0] ?? 0;
    for (let i=0;i<Math.min(N, maxDt); i++) {
      const v = filtered[ch][i] || 0;
      if (Math.abs(v - prev) > 80) { pop = true; break; }
      prev = v;
    }
    lastSamples[ch] = filtered[ch][N-1] ?? prev;
    if (pop) break;
  }
  return { blink, emg, clip, pop };
}


