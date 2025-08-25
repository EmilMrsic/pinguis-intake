"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getAuth } from 'firebase/auth';

export function SendIntakeButton({ intakeId }: { intakeId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend() {
    setLoading(true); setError(null);
    try {
      const auth = getAuth();
      const u = auth.currentUser!;
      const res = await fetch('/api/provider/send-intake', { method:'POST', headers:{'Content-Type':'application/json', Authorization: `Bearer ${await u.getIdToken()}`}, body: JSON.stringify({ intakeId }) });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.error || 'Failed');
      setLink(data.link);
      try { if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) await (navigator as any).clipboard.writeText(data.link); } catch {}
    } catch (e:any) { setError(e?.message || 'Failed'); } finally { setLoading(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onSend} disabled={loading}>{loading?'Creating…':'Send intake'}</Button>
      {link && <a target="_blank" href={link} className="text-xs underline">Open</a>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}


