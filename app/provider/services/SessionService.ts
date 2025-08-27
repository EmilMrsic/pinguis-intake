"use client";
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, setDoc, query, where, orderBy, limit, serverTimestamp, startAfter, updateDoc, Timestamp } from 'firebase/firestore';

export type Id = string;

type SessionDoc = {
  patientId: Id;
  sessionNumber: number;
  startedAt: string;
  updatedAt: string;
  authorId: Id;
  status: 'open'|'in_review'|'completed'|'archived';
  intakeStatus: 'not_started'|'in_progress'|'complete';
  gapStatus: 'not_started'|'in_progress'|'complete';
  mapStatus: 'not_started'|'capturing'|'complete';
  notes?: string;
  tags?: string[];
};

type IntakeDoc = {
  sessionId: Id;
  patientId: Id;
  formVersion?: string;
  answers?: any;
  aiRecap?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type GapReportDoc = {
  sessionId: Id;
  patientId: Id;
  questions?: any[];
  responses?: Record<string, any>;
  generatedMd?: string;
  createdBy?: Id;
  createdAt?: string;
  updatedAt?: string;
};

type MapDoc = {
  sessionId: Id;
  patientId: Id;
  deviceInfo?: Record<string, any>;
  capture?: { sampleRate: number; channels: string[]; durationSec: number };
  artifacts?: { baselineSeconds?: number; filters?: { hp?: number; lp?: number; notch?: number } };
  files?: { edfUrl?: string; pngThumbUrl?: string };
  status: 'not_started'|'capturing'|'complete';
  createdAt?: string;
  updatedAt?: string;
};

function db() { const app = firebaseClient(); return getFirestore(app); }
function auth() { const app = firebaseClient(); return getAuth(app); }

export async function getPracticeId(): Promise<string> {
  const a = auth();
  const u = a.currentUser;
  if (!u) throw new Error('Not signed in');
  const tok = await u.getIdTokenResult();
  const pid = (tok.claims as any)?.practice_id as string | undefined;
  if (!pid) throw new Error('No practice_id claim');
  return pid;
}

function sessionsColPath(pid: string, patientId: Id) {
  return `practices/${pid}/clients/${patientId}/sessions`;
}

export async function listSessions(patientId: Id, opts?: { pageSize?: number; cursorUpdatedAt?: string|null }) {
  const dbi = db(); const pid = await getPracticeId();
  const colRef = collection(dbi, sessionsColPath(pid, patientId));
  const pageSize = opts?.pageSize || 25;
  let qRef = query(colRef, orderBy('updatedAt', 'desc'), limit(pageSize));
  if (opts?.cursorUpdatedAt) {
    // simple cursor using updatedAt string; fetch doc snapshot by where
    const curSnap = await getDocs(query(colRef, where('updatedAt','==', opts.cursorUpdatedAt), limit(1)));
    const anchor = curSnap.docs[0];
    if (anchor) qRef = query(colRef, orderBy('updatedAt','desc'), startAfter(anchor), limit(pageSize));
  }
  const snap = await getDocs(qRef);
  const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as (SessionDoc & { id: Id })[];
  const nextCursor = items.length === pageSize ? items[items.length-1]?.updatedAt || null : null;
  return { items, nextCursor };
}

export async function createSession(patientId: Id): Promise<{ id: Id } & SessionDoc> {
  const dbi = db(); const pid = await getPracticeId(); const a = auth(); const u = a.currentUser!;
  const colRef = collection(dbi, sessionsColPath(pid, patientId));
  // determine next sessionNumber
  const lastSnap = await getDocs(query(colRef, orderBy('sessionNumber','desc'), limit(1)));
  const lastNum = lastSnap.docs[0]?.data()?.sessionNumber || 0;
  const nowIso = new Date().toISOString();
  const payload: SessionDoc = {
    patientId,
    sessionNumber: Number(lastNum) + 1,
    startedAt: nowIso,
    updatedAt: nowIso,
    authorId: u.uid,
    status: 'open',
    intakeStatus: 'not_started',
    gapStatus: 'not_started',
    mapStatus: 'not_started',
  };
  const ref = await addDoc(colRef, { ...payload, createdAt: serverTimestamp(), updatedAtTs: serverTimestamp() } as any);
  return { id: ref.id, ...payload };
}

export async function getSession(patientId: Id, sessionId: Id): Promise<{ id: Id } & SessionDoc | null> {
  const dbi = db(); const pid = await getPracticeId();
  const ref = doc(dbi, sessionsColPath(pid, patientId), sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as any;
}

export async function updateSession(patientId: Id, sessionId: Id, patch: Partial<SessionDoc>): Promise<void> {
  const dbi = db(); const pid = await getPracticeId();
  const ref = doc(dbi, sessionsColPath(pid, patientId), sessionId);
  await updateDoc(ref, { ...patch, updatedAt: new Date().toISOString(), updatedAtTs: serverTimestamp() } as any);
}

export async function getIntake(patientId: Id, sessionId: Id): Promise<{ id: Id } & IntakeDoc | null> {
  const dbi = db(); const pid = await getPracticeId();
  const ref = doc(dbi, `${sessionsColPath(pid, patientId)}/${sessionId}/intake/current`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as any;
}

export async function upsertIntake(patientId: Id, sessionId: Id, payload: Partial<IntakeDoc>): Promise<void> {
  const dbi = db(); const pid = await getPracticeId();
  const ref = doc(dbi, `${sessionsColPath(pid, patientId)}/${sessionId}/intake/current`);
  const nowIso = new Date().toISOString();
  await setDoc(ref, { patientId, sessionId, ...payload, updatedAt: nowIso, createdAt: (payload as any)?.createdAt || nowIso } as any, { merge: true });
  // bump session intake status
  const complete = !!payload.completedAt;
  await updateSession(patientId, sessionId, { intakeStatus: complete ? 'complete' : 'in_progress' } as any);
}

export async function listGapReports(patientId: Id, sessionId: Id): Promise<({ id: Id } & GapReportDoc)[]> {
  const dbi = db(); const pid = await getPracticeId();
  const colRef = collection(dbi, `${sessionsColPath(pid, patientId)}/${sessionId}/gapReports`);
  const snap = await getDocs(query(colRef, orderBy('createdAt','desc')));
  return snap.docs.map(d=>({ id:d.id, ...(d.data() as any) }));
}

export async function createGapReport(patientId: Id, sessionId: Id, payload: Partial<GapReportDoc>): Promise<{ id: Id } & GapReportDoc> {
  const dbi = db(); const pid = await getPracticeId(); const a = auth(); const u = a.currentUser!;
  const colRef = collection(dbi, `${sessionsColPath(pid, patientId)}/${sessionId}/gapReports`);
  const nowIso = new Date().toISOString();
  const docRef = await addDoc(colRef, { patientId, sessionId, createdBy: u.uid, createdAt: nowIso, updatedAt: nowIso, ...payload } as any);
  await updateSession(patientId, sessionId, { gapStatus: 'in_progress' });
  return { id: docRef.id, patientId, sessionId, createdBy: u.uid, createdAt: nowIso, updatedAt: nowIso, questions: [], responses: {}, ...payload } as any;
}

export async function getMap(patientId: Id, sessionId: Id): Promise<{ id: Id } & MapDoc | null> {
  const dbi = db(); const pid = await getPracticeId();
  const ref = doc(dbi, `${sessionsColPath(pid, patientId)}/${sessionId}/maps/current`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as any;
}

export async function upsertMap(patientId: Id, sessionId: Id, payload: Partial<MapDoc>): Promise<void> {
  const dbi = db(); const pid = await getPracticeId();
  const ref = doc(dbi, `${sessionsColPath(pid, patientId)}/${sessionId}/maps/current`);
  const nowIso = new Date().toISOString();
  await setDoc(ref, { patientId, sessionId, status: 'capturing', ...payload, updatedAt: nowIso, createdAt: (payload as any)?.createdAt || nowIso } as any, { merge: true });
  await updateSession(patientId, sessionId, { mapStatus: payload.status === 'complete' ? 'complete' : 'capturing' } as any);
}

export async function detectIfPatientIdOrIntakeId(id: Id): Promise<{ kind: 'patient'|'intake', patientId: Id, sessionId?: Id|null } | null> {
  const dbi = db(); const pid = await getPracticeId();
  // Try patient sessions
  try {
    const sessSnap = await getDocs(query(collection(dbi, sessionsColPath(pid, id)), limit(1)));
    if (!sessSnap.empty) return { kind: 'patient', patientId: id };
  } catch {}
  // Try legacy intake-id lookup via old collection
  try {
    const legacy = await getDocs(collection(dbi, `practices/${pid}/intakes`));
    for (const d of legacy.docs) { if (d.id === id) { const data = d.data() as any; return { kind: 'intake', patientId: data.client_id || '', sessionId: null }; } }
  } catch {}
  return null;
}


