// Minimal EDF+ (continuous) writer
// Writes 16-bit signed little-endian samples; 1-second records; physical units µV

type EdfOpts = {
  labels: string[];
  fs: number; // samples per second
  data: number[][]; // [ch][samples] in microvolts (unfiltered RAW)
  patient?: string;
  recording?: string;
  montage?: string;
  reference?: string;
  startTime?: Date;
  physMin?: number; // default -100
  physMax?: number; // default 100
  annotations?: { onsetSec: number; durSec?: number; text: string }[];
};

function padAscii(s: string, len: number): string {
  if (s.length > len) return s.slice(0, len);
  return s + ' '.repeat(len - s.length);
}

export function createEdfPlusBlob(opts: EdfOpts): Blob {
  const labels = opts.labels || [];
  const baseChs = labels.length;
  const fs = Math.max(1, Math.round(opts.fs || 256));
  const data = opts.data || [];
  const physMin = opts.physMin ?? -100;
  const physMax = opts.physMax ?? 100;
  const digMin = -32768;
  const digMax = 32767;
  const start = opts.startTime || new Date();
  const patient = `${opts.patient||'Patient'} - ${opts.montage||''} ${opts.reference?`(${opts.reference})`:''}`.trim();
  const recording = `${opts.recording||'EEG'} EDF+ ${opts.montage||''} ${opts.reference?`(${opts.reference})`:''}`.trim();

  const samples = Math.max(0, data[0]?.length || 0);
  const recDuration = 1; // seconds
  const spr = fs; // samples per record per channel
  const numRecords = Math.ceil(samples / spr);
  const haveAnn = Array.isArray(opts.annotations) && opts.annotations.length > 0;
  const annSpr = 256; // bytes per record for annotations
  const chs = baseChs + (haveAnn ? 1 : 0);

  // --- Build header ---
  const headerSignalsLen = chs * (16 + 80 + 8 + 8 + 8 + 8 + 80 + 8 + 32);
  const headerLen = 256 + headerSignalsLen;
  let header = '';
  header += padAscii('0', 8);
  header += padAscii(patient, 80);
  header += padAscii(recording, 80);
  const dd = String(start.getDate()).padStart(2,'0');
  const mm = String(start.getMonth()+1).padStart(2,'0');
  const yy = String(start.getFullYear()%100).padStart(2,'0');
  header += padAscii(`${dd}.${mm}.${yy}`, 8);
  const hh = String(start.getHours()).padStart(2,'0');
  const mi = String(start.getMinutes()).padStart(2,'0');
  const ss = String(start.getSeconds()).padStart(2,'0');
  header += padAscii(`${hh}.${mi}.${ss}`, 8);
  header += padAscii(String(headerLen), 8);
  header += padAscii('EDF+C', 44);
  header += padAscii(String(numRecords), 8);
  header += padAscii(String(recDuration), 8);
  header += padAscii(String(chs), 4);
  // Per-signal headers
  for (let i=0;i<baseChs;i++) header += padAscii(labels[i] || `Ch${i+1}`, 16);
  if (haveAnn) header += padAscii('EDF Annotations', 16);
  for (let i=0;i<baseChs;i++) header += padAscii('', 80); // transducer
  if (haveAnn) header += padAscii('', 80);
  for (let i=0;i<baseChs;i++) header += padAscii('uV', 8); // physical dimension
  if (haveAnn) header += padAscii('', 8);
  for (let i=0;i<baseChs;i++) header += padAscii(String(physMin), 8);
  if (haveAnn) header += padAscii(String(-1), 8);
  for (let i=0;i<baseChs;i++) header += padAscii(String(physMax), 8);
  if (haveAnn) header += padAscii(String(1), 8);
  for (let i=0;i<baseChs;i++) header += padAscii(String(digMin), 8);
  if (haveAnn) header += padAscii(String(digMin), 8);
  for (let i=0;i<baseChs;i++) header += padAscii(String(digMax), 8);
  if (haveAnn) header += padAscii(String(digMax), 8);
  for (let i=0;i<baseChs;i++) header += padAscii('RAW', 80); // prefiltering
  if (haveAnn) header += padAscii('', 80);
  for (let i=0;i<baseChs;i++) header += padAscii(String(spr), 8);
  if (haveAnn) header += padAscii(String(annSpr), 8);
  for (let i=0;i<baseChs;i++) header += padAscii('', 32);
  if (haveAnn) header += padAscii('', 32);

  const headerBytes = new TextEncoder().encode(header);

  // --- Data records ---
  const bytesPerSample = 2; // 16-bit
  const bytesPerRec = (baseChs * spr + (haveAnn ? annSpr : 0)) * bytesPerSample;
  const buf = new ArrayBuffer(headerBytes.length + numRecords * bytesPerRec);
  const view = new DataView(buf);
  // copy header
  new Uint8Array(buf, 0, headerBytes.length).set(headerBytes);

  const physRange = physMax - physMin;
  const digRange = digMax - digMin;
  let offset = headerBytes.length;
  // helper to write annotation bytes for a record
  function writeAnnRecord(recIndex: number) {
    // gather events with onset within [recIndex, recIndex+1)
    const events = (opts.annotations||[]).filter(a => a.onsetSec >= recIndex && a.onsetSec < recIndex + recDuration);
    const bytes = new Uint8Array(annSpr);
    let p = 0;
    function put(b:number){ if (p<bytes.length){ bytes[p++] = b; } }
    function puts(s:string){ for (let i=0;i<s.length && p<bytes.length;i++){ bytes[p++] = s.charCodeAt(i); } }
    // Start with 0
    put(0);
    for (const ev of events) {
      put(0);
      const onsetStr = `+${(ev.onsetSec).toFixed(3)}`;
      puts(onsetStr); put(20); // 0x14
      if (typeof ev.durSec === 'number') { put(21); puts(`${ev.durSec.toFixed(3)}`); put(20); }
      puts(ev.text || 'event'); put(0);
    }
    // write into 16-bit samples low byte
    for (let i=0;i<annSpr;i++) { view.setInt16(offset, bytes[i], true); offset += 2; }
  }

  for (let r=0; r<numRecords; r++) {
    // EEG channels
    for (let ch=0; ch<baseChs; ch++) {
      for (let i=0;i<spr;i++) {
        const sampleIdx = r*spr + i;
        const phys = data[ch]?.[sampleIdx] ?? 0;
        const clamped = Math.max(physMin, Math.min(physMax, phys));
        const dig = Math.round((clamped - physMin) * digRange / physRange + digMin);
        view.setInt16(offset, dig, true); offset += 2;
      }
    }
    // Annotation channel
    if (haveAnn) writeAnnRecord(r);
  }
  return new Blob([buf], { type: 'application/octet-stream' });
}


