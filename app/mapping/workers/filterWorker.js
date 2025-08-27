let cfg = { sampleRate: 256, channels: 1, hpHz: 0.5, lpHz: 45, notchHz: 60, notchQ: 30 };
const BANDS = [ [0.5,4],[4,7],[8,12],[12,15],[15,20],[20,30],[30,45] ];

function makeBiquad(type, sr, freq, Q) {
  const w0 = 2*Math.PI*freq / sr;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2*(Q||0.707));
  let b0=1, b1=0, b2=0, a0=1, a1=0, a2=0;
  if (type === 'lowpass') {
    b0 = (1 - cosw0) / 2; b1 = 1 - cosw0; b2 = (1 - cosw0) / 2;
    a0 = 1 + alpha; a1 = -2*cosw0; a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosw0) / 2; b1 = -(1 + cosw0); b2 = (1 + cosw0) / 2;
    a0 = 1 + alpha; a1 = -2*cosw0; a2 = 1 - alpha;
  } else if (type === 'notch') {
    b0 = 1; b1 = -2*cosw0; b2 = 1; a0 = 1 + alpha; a1 = -2*cosw0; a2 = 1 - alpha;
  }
  // normalize
  b0/=a0; b1/=a0; b2/=a0; a1/=a0; a2/=a0; a0 = 1;
  return { b0,b1,b2,a1,a2, x1:0,x2:0,y1:0,y2:0 };
}

let hp = []; let lp = []; let nt = [];
let bandHp = []; // [band][ch]
let bandLp = []; // [band][ch]
let bandMeanSq = []; // [band][ch]

function ensureFilters() {
  const chs = Math.max(1, cfg.channels|0);
  if (hp.length !== chs) hp = Array.from({length: chs}, () => makeBiquad('highpass', cfg.sampleRate, cfg.hpHz, 0.707));
  if (lp.length !== chs) lp = Array.from({length: chs}, () => makeBiquad('lowpass', cfg.sampleRate, cfg.lpHz, 0.707));
  if (cfg.notchHz) {
    if (nt.length !== chs) nt = Array.from({length: chs}, () => makeBiquad('notch', cfg.sampleRate, cfg.notchHz, cfg.notchQ||30));
  } else {
    nt = [];
  }
  // Bands
  if (bandHp.length !== BANDS.length || (bandHp[0] && bandHp[0].length !== chs)) {
    bandHp = BANDS.map(([lo,_hi]) => Array.from({length: chs}, () => makeBiquad('highpass', cfg.sampleRate, lo, 0.707)));
    bandLp = BANDS.map(([_,hi]) => Array.from({length: chs}, () => makeBiquad('lowpass', cfg.sampleRate, hi, 0.707)));
    bandMeanSq = BANDS.map(() => Array.from({length: chs}, () => 0));
  }
}

function reconfigure() {
  hp = []; lp = []; nt = []; bandHp = []; bandLp = []; bandMeanSq = []; ensureFilters();
}

function step(bq, x) {
  const y = bq.b0*x + bq.b1*bq.x1 + bq.b2*bq.x2 - bq.a1*bq.y1 - bq.a2*bq.y2;
  bq.x2 = bq.x1; bq.x1 = x; bq.y2 = bq.y1; bq.y1 = y;
  return y;
}

function process(samples) {
  const chs = samples.length;
  if (cfg.channels !== chs) { cfg.channels = chs; reconfigure(); }
  const out = Array.from({length: chs}, () => new Array(samples[0].length));
  const bandRms = BANDS.map(() => Array.from({length: chs}, () => 0));
  const tau = 0.5; // seconds, smoothing for RMS
  const alpha = Math.exp(-1/(cfg.sampleRate * tau));
  for (let ch=0; ch<chs; ch++) {
    for (let i=0; i<samples[ch].length; i++) {
      let y = samples[ch][i];
      y = step(hp[ch], y);
      if (nt.length) y = step(nt[ch], y);
      y = step(lp[ch], y);
      out[ch][i] = y;
      // per-band RMS based on bandpass of y
      for (let b=0; b<BANDS.length; b++) {
        let z = step(bandHp[b][ch], y);
        z = step(bandLp[b][ch], z);
        const ms = bandMeanSq[b][ch] = alpha*bandMeanSq[b][ch] + (1-alpha)*(z*z);
        bandRms[b][ch] = Math.sqrt(ms);
      }
    }
  }
  return { out, bandRms };
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'config') {
    cfg = { ...cfg, ...(msg.cfg||{}) };
    reconfigure();
    return;
  }
  if (msg.type === 'frame') {
    const samples = msg.samples || [];
    ensureFilters();
    const { out, bandRms } = process(samples);
    self.postMessage({ type:'filtered', out, bandRms });
  }
};


