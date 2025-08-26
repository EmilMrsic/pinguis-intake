import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, getDoc, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Client, Provider, Id, SessionConfig, Session, Segment, Features } from '../schema';
import { CONFIG } from '../config';

function db() { const app = firebaseClient(); return getFirestore(app); }
function auth() { const app = firebaseClient(); return getAuth(app); }

export async function getProvider(): Promise<Provider> {
  const a = auth();
  const u = a.currentUser;
  if (!u) throw new Error('Not signed in');
  return { id: u.uid, name: u.displayName || (u.email || '').split('@')[0] || 'Provider', email: u.email || '', role: 'provider' };
}

export async function searchClients(qs: string): Promise<Client[]> {
  const dbi = db();
  const out: Client[] = [];
  // naive: scan all practices/*/clients (in real app, scope by provider/tenant)
  const practices = await getDocs(collection(dbi, 'practices'));
  for (const p of practices.docs) {
    const clientsCol = collection(dbi, `practices/${p.id}/clients`);
    const snap = await getDocs(clientsCol);
    for (const c of snap.docs) {
      const d = c.data() as any;
      const name = `${d.first_name||''} ${d.last_name||''}`.toLowerCase();
      if (!qs || name.includes(qs.toLowerCase()) || (d.email||'').toLowerCase().includes(qs.toLowerCase())) {
        out.push({ id: c.id, firstName: d.first_name||'', lastName: d.last_name||'', dob: d.birthdate||d.dob||'', mrn: d.mrn||undefined });
      }
    }
  }
  return out;
}

export async function getClientIntake(clientId: Id): Promise<{status:'Complete'|'Incomplete'|'Stale', lastIntakeAt?: string}> {
  const dbi = db();
  let latest: any = null; let lastAt = '';
  const practices = await getDocs(collection(dbi, 'practices'));
  for (const p of practices.docs) {
    const intakesCol = collection(dbi, `practices/${p.id}/intakes`);
    const snap = await getDocs(query(intakesCol, where('client_id','==', clientId)));
    for (const d of snap.docs) {
      const data = d.data() as any; if (!latest || (data.updated_at||'') > (latest.updated_at||'')) { latest = data; lastAt = data.updated_at; }
    }
  }
  if (!latest) return { status: 'Incomplete' };
  const complete = latest.complete === true;
  if (!complete) return { status: 'Incomplete', lastIntakeAt: lastAt };
  if (lastAt) {
    const ageDays = Math.floor((Date.now() - new Date(lastAt).getTime()) / 864e5);
    if (ageDays > CONFIG.intakeMaxAgeDays) return { status: 'Stale', lastIntakeAt: lastAt };
  }
  return { status: 'Complete', lastIntakeAt: lastAt };
}

export async function createSession(clientId: Id, cfg: Partial<SessionConfig>): Promise<Session> {
  const dbi = db(); const prov = await getProvider();
  // write under /sessions
  const baseCfg: SessionConfig = {
    montage: cfg.montage || '12_site', channels: cfg.channels || 12, reference: cfg.reference || 'linked_ears',
    bandpassHz: cfg.bandpassHz || CONFIG.bandpassHz, notchHz: (cfg.notchHz as any) || CONFIG.notchHz, samplingRateHz: cfg.samplingRateHz || CONFIG.samplingRateHz,
    scaleMicroV: cfg.scaleMicroV || 1,
  } as SessionConfig;
  const ref = await addDoc(collection(dbi, 'sessions'), {
    client_id: clientId,
    provider_id: prov.id,
    status: 'pending',
    config: baseCfg,
    started_at: new Date().toISOString(),
    created_at: serverTimestamp(),
  } as any);
  return { id: ref.id, clientId, providerId: prov.id, status: 'pending', config: baseCfg, startedAt: new Date().toISOString() };
}

export async function updateSessionConfig(sessionId: Id, cfg: Partial<SessionConfig>): Promise<void> {
  const dbi = db();
  await updateDoc(doc(dbi, 'sessions', sessionId), { config: cfg } as any);
}

export async function createSegment(sessionId: Id, condition:'EC'|'EO'|'TASK', targetSec:number): Promise<Segment> {
  const dbi = db();
  const segRef = await addDoc(collection(dbi, 'segments'), { session_id: sessionId, condition, target_sec: targetSec, status:'pending', created_at: serverTimestamp() } as any);
  return { id: segRef.id, sessionId, condition, targetSec, status:'pending' };
}

export async function appendSegmentChunk(segmentId: Id, chunk: Float32Array, ts0:number, ts1:number): Promise<void> {
  const dbi = db();
  // Stub: store small meta doc under files collection referencing storage path in future
  await addDoc(collection(dbi, 'files'), { segment_id: segmentId, ts0, ts1, bytes: chunk.byteLength, created_at: serverTimestamp() } as any);
}

export async function finalizeSegment(segmentId: Id, meta:{actualSec:number; artifactRatio:number}): Promise<{ edfPath: string }> {
  const res = await fetch('/api/edf/finalize', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ segmentId, meta }) });
  if (!res.ok) throw new Error('edf finalize failed');
  const data = await res.json();
  return { edfPath: data?.edfPath || '' };
}

export async function computeFeatures(segmentId: Id): Promise<Features> {
  const res = await fetch('/api/features', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ segmentId }) });
  if (!res.ok) throw new Error('features failed');
  return res.json();
}

export async function exportSession(_sessionId: Id): Promise<{ zipPath: string }> {
  return { zipPath: '/tmp/session.zip' };
}


