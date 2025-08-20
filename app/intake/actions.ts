"use server";
import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';
import { ulid } from '@/lib/devIds';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  // Prefer Application Default Credentials locally (gcloud auth application-default login)
  // and pass projectId explicitly from env for consistency
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    credential: applicationDefault(),
  });
}

export type IntakeSnapshot = Record<string, unknown>;

export async function saveIntakeAction(input: {
  practiceId: string;
  intakeId?: string;
  clientId: string;
  payload: IntakeSnapshot;
}) {
  const { practiceId, clientId } = input;
  const intakeId = input.intakeId ?? ulid();

  // Autosave accepts partial payloads; full schema validation happens on final submit.

  const app = initAdmin();
  const db = getFirestore(app);

  const now = new Date().toISOString();
  const ref = db.doc(`practices/${practiceId}/intakes/${intakeId}`);
  await ref.set({
    practice_id: practiceId,
    client_id: clientId,
    intake_id: intakeId,
    updated_at: now,
    // set created_at only once
    created_at: (await ref.get()).exists ? undefined : now,
    payload: input.payload,
  }, { merge: true });

  return { intakeId, updated_at: now };
}


