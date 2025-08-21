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
    const { intakeId } = await req.json();
    const app = initAdmin();
    const storage = getStorage(app);
    const gsPath = process.env.NEXT_PUBLIC_PROFILE_GS_PATH || 'gs://pinguis-dev.firebasestorage.app/client-profile-images';
    const match = gsPath.replace('gs://', '').split('/');
    const bucketName = match.shift()!;
    const baseFolder = match.join('/') || 'client-profile-images';

    // Simple abstract placeholder (SVG) – lightweight and no external API
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
      <defs>
        <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
          <stop offset='0%' stop-color='#38bdf8'/>
          <stop offset='100%' stop-color='#f59e0b'/>
        </linearGradient>
      </defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <circle cx='256' cy='256' r='180' fill='rgba(255,255,255,0.18)'/>
      <circle cx='180' cy='320' r='110' fill='rgba(255,255,255,0.12)'/>
      <circle cx='340' cy='190' r='90' fill='rgba(255,255,255,0.10)'/>
    </svg>`;

    const buffer = Buffer.from(svg);
    const filePath = `${baseFolder}/${intakeId || 'unknown'}/abstract-${Date.now()}.svg`;
    const bucket = storage.bucket(bucketName);
    const dest = bucket.file(filePath);
    await dest.save(buffer, { contentType: 'image/svg+xml', public: true, resumable: false, metadata: { cacheControl: 'public,max-age=31536000' } });

    const url = `https://storage.googleapis.com/${bucketName}/${encodeURI(filePath)}`;
    return NextResponse.json({ ok: true, url });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Avatar generation failed' }, { status: 500 });
  }
}


