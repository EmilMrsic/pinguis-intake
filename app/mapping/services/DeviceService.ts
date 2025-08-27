type SampleFrame = { tSec: number; chans: number[] };
const sampleSubs: Array<(frame: SampleFrame)=>void> = [];
let mockTimer: any = null;
let serialPort: any = null;
let serialReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
let readLoopRunning = false;
let tSeconds = 0;
let simulationTimer: any = null;
let simFs = 256;
let simIdx = 0;
let simChData: Float32Array[] | null = null;
let syntheticGen: ((t:number)=>number[]) | null = null;
let bytesTicker: any = null;
let bytesInWindow = 0;
let chunksInWindow = 0;
let anyBytesSeen = false;
let framesInWindow = 0;
let zeroByteWindows = 0;
let failoverRunning = false;
let keepAliveTimer: any = null;
let lastNonZeroMs = 0;
let autoDetectActive = false;
let rawDetectBuf = new Uint8Array(0);
let detectStartMs = 0;
let currentPortId: string = '';
let rawModeEnabled = false;
let remembered: { [vidpid:string]: { baud:number; decode?:string } } = {};
function vidpidOf(port:any): string {
  try { const info = port?.getInfo?.()||{}; return `${info.usbVendorId||''}:${info.usbProductId||''}`; } catch { return ''; }
}
function loadRemembered() {
  try { const s = localStorage.getItem('eeg.remembered')||''; if (s) remembered = JSON.parse(s)||{}; } catch {}
}
function saveRemembered() {
  try { localStorage.setItem('eeg.remembered', JSON.stringify(remembered)); } catch {}
}
loadRemembered();
const rxHistory: { t:number; b:number }[] = [];

type SerialConfig = {
  channels: number;
  bytesPerSample: 2|3;
  endian: 'le'|'be';
  interleaved: boolean; // true for [ch1,samp][ch2,samp]...
  baudRate: number;
  sampleRate: number; // Hz
  scaleMicroVPerLsb: number; // multiply raw to µV
};

let cfg: SerialConfig = {
  channels: 4,
  bytesPerSample: 2,
  endian: 'le',
  interleaved: true,
  baudRate: 115200,
  sampleRate: 256,
  scaleMicroVPerLsb: 0.1,
};

export function setSerialConfig(next: Partial<SerialConfig>) {
  cfg = { ...cfg, ...next } as SerialConfig;
}

export async function requestSerialPort(): Promise<any> {
  // WebSerial chooser
  if (typeof navigator === 'undefined' || !(navigator as any).serial) throw new Error('WebSerial not supported');
  const port = await (navigator as any).serial.requestPort();
  return port;
}

// --- Port probing utilities ---
export async function probePort(port: any): Promise<{ bytesPerSec: number; baudUsed: number | null }> {
  const bauds = [115200, 230400, 460800, 921600];
  for (const baud of bauds) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    let bytes = 0;
    try {
      await port.open({ baudRate: baud });
      // Phase A — Wake
      try { await port.setSignals?.({ dataTerminalReady: true, requestToSend: true }); } catch {}
      async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }
      try { writer = port.writable?.getWriter?.() || null; } catch {}
      async function write(arr: Uint8Array) { if (writer) { try { await writer.write(arr); } catch {} } }
      await sleep(100);
      await write(new Uint8Array([0x01])); await sleep(100);
      await write(new TextEncoder().encode('start\n')); await sleep(100);
      await write(new TextEncoder().encode('b'));
      try { if (writer) { await writer.releaseLock?.(); } } catch {}
      writer = null;

      // Phase B — Probe (2.5 s)
      async function probeFor(durationMs:number): Promise<number> {
        let total = 0;
        let r: ReadableStreamDefaultReader<Uint8Array> | null = null;
        try { r = port.readable.getReader(); } catch {}
        const t0 = (typeof performance!=='undefined'?performance.now():Date.now());
        while (((typeof performance!=='undefined'?performance.now():Date.now()) - t0) < durationMs) {
          if (!r) break;
          const { value, done } = await r.read();
          if (done) break;
          if (value && value.length) total += value.length;
        }
        try { if (r) { await r.releaseLock(); } } catch {}
        return total;
      }
      bytes = await probeFor(2500);
      // If zero bytes, toggle DTR false→true and retry once
      if (bytes === 0) {
        try { await port.setSignals?.({ dataTerminalReady: false, requestToSend: true }); } catch {}
        await sleep(100);
        try { await port.setSignals?.({ dataTerminalReady: true, requestToSend: true }); } catch {}
        bytes = await probeFor(2500);
      }
      const bytesPerSec = Math.round((bytes / 2.5));
      try { await port.close(); } catch {}
      if (bytesPerSec > 0) return { bytesPerSec, baudUsed: baud };
    } catch {
      // ignore and continue to next baud
    } finally {
      try { if (reader) { await (reader as ReadableStreamDefaultReader<Uint8Array>).releaseLock(); } } catch {}
      try { const w = writer as WritableStreamDefaultWriter<Uint8Array> | null; if (w && (w as any).releaseLock) await (w as any).releaseLock(); } catch {}
      try { await port.close(); } catch {}
    }
  }
  return { bytesPerSec: 0, baudUsed: null };
}

export async function choosePort(ports: any[]): Promise<{ port: any | null; result: { bytesPerSec: number; baudUsed: number | null } | null }> {
  // Prefer remembered winner first
  for (let i=0;i<ports.length;i++) {
    const id = vidpidOf(ports[i]);
    const rem = remembered[id];
    if (rem && rem.baud) {
      // Quick test using remembered baud
      try {
        await ports[i].open({ baudRate: rem.baud });
        try { await ports[i].setSignals?.({ dataTerminalReady: true, requestToSend: true }); } catch {}
        // short probe to verify bytes
        let r: ReadableStreamDefaultReader<Uint8Array> | null = null; let bytes=0;
        try { r = ports[i].readable.getReader(); } catch {}
        const t0 = (typeof performance!=='undefined'?performance.now():Date.now());
        while (((typeof performance!=='undefined'?performance.now():Date.now()) - t0) < 400) {
          if (!r) break; const { value, done } = await r.read(); if (done) break; if (value && value.length) bytes+=value.length;
        }
        try { if (r) await r.releaseLock(); } catch {}
        try { await ports[i].close(); } catch {}
        if (bytes>0) return { port: ports[i], result: { bytesPerSec: Math.round(bytes*2.5), baudUsed: rem.baud } };
      } catch { try { await ports[i].close(); } catch {} }
    }
  }
  // Fall back to probing all ports and remember winner
  let best: { idx:number; bytesPerSec:number; baudUsed:number|null } | null = null;
  for (let i=0;i<ports.length;i++) {
    try {
      const res = await probePort(ports[i]);
      if (!best || res.bytesPerSec > best.bytesPerSec) best = { idx:i, bytesPerSec: res.bytesPerSec, baudUsed: res.baudUsed };
    } catch {}
  }
  if (best && best.bytesPerSec > 0) {
    const id = vidpidOf(ports[best.idx]);
    if (id && best.baudUsed) { remembered[id] = { baud: best.baudUsed }; saveRemembered(); }
    return { port: ports[best.idx], result: { bytesPerSec: best.bytesPerSec, baudUsed: best.baudUsed } };
  }
  try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ errors: 'E_NO_BYTES: Device opened but sent no data. Trying other port…' }); } catch {}
  return { port: null, result: null };
}

// --- Deep streaming probe and chooser (thresholded) ---
function expectedBudgetBps(): number {
  // approximate expected bytes/sec = channels * bytes/sample * fs
  return (cfg.channels || 1) * (cfg.bytesPerSample || 2) * (cfg.sampleRate || 256);
}

export async function deepProbe(port: any): Promise<{ bytesPerSec: number; baudUsed: number | null }> {
  // Reuse two-phase probePort which already uses 2.5s window and handshake
  return probePort(port);
}

export async function chooseStreamingPort(ports: any[]): Promise<{ port: any | null; result: { bytesPerSec: number; baudUsed: number | null } | null }> {
  const threshold = Math.floor(expectedBudgetBps() * 0.6);
  // Try remembered winner first
  for (let i=0;i<ports.length;i++) {
    const id = vidpidOf(ports[i]);
    const rem = remembered[id];
    if (rem && rem.baud) {
      try {
        await ports[i].open({ baudRate: rem.baud });
        try { await ports[i].setSignals?.({ dataTerminalReady: true, requestToSend: true }); } catch {}
        // short sanity probe (~400 ms)
        let r: ReadableStreamDefaultReader<Uint8Array> | null = null; let bytes=0;
        try { r = ports[i].readable.getReader(); } catch {}
        const t0 = (typeof performance!=='undefined'?performance.now():Date.now());
        while (((typeof performance!=='undefined'?performance.now():Date.now()) - t0) < 400) {
          if (!r) break; const { value, done } = await r.read(); if (done) break; if (value && value.length) bytes+=value.length;
        }
        try { if (r) await r.releaseLock(); } catch {}
        try { await ports[i].close(); } catch {}
        const bps = Math.round(bytes*2.5);
        if (bps >= threshold) return { port: ports[i], result: { bytesPerSec: bps, baudUsed: rem.baud } };
      } catch { try { await ports[i].close(); } catch {} }
    }
  }
  // Deep-probe all ports in order; pick first above threshold and remember
  for (let i=0;i<ports.length;i++) {
    try {
      const res = await deepProbe(ports[i]);
      if ((res.bytesPerSec||0) >= threshold && res.baudUsed) {
        const id = vidpidOf(ports[i]);
        if (id) { remembered[id] = { baud: res.baudUsed }; saveRemembered(); }
        return { port: ports[i], result: { bytesPerSec: res.bytesPerSec, baudUsed: res.baudUsed } };
      }
    } catch {}
  }
  try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ errors: 'E_NO_BYTES: Device opened but sent no data. Trying other port…' }); } catch {}
  return { port: null, result: null };
}

export async function connect(preferredPortId?: string, preferredIndex?: number): Promise<{ model?:string; serial?:string; sampleRate:number }>{
  if (typeof window === 'undefined') throw new Error('browser-only');
  // Prefer WebSerial if available, otherwise fall back to mock
  if ((navigator as any).serial) {
    // Build candidate port list
    let candidates: any[] = await (navigator as any).serial.getPorts();
    if (candidates.length === 0) {
      const p = await requestSerialPort();
      candidates = [p];
    }
    function idOf(p:any): string { try { const info = p.getInfo?.() || {}; return `${info.usbVendorId||''}:${info.usbProductId||''}`; } catch { return 'unknown'; } }
    // Reorder by preferred index or id first
    if (typeof preferredIndex === 'number' && preferredIndex >= 0 && preferredIndex < candidates.length) {
      const chosen = candidates.splice(preferredIndex, 1)[0];
      candidates.unshift(chosen);
    } else if (preferredPortId) {
      candidates.sort((a,b)=> (idOf(b)===preferredPortId?1:0) - (idOf(a)===preferredPortId?1:0));
    }
    for (const p of candidates) {
      const qt = await quickTestCandidate(p);
      if (qt.ok) {
        // Persist decode choice
        if (qt.det) { cfg.bytesPerSample = qt.det.bps as 2|3; cfg.endian = qt.det.endian as 'le'|'be'; }
        // Open fully via helper (will autoprobe baud again)
        await connectWithPort(p);
        try { const { emitConnection, emitDiagnostics } = await import('./SignalBus'); emitConnection({ connected:true, simulation:false }); emitDiagnostics({ portId: idOf(p) }); } catch {}
        return { model: 'WebSerial-EEG', serial: idOf(p), sampleRate: cfg.sampleRate };
      }
    }
    try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ errors: 'Try other port' }); } catch {}
    throw new Error('No suitable port found');
  }
  // Mock fallback
  startMock();
  return { model: 'MockEEG-256', serial: 'MOCK1234', sampleRate: 256 };
}

export async function connectWithPort(port: any): Promise<{ model?:string; serial?:string; sampleRate:number }>{
  if (!port) throw new Error('No port');
  const bauds = [115200, 230400, 460800, 921600];
  function idOf(p:any): string { try { const info = p.getInfo?.() || {}; return `${info.usbVendorId||''}:${info.usbProductId||''}`; } catch { return 'unknown'; } }
  for (const baud of bauds) {
    try {
      await openSerialPort(port, baud);
      anyBytesSeen = false; bytesInWindow = 0;
      // Defer switching UI to connected until RX confirmed; emit baud only
      try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ baud: String(baud) }); } catch {}
      autoDetectActive = true; rawDetectBuf = new Uint8Array(0); detectStartMs = (typeof performance!=='undefined'?performance.now():Date.now());
      startReadLoop();
      try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ baud: String(baud), dtr: 'true', rts: 'true' }); } catch {}
      async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }
      // Use a temporary writer for probes; ensure release to avoid stale lock
      let w: WritableStreamDefaultWriter<Uint8Array> | null = null;
      try { w = serialPort?.writable?.getWriter?.() || null; } catch {}
      async function write(arr: Uint8Array) { if (w) { try { await w.write(arr); } catch {} } }
      await write(new Uint8Array([0x01])); if (anyBytesSeen) { try { await w?.releaseLock?.(); } catch {} w=null; break; } await sleep(100);
      await write(new TextEncoder().encode('start\n')); if (anyBytesSeen) { try { await w?.releaseLock?.(); } catch {} w=null; break; } await sleep(100);
      await write(new TextEncoder().encode('b')); if (anyBytesSeen) { try { await w?.releaseLock?.(); } catch {} w=null; break; } await sleep(200);
      try { await w?.releaseLock?.(); } catch {} w=null;
      const start = (typeof performance!=='undefined'?performance.now():Date.now());
      // First-chunk hex dump (up to 256 bytes)
      let firstDumped = false;
      while (!anyBytesSeen && ((typeof performance!=='undefined'?performance.now():Date.now()) - start) < 1200) { await sleep(50); }
      // Guard: verify RX over ~3s before connected
      const t0 = Date.now();
      await sleep(3000);
      const recent = rxHistory.filter(r => r.t >= t0);
      const avgBps = recent.length ? Math.round(recent.reduce((a,c)=>a+c.b,0)/recent.length) : 0;
      if (anyBytesSeen && avgBps >= 1000) {
        try { const { emitConnection, emitDiagnostics } = await import('./SignalBus'); emitConnection({ connected:true, simulation:false }); emitDiagnostics({ portId: idOf(port) }); } catch {}
        return { model: 'WebSerial-EEG', serial: idOf(port), sampleRate: cfg.sampleRate };
      } else {
        try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ errors: 'E_NO_STREAM: Port opened but no data stream' }); } catch {}
      }
      await safeClose();
    } catch {
      await safeClose();
    }
  }
  throw new Error('No data from selected port');
}

function startMock() {
  if (mockTimer) return;
  let t = 0;
  mockTimer = setInterval(() => {
    t += 1/256;
    const chans = Array.from({length:4},(_,i)=>Math.sin(2*Math.PI*(10+i)*(t)) * 10);
    for (const cb of sampleSubs.slice()) { try { cb({ tSec: t, chans }); } catch {} }
  }, 4);
}

async function startReadLoop() {
  if (!serialReader || readLoopRunning) return;
  readLoopRunning = true;
  // bytes/sec ticker
  if (!bytesTicker) {
    bytesTicker = setInterval(async () => {
      const b = bytesInWindow; bytesInWindow = 0;
      const f = framesInWindow; framesInWindow = 0;
      const c = chunksInWindow; chunksInWindow = 0;
      try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ bytesSec: String(b), framesSec: String(f), fs: String(f) }); } catch {}
      try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ chunksSec: String(c) }); } catch {}
      // Watchdog: if bytes/sec is zero for >2s, try auto-failover
      const now = Date.now();
      if (b > 0) { lastNonZeroMs = now; zeroByteWindows = 0; } else { zeroByteWindows++; }
      if (((now - lastNonZeroMs) > 2000 || zeroByteWindows >= 2) && !failoverRunning) {
        failoverRunning = true;
        (async () => {
          try {
            const serial = (navigator as any)?.serial; if (!serial) return;
            const ports = await serial.getPorts?.() || [];
            try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ errors: 'E_PORT_LOST: Stream lost; failing over…' }); } catch {}
            const chosen = await chooseStreamingPort(ports);
            if (chosen.port) {
              const info = chosen.port?.getInfo?.() || {}; const id = `${info.usbVendorId||''}:${info.usbProductId||''}`;
              if (id && id !== currentPortId) {
                await connectWithPort(chosen.port);
              }
            } else {
              try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ errors: 'No bytes on either port' }); } catch {}
            }
          } catch {}
          finally { zeroByteWindows = 0; failoverRunning = false; }
        })();
      }
    }, 1000);
  }
  try {
    let frameBuf = new Uint8Array(0);
    const frameSize = cfg.interleaved ? (cfg.channels * cfg.bytesPerSample) : (cfg.bytesPerSample);
    while (serialReader) {
      const { value, done } = await serialReader.read();
      if (done || !value) break;
      anyBytesSeen = anyBytesSeen || (value && value.length>0);
      bytesInWindow += value.length || 0;
      chunksInWindow += 1;
      // Accumulate
      const merged = new Uint8Array(frameBuf.length + value.length);
      merged.set(frameBuf, 0); merged.set(value, frameBuf.length);
      frameBuf = merged;
      if (autoDetectActive) {
        // stash raw bytes for detection
        const mergedDet = new Uint8Array(rawDetectBuf.length + value.length);
        mergedDet.set(rawDetectBuf, 0); mergedDet.set(value, rawDetectBuf.length);
        rawDetectBuf = mergedDet;
        // On first buffer, emit hex dump (256 bytes) and ASCII %
        try {
          if (rawDetectBuf.length >= 1) {
            const slice = rawDetectBuf.slice(0, Math.min(256, rawDetectBuf.length));
            const hex = Array.from(slice).map(b=>b.toString(16).padStart(2,'0')).join(' ');
            const asciiCount = Array.from(slice).reduce((acc,b)=> acc + ((b>=0x20 && b<=0x7e)?1:0), 0);
            const pct = Math.round(100*asciiCount/slice.length);
            const streamType = pct>60 ? 'Text/Control' : 'Binary';
            const { emitDiagnostics } = await import('./SignalBus');
            emitDiagnostics({ hex256: hex, asciiPct: String(pct), streamType });
          }
        } catch {}
        const elapsed = (typeof performance!=='undefined'?performance.now():Date.now()) - detectStartMs;
        if (elapsed >= 1000 && rawDetectBuf.length > cfg.channels*2*200) {
          try {
            const det = detectDecode(rawDetectBuf, cfg.channels, cfg.scaleMicroVPerLsb);
            if (det) {
              cfg.bytesPerSample = det.bps as 2|3;
              cfg.endian = det.endian as 'le'|'be';
              try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ decode: `${det.bps===2?'16':'24'}${det.endian.toUpperCase()}`, fs: det.fs?String(Math.round(det.fs)):undefined }); } catch {}
            } else {
              try { const { emitDiagnostics } = await import('./SignalBus'); emitDiagnostics({ errors: 'E_DECODE_FAIL: Bytes present but framing unknown (16/24, LE/BE).' }); } catch {}
            }
          } catch {}
          autoDetectActive = false; rawDetectBuf = new Uint8Array(0);
          // reset parse buffer to align fresh with new frame size
          frameBuf = new Uint8Array(0);
          continue;
        }
        continue;
      }
      // Parse frames
      const view = new DataView(frameBuf.buffer, frameBuf.byteOffset, frameBuf.byteLength);
      let offset = 0;
      while (frameBuf.length - offset >= frameSize) {
        const chans: number[] = [];
        if (cfg.interleaved) {
          for (let ch=0; ch<cfg.channels; ch++) {
            let raw = 0;
            if (cfg.bytesPerSample === 2) raw = cfg.endian==='le' ? view.getInt16(offset, true) : view.getInt16(offset, false);
            else {
              // 24-bit signed
              const b0 = frameBuf[offset + (cfg.endian==='le'?0:2)];
              const b1 = frameBuf[offset + 1];
              const b2 = frameBuf[offset + (cfg.endian==='le'?2:0)];
              let tmp = (b2<<16) | (b1<<8) | b0; if (tmp & 0x800000) tmp |= 0xff000000; raw = tmp;
            }
            chans.push(raw * cfg.scaleMicroVPerLsb);
            offset += cfg.bytesPerSample;
          }
        } else {
          // Non-interleaved not implemented; fallback to break
          break;
        }
        tSeconds += 1 / cfg.sampleRate;
        framesInWindow++;
        for (const cb of sampleSubs.slice()) { try { cb({ tSec: tSeconds, chans }); } catch {} }
      }
      // keep remainder
      frameBuf = frameBuf.slice(offset);
    }
  } catch {
    // stop on error; mock can be started manually
    readLoopRunning = false;
  }
}

export async function safeClose(): Promise<void> {
  try {
    // stop read loop and cancel reader
    readLoopRunning = false;
    if (serialReader) {
      try { await serialReader.cancel?.(); } catch {}
      try { await serialReader.releaseLock(); } catch {}
      serialReader = null;
    }
    // small wait to allow underlying stream to settle
    await new Promise((r)=>setTimeout(r, 50));
    if (serialWriter) {
      try { await serialWriter.releaseLock?.(); } catch {}
      serialWriter = null;
    }
    if (serialPort) {
      try { await serialPort.close(); } catch {}
      serialPort = null;
    }
    try { if (keepAliveTimer) clearInterval(keepAliveTimer); } catch {}
  } catch {}
}

async function openSerialPort(port:any, baud:number): Promise<void> {
  await safeClose();
  serialPort = port;
  await serialPort.open({ baudRate: baud });
  try { await serialPort.setSignals?.({ dataTerminalReady: true, requestToSend: true }); } catch {}
  serialReader = serialPort.readable.getReader();
  serialWriter = serialPort.writable?.getWriter?.() || null;
}

async function quickTestCandidate(port:any): Promise<{ ok:boolean; det?: { bps:2|3; endian:'le'|'be'; fs?:number; rms?:number } }> {
  const bauds = [115200, 230400, 460800, 921600];
  for (const baud of bauds) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    try {
      await port.open({ baudRate: baud });
      try { await port.setSignals?.({ dataTerminalReady: true, requestToSend: true }); } catch {}
      reader = port.readable.getReader();
      writer = port.writable?.getWriter?.() || null;
      async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }
      async function write(arr: Uint8Array) { if (writer) { try { await writer.write(arr); } catch {} } }
      await write(new Uint8Array([0x01])); await sleep(100);
      await write(new TextEncoder().encode('start\n')); await sleep(100);
      await write(new TextEncoder().encode('b'));
      const start = (typeof performance!=='undefined'?performance.now():Date.now());
      let buf = new Uint8Array(0);
      while (((typeof performance!=='undefined'?performance.now():Date.now()) - start) < 600) {
        if (!reader) break;
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length) {
          const merged = new Uint8Array(buf.length + value.length);
          merged.set(buf, 0); merged.set(value, buf.length);
          buf = merged;
        }
      }
      if (buf.length > 0) {
        const det = detectDecode(buf, cfg.channels, cfg.scaleMicroVPerLsb);
        const pass = !!det && (det!.fs||0) >= 240 && (det!.fs||0) <= 270 && (det as any).rms > 1;
        if (pass) {
          try { if (reader) { await reader.releaseLock(); } } catch {}
          try { await writer?.releaseLock?.(); } catch {}
          try { await port.close(); } catch {}
          return { ok:true, det: det as any };
        }
      }
    } catch {
      // ignore and try next baud
    } finally {
      try { if (reader) { await reader.releaseLock(); } } catch {}
      try { await writer?.releaseLock?.(); } catch {}
      try { await port.close(); } catch {}
    }
  }
  return { ok:false };
}

export function onSamples(cb:(frame: SampleFrame)=>void): () => void {
  sampleSubs.push(cb);
  return () => { const i = sampleSubs.indexOf(cb); if (i>=0) sampleSubs.splice(i,1); };
}

export async function getImpedance(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const { LABELS } = await import('../config/labels');
    for (const ch of LABELS as unknown as string[]) out[ch] = Math.round(Math.random()*15)+5;
  } catch {
  for (const ch of ['Fz','Cz','Pz','Oz','F3','F4','C3','C4','P3','P4','O1','O2']) out[ch] = Math.round(Math.random()*15)+5;
  }
  return out;
}

export async function disconnect(): Promise<void> {
  if (mockTimer) { clearInterval(mockTimer); mockTimer = null; }
  if (serialReader) { try { await serialReader.releaseLock(); } catch {} serialReader = null; }
  if (serialWriter) { try { await serialWriter.releaseLock?.(); } catch {} serialWriter = null; }
  if (serialPort) { try { await serialPort.close(); } catch {} serialPort = null; }
  if (simulationTimer) { clearInterval(simulationTimer); simulationTimer = null; }
  simChData = null; simIdx = 0;
  readLoopRunning = false;
  try { const { emitConnection } = await import('./SignalBus'); emitConnection({ connected:false, simulation:false }); } catch {}
}


// --- EDF Simulation ---
type EdfParse = {
  sampleRate: number;
  channels: number;
  labels: string[];
  data: Float32Array[]; // per-channel µV
};

function readAscii(view: DataView, start: number, len: number): string {
  let s = '';
  for (let i=0;i<len;i++) s += String.fromCharCode(view.getUint8(start+i));
  return s.trim();
}

async function parseEDFFile(file: File): Promise<EdfParse> {
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  const headerLen = parseInt(readAscii(view, 184, 8), 10); // bytes
  const numSignals = parseInt(readAscii(view, 252, 4), 10);
  const numRecords = parseInt(readAscii(view, 236, 8), 10);
  const durationSec = parseFloat(readAscii(view, 244, 8));
  const labels: string[] = [];
  const physMins: number[] = []; const physMaxs: number[] = [];
  const digMins: number[] = []; const digMaxs: number[] = [];
  const sPerRec: number[] = [];
  let off = 256; // signal headers start
  for (let i=0;i<numSignals;i++) { labels.push(readAscii(view, off + i*16, 16)); }
  off += numSignals*16; // transducer, skip 80
  off += numSignals*80;
  for (let i=0;i<numSignals;i++) { /* physical dimension */ readAscii(view, off + i*8, 8); }
  off += numSignals*8;
  for (let i=0;i<numSignals;i++) physMins.push(parseFloat(readAscii(view, off + i*8, 8))); off += numSignals*8;
  for (let i=0;i<numSignals;i++) physMaxs.push(parseFloat(readAscii(view, off + i*8, 8))); off += numSignals*8;
  for (let i=0;i<numSignals;i++) digMins.push(parseInt(readAscii(view, off + i*8, 8),10)); off += numSignals*8;
  for (let i=0;i<numSignals;i++) digMaxs.push(parseInt(readAscii(view, off + i*8, 8),10)); off += numSignals*8;
  // prefilter + reserved
  off += numSignals*80; // prefilter
  for (let i=0;i<numSignals;i++) sPerRec.push(parseInt(readAscii(view, off + i*8, 8),10));
  off += numSignals*8;
  off += numSignals*32; // reserved per signal

  const recBytesPerSignal: number[] = sPerRec.map(n=>n*2);
  const samplesPerRecord = sPerRec[0];
  // Assume uniform Fs
  for (let n of sPerRec) if (n !== samplesPerRecord) throw new Error('Non-uniform sample rates not supported');
  const fs = Math.round(samplesPerRecord / durationSec);
  const totalSamples = samplesPerRecord * numRecords;

  const dataStart = headerLen;
  const perChan: Float32Array[] = Array.from({length:numSignals}, ()=> new Float32Array(totalSamples));
  let recOffset = dataStart;
  for (let r=0;r<numRecords;r++) {
    for (let ch=0; ch<numSignals; ch++) {
      const base = recOffset + recBytesPerSignal.slice(0,ch).reduce((a,b)=>a+b,0);
      const scale = (physMaxs[ch]-physMins[ch]) / (digMaxs[ch]-digMins[ch] || 1);
      for (let i=0;i<samplesPerRecord;i++) {
        const dv = view.getInt16(base + i*2, true);
        const phys = (dv - digMins[ch]) * scale + physMins[ch];
        // Assume physical dimension already µV; if was mV, caller can rescale later
        perChan[ch][r*samplesPerRecord + i] = phys;
      }
    }
    recOffset += recBytesPerSignal.reduce((a,b)=>a+b,0);
  }
  return { sampleRate: fs, channels: numSignals, labels, data: perChan };
}

export async function startSimulationFromEDF(file: File): Promise<{ model?:string; serial?:string; sampleRate:number }>{
  const parsed = await parseEDFFile(file);
  // prepare streaming
  simFs = parsed.sampleRate; simIdx = 0; simChData = parsed.data;
  if (simulationTimer) { clearInterval(simulationTimer); }
  if (mockTimer) { clearInterval(mockTimer); mockTimer = null; }
  tSeconds = 0;
  let emittedCount = 0;
  const totalSamples = simChData?.[0]?.length || 0;
  const startMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const tickMs = Math.max(2, Math.round(1000/Math.max(1, Math.min(simFs, 1000))))
  simulationTimer = setInterval(() => {
    if (!simChData || totalSamples === 0) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const expected = Math.floor(((now - startMs) * simFs) / 1000);
    while (emittedCount < expected) {
      const idx = emittedCount % totalSamples;
    const cc = simChData.length;
    const out: number[] = new Array(cc);
    for (let ch=0; ch<cc; ch++) {
      const arr = simChData[ch];
        out[ch] = arr[idx] || 0;
      }
      emittedCount++;
      simIdx = (simIdx + 1) % totalSamples;
      tSeconds = emittedCount / simFs;
      for (const cb of sampleSubs.slice()) { try { cb({ tSec: tSeconds, chans: out }); } catch {} }
    }
  }, tickMs);
  try { const { emitConnection } = await import('./SignalBus'); emitConnection({ connected:true, simulation:true }); } catch {}
  return { model: 'EDF Simulation', serial: file.name, sampleRate: simFs };
}

// --- Synthetic Generators (QA) ---
export function startSynthetic(gen:(t:number)=>number[], fs:number = 256): { model?:string; serial?:string; sampleRate:number } {
  syntheticGen = gen; simFs = fs; tSeconds = 0;
  if (simulationTimer) { clearInterval(simulationTimer); }
  if (mockTimer) { clearInterval(mockTimer); mockTimer = null; }
  simulationTimer = setInterval(() => {
    if (!syntheticGen) return;
    tSeconds += 1/simFs;
    const chans = syntheticGen(tSeconds) || [];
    for (const cb of sampleSubs.slice()) { try { cb({ tSec: tSeconds, chans }); } catch {} }
  }, Math.max(1, Math.round(1000/simFs)));
  return { model: 'Synthetic', serial: 'QA', sampleRate: simFs };
}


// --- Auto-detect decode (16/24 × LE/BE), quick/approx ---
function detectDecode(bytes: Uint8Array, channels: number, scaleUvPerLsb: number): { bps: 2|3; endian: 'le'|'be'; fs?: number } | null {
  const candidates: Array<{ bps:2|3; endian:'le'|'be' }> = [
    { bps:2, endian:'le' }, { bps:2, endian:'be' }, { bps:3, endian:'le' }, { bps:3, endian:'be' }
  ];
  const record: Array<{ cand:string; rms:number; clipPct:number; identical:boolean; fs:number }> = [];
  for (const c of candidates) {
    const frameSize = channels * c.bps;
    const frames = Math.floor(bytes.length / frameSize);
    if (frames < 50) continue;
    const series: number[][] = Array.from({length: channels}, ()=> new Array(frames));
    let off = 0;
    for (let f=0; f<frames; f++) {
      for (let ch=0; ch<channels; ch++) {
        let raw = 0;
        if (c.bps===2) {
          const lo = bytes[off + (c.endian==='le'?0:1)];
          const hi = bytes[off + (c.endian==='le'?1:0)];
          raw = (hi<<8)|lo; if (raw & 0x8000) raw |= 0xffff0000;
        } else {
          const b0 = bytes[off + (c.endian==='le'?0:2)];
          const b1 = bytes[off + 1];
          const b2 = bytes[off + (c.endian==='le'?2:0)];
          raw = (b2<<16)|(b1<<8)|b0; if (raw & 0x800000) raw |= 0xff000000;
        }
        off += c.bps;
        series[ch][f] = raw * scaleUvPerLsb;
      }
    }
    // RMS and clip
    let sumsq = 0; let n = 0; let clip = 0; const FS = 500; // µV full-scale for check
    for (let ch=0; ch<channels; ch++) {
      for (let i=0;i<frames;i++) {
        const v = series[ch][i]; sumsq += v*v; n++;
        if (Math.abs(v) >= FS) clip++;
      }
    }
    const rms = Math.sqrt(sumsq / Math.max(1,n));
    const clipPct = clip / Math.max(1,n);
    // identical channels heuristic: compare coarse PSD via variance correlation
    let identical = false;
    if (channels >= 2) {
      const a = series[0]; const b = series[1];
      const ma = a.reduce((p,c)=>p+c,0)/a.length; const mb = b.reduce((p,c)=>p+c,0)/b.length;
      let cov=0, va=0, vb=0;
      for (let i=0;i<a.length;i++){ const da=a[i]-ma; const db=b[i]-mb; cov+=da*db; va+=da*da; vb+=db*db; }
      const corr = cov/Math.sqrt((va||1)*(vb||1));
      identical = Math.abs(corr) > 0.98;
    }
    // estimate fs from frame count vs elapsed 1s window assumption
    const fsEst = frames; // ~1 second captured
    record.push({ cand: `${c.bps===2?'16':'24'}${c.endian.toUpperCase()}`, rms, clipPct, identical, fs: fsEst });
  }
  // choose best
  let best = record.filter(r => r.rms > 1 && r.clipPct < 0.01 && !r.identical)
                   .sort((a,b)=> b.rms - a.rms)[0] || null;
  if (!best && record.length) best = record.sort((a,b)=> b.rms - a.rms)[0];
  if (!best) return null;
  const bps = best.cand.startsWith('16') ? 2 : 3;
  const endian = best.cand.endsWith('LE') ? 'le' : 'be';
  return { bps, endian, fs: best.fs };
}

// --- Runtime controls ---
export function setRawMode(enabled: boolean): void {
  rawModeEnabled = enabled;
}

