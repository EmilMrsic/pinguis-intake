import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, getDoc, query, where, serverTimestamp, updateDoc, limit } from 'firebase/firestore';
import type { Client, Provider, Id, SessionConfig, Session, Segment, Features } from '../schema';
import { CONFIG } from '../config';

function db() { const app = firebaseClient(); return getFirestore(app); }
function auth() { const app = firebaseClient(); return getAuth(app); }
async function getPracticeId(): Promise<string> {
  const a = auth();
  const u = a.currentUser;
  if (!u) throw new Error('Not signed in');
  const tok = await u.getIdTokenResult();
  const pid = (tok.claims as any)?.practice_id as string | undefined;
  if (!pid) throw new Error('No practice_id claim');
  return pid;
}

export async function getProvider(): Promise<Provider> {
  const a = auth();
  const u = a.currentUser;
  if (!u) throw new Error('Not signed in');
  return { id: u.uid, name: u.displayName || (u.email || '').split('@')[0] || 'Provider', email: u.email || '', role: 'provider' };
}

export async function searchClients(qs: string): Promise<Client[]> {
  const dbi = db();
  const pid = await getPracticeId();
  const out: Client[] = [];
  const clientsCol = collection(dbi, `practices/${pid}/clients`);
  const snap = await getDocs(clientsCol);
  for (const c of snap.docs) {
    const d = c.data() as any;
    const name = `${d.first_name||''} ${d.last_name||''}`.toLowerCase();
    if (!qs || name.includes(qs.toLowerCase()) || (d.email||'').toLowerCase().includes(qs.toLowerCase())) {
      out.push({ id: c.id, firstName: d.first_name||'', lastName: d.last_name||'', dob: d.birthdate||d.dob||'', mrn: d.mrn||undefined });
    }
  }
  // Fallback: if none, try constructing from recent intakes payloads
  if (!out.length) {
    const intsSnap = await getDocs(collection(dbi, `practices/${pid}/intakes`));
    for (const d of intsSnap.docs) {
      const data = d.data() as any;
      const profile = data?.payload?.profile || {};
      if (!profile?.first_name && !profile?.last_name) continue;
      const name = `${profile.first_name||''} ${profile.last_name||''}`.toLowerCase();
      if (!qs || name.includes(qs.toLowerCase()) || (profile.email||'').toLowerCase().includes(qs.toLowerCase())) {
        out.push({ id: data.client_id || '', firstName: profile.first_name||'', lastName: profile.last_name||'', dob: profile.birthdate||'', mrn: undefined });
      }
    }
  }
  return out;
}

export async function getClientById(clientId: Id): Promise<Client | null> {
  const dbi = db();
  const pid = await getPracticeId();
  // Try clients
  const clientsSnap = await getDocs(collection(dbi, `practices/${pid}/clients`));
  for (const c of clientsSnap.docs) {
    if (c.id === clientId) {
      const d = c.data() as any;
      return { id: c.id, firstName: d.first_name||'', lastName: d.last_name||'', dob: d.birthdate||d.dob||'', mrn: d.mrn||undefined };
    }
  }
  // Fallback via intake payload
  const intakesSnap = await getDocs(collection(dbi, `practices/${pid}/intakes`));
  for (const d of intakesSnap.docs) {
    const data = d.data() as any;
    if (data?.client_id === clientId) {
      const p = data?.payload?.profile || {};
      return { id: clientId, firstName: p.first_name||'', lastName: p.last_name||'', dob: p.birthdate||'', mrn: undefined };
    }
  }
  return null;
}

export async function getClientFromIntake(intakeId: Id): Promise<Client | null> {
  const dbi = db();
  const pid = await getPracticeId();
  // 1) Direct doc get by id (works with rules that allow read but not list)
  try {
    const ref = doc(dbi, `practices/${pid}/intakes/${intakeId}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as any;
      const p = data?.payload?.profile || {};
      const cid = data?.client_id || '';
      return { id: cid, firstName: p.first_name||'', lastName: p.last_name||'', dob: p.birthdate||'', mrn: undefined };
    }
  } catch {}
  // 2) Fallback: query by `intakeId` field
  try {
    const q1 = query(collection(dbi, `practices/${pid}/intakes`), where('intakeId','==', intakeId), limit(1));
    const s1 = await getDocs(q1);
    const d = s1.docs[0];
    if (d) {
      const data = d.data() as any; const p = data?.payload?.profile || {}; const cid = data?.client_id || '';
      return { id: cid, firstName: p.first_name||'', lastName: p.last_name||'', dob: p.birthdate||'', mrn: undefined };
    }
  } catch {}
  // 3) Fallback: query by legacy `intake_id` field
  try {
    const q2 = query(collection(dbi, `practices/${pid}/intakes`), where('intake_id','==', intakeId), limit(1));
    const s2 = await getDocs(q2);
    const d2 = s2.docs[0];
    if (d2) {
      const data = d2.data() as any; const p = data?.payload?.profile || {}; const cid = data?.client_id || '';
      return { id: cid, firstName: p.first_name||'', lastName: p.last_name||'', dob: p.birthdate||'', mrn: undefined };
    }
  } catch {}
  return null;
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


