export type BandRms = number[][]; // [band][ch]

type BandRmsCb = (rms: BandRms) => void;
const bandSubs: BandRmsCb[] = [];

export function onBandRms(cb: BandRmsCb): () => void {
  bandSubs.push(cb);
  return () => {
    const i = bandSubs.indexOf(cb);
    if (i>=0) bandSubs.splice(i,1);
  };
}

export function emitBandRms(rms: BandRms): void {
  for (const cb of bandSubs.slice()) {
    try { cb(rms); } catch {}
  }
}

// Artifact flags bus
export type Artifacts = { blink:boolean; emg:boolean; clip:boolean; pop:boolean };
type ArtifactsCb = (a: Artifacts) => void;
const artSubs: ArtifactsCb[] = [];
export function onArtifacts(cb: ArtifactsCb): () => void {
  artSubs.push(cb);
  return () => { const i = artSubs.indexOf(cb); if (i>=0) artSubs.splice(i,1); };
}
export function emitArtifacts(a: Artifacts): void {
  for (const cb of artSubs.slice()) { try { cb(a); } catch {} }
}

// Recording state bus
type RecCb = (recording: boolean) => void;
const recSubs: RecCb[] = [];
export function onRecording(cb: RecCb): () => void {
  recSubs.push(cb);
  return () => { const i = recSubs.indexOf(cb); if (i>=0) recSubs.splice(i,1); };
}
export function emitRecording(recording: boolean): void {
  for (const cb of recSubs.slice()) { try { cb(recording); } catch {} }
}

// Baseline seconds bus
type BaselineCb = (sec: number) => void;
const baseSubs: BaselineCb[] = [];
export function onBaselineSec(cb: BaselineCb): () => void {
  baseSubs.push(cb);
  return () => { const i = baseSubs.indexOf(cb); if (i>=0) baseSubs.splice(i,1); };
}
export function emitBaselineSec(sec: number): void {
  for (const cb of baseSubs.slice()) { try { cb(sec); } catch {} }
}

// Connection/simulation status
export type Connection = { connected:boolean; simulation:boolean };
type ConnCb = (c: Connection) => void;
const connSubs: ConnCb[] = [];
export function onConnection(cb: ConnCb): () => void {
  connSubs.push(cb);
  return () => { const i = connSubs.indexOf(cb); if (i>=0) connSubs.splice(i,1); };
}
export function emitConnection(c: Connection): void {
  for (const cb of connSubs.slice()) { try { cb(c); } catch {} }
}


// Diagnostics bus (port/baud/throughput/errors)
export type Diagnostics = {
  portId?: string;
  baud?: string;
  dtr?: string;
  rts?: string;
  bytesSec?: string;
  chunksSec?: string;
  framesSec?: string;
  fs?: string;
  decode?: string;
  clipPct?: string;
  errors?: string;
  asciiPct?: string;
  hex256?: string;
  streamType?: string;
};
type DiagCb = (d: Diagnostics) => void;
const diagSubs: DiagCb[] = [];
export function onDiagnostics(cb: DiagCb): () => void {
  diagSubs.push(cb);
  return () => { const i = diagSubs.indexOf(cb); if (i>=0) diagSubs.splice(i,1); };
}
export function emitDiagnostics(d: Diagnostics): void {
  for (const cb of diagSubs.slice()) { try { cb(d); } catch {} }
}

// RX info (channels, optional labels)
export type RxInfo = { channels: number; labels?: string[] };
type RxCb = (i: RxInfo) => void;
const rxSubs: RxCb[] = [];
export function onRxInfo(cb: RxCb): () => void {
  rxSubs.push(cb);
  return () => { const i = rxSubs.indexOf(cb); if (i>=0) rxSubs.splice(i,1); };
}
export function emitRxInfo(i: RxInfo): void {
  for (const cb of rxSubs.slice()) { try { cb(i); } catch {} }
}


