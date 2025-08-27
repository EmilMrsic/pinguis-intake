"use client";
import { Button } from '@/components/ui/button';
import { upsertMap } from '@/app/provider/services/SessionService';

export default function ReviewSave() {
  async function finalize() {
    try {
      const url = new URL(window.location.href);
      const m = url.pathname.match(/\/provider\/patients\/(.+?)\/sessions\/(.+?)\//);
      const patientId = m?.[1];
      const sessionId = m?.[2];
      let thumbUrl: string | undefined;
      try {
        // Find the primary oscilloscope or record canvas
        const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
        const target = canvases.sort((a,b)=> (b.width*b.height) - (a.width*a.height))[0];
        if (target) {
          const w = 320, h = 180;
          const off = document.createElement('canvas'); off.width = w; off.height = h;
          const ctx = off.getContext('2d');
          if (ctx) {
            // draw with contain fit and dark bg
            ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,w,h);
            const scale = Math.min(w/target.width, h/target.height);
            const dw = Math.floor(target.width*scale), dh = Math.floor(target.height*scale);
            const dx = Math.floor((w-dw)/2), dy = Math.floor((h-dh)/2);
            ctx.drawImage(target, dx, dy, dw, dh);
            thumbUrl = off.toDataURL('image/png');
          }
        }
      } catch {}
      if (patientId && sessionId) {
        await upsertMap(patientId, sessionId, { status: 'complete' as any, files: { pngThumbUrl: thumbUrl } as any });
      }
      // Fallback: legacy no-op
    } catch {}
  }
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">Review baseline quality and export artifacts.</div>
      <div className="flex items-center gap-2">
        <Button variant="outline">Needs re-record</Button>
        <Button onClick={finalize}>Finalize & Export</Button>
      </div>
    </div>
  );
}


