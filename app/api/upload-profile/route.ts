import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    credential: applicationDefault(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const intakeId = (form.get('intakeId') as string) || 'unknown';
    if (!file) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || 'application/octet-stream';

    const app = initAdmin();
    const storage = getStorage(app);

    // Derive bucket and folder from env or provided gs path
    const gsPath = process.env.NEXT_PUBLIC_PROFILE_GS_PATH || 'gs://pinguis-dev.firebasestorage.app/client-profile-images';
    const match = gsPath.replace('gs://', '').split('/');
    const bucketName = match.shift()!; // e.g., pinguis-dev.appspot.com or custom
    const baseFolder = match.join('/') || 'client-profile-images';

    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
    const filePath = `${baseFolder}/${intakeId}/${Date.now()}.${ext}`;

    const bucket = storage.bucket(bucketName);
    const dest = bucket.file(filePath);
    await dest.save(buffer, { contentType, public: true, resumable: false, metadata: { cacheControl: 'public,max-age=31536000' } });

    // Public URL via Google Cloud Storage
    const url = `https://storage.googleapis.com/${bucketName}/${encodeURI(filePath)}`;
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Upload failed' }, { status: 500 });
  }
}


