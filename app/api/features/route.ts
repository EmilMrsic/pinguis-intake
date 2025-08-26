import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { segmentId } = await req.json();
    if (!segmentId) return NextResponse.json({ ok:false, error:'segmentId required' }, { status:400 });
    // Stub features
    const bandpower = { delta: 1, theta: 1, alpha: 2, smr: 1, beta: 1, hibeta: 0.5 };
    return NextResponse.json({ ok:true, segmentId, bandpower, alphaPeakHz: 10 });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'features failed' }, { status:500 });
  }
}


