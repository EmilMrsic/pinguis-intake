export async function finalizeEDF(segmentId: string, meta?: any): Promise<{ edfPath: string }>{
  const res = await fetch('/api/edf/finalize', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ segmentId, meta }) });
  if (!res.ok) throw new Error('edf finalize failed');
  return res.json();
}


