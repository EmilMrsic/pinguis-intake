export type Id = string;
export type Provider = { id: Id; name: string; email: string; role?: 'provider'|'admin' };
export type Client = { id: Id; firstName: string; lastName: string; dob?: string; mrn?: string; intakeStatus?: 'Complete'|'Incomplete'|'Stale'; lastIntakeAt?: string };
export type SessionConfig = { montage: '12_site'|'19_site'|'custom'; channels: number; reference: 'linked_ears'|'average'|'Cz'; bandpassHz: readonly [number, number]; notchHz: 50|60; samplingRateHz: number; scaleMicroV?: number };
export type Session = { id: Id; clientId: Id; providerId: Id; device?: { model?: string; serial?: string }; status: 'pending'|'recording'|'complete'|'needs_rerecord'; config: SessionConfig; startedAt: string; completedAt?: string };
export type Segment = { id: Id; sessionId: Id; condition: 'EC'|'EO'|'TASK'; targetSec: number; actualSec?: number; artifactRatio?: number; status: 'pending'|'recording'|'complete'|'failed' };
export type Features = { segmentId: Id; bandpower: Record<'delta'|'theta'|'alpha'|'smr'|'beta'|'hibeta', number>; alphaPeakHz?: number };


