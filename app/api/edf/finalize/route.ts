import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { segmentId } = await req.json();
    if (!segmentId) return NextResponse.json({ ok:false, error:'segmentId required' }, { status:400 });
    // Stub: return a placeholder path
    return NextResponse.json({ ok:true, edfPath: `/sessions/seg_${segmentId}.edf` });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'finalize failed' }, { status:500 });
  }
}


