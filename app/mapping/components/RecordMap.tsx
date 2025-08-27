"use client";
import { useEffect, useRef, useState } from 'react';
import { onSamples } from '../services/DeviceService';
import { LABELS } from '../config/labels';
import { onBandRms, onArtifacts } from '../services/SignalBus';

type Props = { activeZone: readonly [string,string] | null };

export default function RecordMap({ activeZone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const unsubRef = useRef<null | (()=>void)>(null);
  const [buf, setBuf] = useState<number[][]>(() => Array.from({length: LABELS.length}, () => Array(256*5).fill(0)));
  const writeIdxRef = useRef<number>(0);
  const latestBandRmsRef = useRef<number[][]>([]);
  const latestArtifactsRef = useRef<{blink:boolean;emg:boolean;clip:boolean;pop:boolean}>({blink:false,emg:false,clip:false,pop:false});

  useEffect(() => onBandRms(r=>{ latestBandRmsRef.current = r; }), []);
  useEffect(() => onArtifacts(a=>{ latestArtifactsRef.current = a; }), []);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = onSamples((f) => {
      const chans = f.chans;
      setBuf(prev => {
        const cc = Math.max(prev.length, chans.length);
        const next = prev.length < cc ? [...prev, ...Array.from({length: cc - prev.length}, ()=>Array(prev[0]?.length || 1280).fill(0))] : prev;
        const N = next[0].length;
        const idx = writeIdxRef.current % N;
        for (let i=0;i<chans.length;i++) next[i][idx] = chans[i] ?? 0;
        writeIdxRef.current = (writeIdxRef.current + 1) % N;
        return next;
      });
    });
    return () => { try { unsubRef.current?.(); } catch {} };
  }, []);

  useEffect(() => {
    function draw() {
      const cvs = canvasRef.current; if (!cvs) { requestAnimationFrame(draw); return; }
      const ctx = cvs.getContext('2d'); if (!ctx) { requestAnimationFrame(draw); return; }
      const w = cvs.width, h = cvs.height;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,w,h);
      const rows = LABELS.length;
      const rowH = h / rows;
      const leftPad = 50;
      // draw condensed heartbeat traces
      ctx.strokeStyle = 'rgba(80,160,255,0.9)'; ctx.lineWidth = 1.5; ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(80,160,255,0.5)';
      const N = buf[0]?.length || 1;
      for (let ch=0; ch<rows; ch++) {
        const trace = buf[ch] || [];
        const midY = rowH*ch + rowH/2;
        ctx.fillStyle = 'rgba(200,220,255,0.8)'; ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(LABELS[ch], 6, midY);
        ctx.beginPath();
        for (let i=0;i<N;i++) {
          const x = leftPad + (i / (N-1)) * (w-leftPad);
          const v = trace[(writeIdxRef.current + i) % N] || 0;
          const y = midY - (v * (rowH/60));
          if (i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // artifact banner
      const a = latestArtifactsRef.current;
      const flags = Object.entries(a).filter(([,v])=>v).map(([k])=>k.toUpperCase());
      if (flags.length) {
        const text = flags.join(' • ');
        ctx.fillStyle = 'rgba(239,68,68,0.9)';
        ctx.fillRect(leftPad, 8, ctx.measureText(text).width + 16, 20);
        ctx.fillStyle = 'white'; ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'; ctx.textBaseline = 'top'; ctx.fillText(text, leftPad+8, 10);
      }
      // inset: active zone with band bars
      if (activeZone) {
        const zW = Math.min(240, Math.floor(w*0.3)), zH = 90; const zx = w - zW - 10, zy = 10;
        ctx.fillStyle = 'rgba(10,20,35,0.9)'; ctx.fillRect(zx, zy, zW, zH);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.strokeRect(zx, zy, zW, zH);
        const [aLabel, bLabel] = activeZone;
        const ai = LABELS.indexOf(aLabel as string), bi = LABELS.indexOf(bLabel as string);
        const bands = latestBandRmsRef.current || [];
        const targets = [[8,12],[12,15],[4,7],[15,20]];
        const ordered = [[0.5,4],[4,7],[8,12],[12,15],[15,20],[20,30],[30,45]];
        function drawBar(label, chIdx, target) {
          if (chIdx<0) return; const bi = ordered.findIndex(([lo,hi])=>lo===target[0]&&hi===target[1]); if (bi<0) return;
          const val = Math.min(1, (bands[bi]?.[chIdx]||0) / 50);
          const bx = zx + 10 + (label==='A'?0: (zW/2)); const by = zy + 18; const bw = (zW/2) - 20; const bh = zH - 28;
          ctx.fillStyle = 'rgba(56,189,248,0.2)'; ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = 'rgba(56,189,248,0.9)'; ctx.fillRect(bx, by + bh*(1-val), bw, bh*val);
        }
        drawBar('A', ai, [8,12]); drawBar('B', bi, [8,12]);
        ctx.fillStyle = 'rgba(200,220,255,0.8)'; ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'; ctx.fillText(`${aLabel}  ${bLabel}`, zx+10, zy+6);
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    return () => {};
  }, [buf]);

  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    function resize() { const rect = cvs.getBoundingClientRect(); cvs.width = Math.max(600, rect.width|0); cvs.height = Math.max(300, rect.height|0); }
    resize(); const ro = new ResizeObserver(resize); ro.observe(cvs); return () => { try { ro.disconnect(); } catch {} };
  }, []);

  return (
    <div className="rounded-md border overflow-hidden" style={{ background:'#0b1220', height: 360 }}>
      <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
    </div>
  );
}


