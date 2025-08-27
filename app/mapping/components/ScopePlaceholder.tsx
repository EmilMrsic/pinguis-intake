"use client";
import { useEffect, useRef } from 'react';

type Mode = 'test'|'record'|'idle';

type Props = {
  mode: Mode;
  activeZone?: readonly [string,string] | null;
  fullScaleUv: number;
  gridSpanUv: number;
  labels: string[];
};

export default function ScopePlaceholder({ mode, activeZone, fullScaleUv, gridSpanUv, labels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const rafRef = useRef<number| null>(null);
  const sweepRef = useRef<number>(0);

  useEffect(() => {
    function draw() {
      const cvs = canvasRef.current; if (!cvs) { rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = cvs.getContext('2d'); if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }
      const w = cvs.width, h = cvs.height;
      ctx.clearRect(0,0,w,h);
      // background
      ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,w,h);

      // layout
      const leftPad = 70;
      const topPad = 8; const bottomPad = 8;
      const usableH = h - topPad - bottomPad;
      const showTest = (mode==='test' && activeZone && activeZone[0] && activeZone[1]);
      const bigAreaH = showTest ? Math.floor(usableH*0.6) : usableH;
      const smallAreaH = showTest ? (usableH - bigAreaH) : 0;

      // helper to draw a lane region with label and grid +/- gridSpanUv
      function drawLane(idx:number, y0:number, y1:number, label:string) {
        const midY = (y0+y1)/2; const laneH = (y1-y0);
        // labels
        ctx.fillStyle = 'rgba(200,220,255,0.85)';
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(label, 8, midY);
        // grid
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
        // vertical grid lines
        for (let x=leftPad; x<w; x+=40) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
        // center line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(leftPad, midY); ctx.lineTo(w, midY); ctx.stroke();
        // +/- gridSpan
        const yOff = (laneH/2) * (gridSpanUv/Math.max(1e-6, fullScaleUv));
        ctx.strokeStyle = 'rgba(80,160,255,0.25)';
        ctx.beginPath(); ctx.moveTo(leftPad, midY - yOff); ctx.lineTo(w, midY - yOff); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(leftPad, midY + yOff); ctx.lineTo(w, midY + yOff); ctx.stroke();

        return { midY, laneH };
      }

      // big lanes or evenly spaced
      if (showTest) {
        const [a,b] = activeZone as [string,string];
        const aIndex = labels.indexOf(a); const bIndex = labels.indexOf(b);
        const bigLaneH = Math.floor(bigAreaH/2);
        const aGeom = drawLane(aIndex, topPad, topPad + bigLaneH, a);
        const bGeom = drawLane(bIndex, topPad + bigLaneH, topPad + bigAreaH, b);

        // Target band overlay (dummy values)
        const barW = 80; const barH = 6; const gap = 4; const pad = 8; const x0 = w - barW - pad;
        const t = (performance.now() % 4000) / 1000; // 0..4s
        function drawOverlay(geom:{midY:number; laneH:number}) {
          const vals = {
            target: 0.5 + 0.5*Math.sin(t*1.7 + geom.midY*0.01),
            n1: 0.5 + 0.5*Math.sin(t*1.2 + geom.midY*0.02 + 1.3),
            n2: 0.5 + 0.5*Math.sin(t*1.5 + geom.midY*0.015 + 2.1),
          };
          const thr = 0.65;
          const startY = geom.midY - (barH*3 + gap*2)/2;
          ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0, startY, barW, barH);
          ctx.fillRect(x0, startY + barH + gap, barW, barH);
          ctx.fillRect(x0, startY + 2*(barH + gap), barW, barH);
          // bars
          ctx.fillStyle = 'rgba(56,189,248,0.9)'; ctx.fillRect(x0, startY, Math.max(2, Math.floor(barW*vals.target)), barH);
          ctx.fillStyle = 'rgba(148,163,184,0.9)'; ctx.fillRect(x0, startY + barH + gap, Math.max(2, Math.floor(barW*vals.n1)), barH);
          ctx.fillRect(x0, startY + 2*(barH + gap), Math.max(2, Math.floor(barW*vals.n2)), barH);
          // PASS pill
          if (vals.target >= thr) {
            const pillW = 38, pillH = 16; const px = x0 - pillW - 6; const py = geom.midY - pillH/2;
            ctx.fillStyle = 'rgba(34,197,94,0.9)'; ctx.fillRect(px, py, pillW, pillH);
            ctx.fillStyle = 'white'; ctx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('PASS', px + pillW/2, py + pillH/2);
          }
        }
        drawOverlay(aGeom);
        drawOverlay(bGeom);
        // Scroll visibility hint: draw a translucent box around focus area
        ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.lineWidth = 2;
        ctx.strokeRect(leftPad, topPad, w-leftPad-8, bigAreaH);

        // All others area (collapsed)
        const othersY0 = topPad + bigAreaH;
        const othersY1 = topPad + bigAreaH + smallAreaH;
        ctx.fillStyle = 'rgba(200,220,255,0.7)';
        ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('All Others', 8, othersY0+4);
        // draw a compressed stack indicator
        const lines = Math.min(6, labels.length-2);
        for (let i=0;i<lines;i++) {
          const y = othersY0 + 18 + i * ((othersY1 - othersY0 - 24) / lines);
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.beginPath(); ctx.moveTo(leftPad, y); ctx.lineTo(w, y); ctx.stroke();
        }
      } else {
        // All channels evenly spaced
        const rows = labels.length; const rowH = usableH/rows;
        for (let i=0;i<rows;i++) {
          const y0 = topPad + i*rowH; const y1 = y0 + rowH;
          drawLane(i, y0, y1, labels[i] || `CH${i+1}`);
        }
      }

      // sweep line
      sweepRef.current = (sweepRef.current + 2) % (w-leftPad);
      ctx.strokeStyle = 'rgba(56,189,248,0.8)';
      ctx.beginPath(); ctx.moveTo(leftPad + sweepRef.current, 0); ctx.lineTo(leftPad + sweepRef.current, h); ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [mode, activeZone, fullScaleUv, gridSpanUv, labels]);

  // Resize canvas to container
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    function resize() {
      const rect = cvs.getBoundingClientRect();
      cvs.width = Math.max(600, Math.floor(rect.width));
      cvs.height = Math.max(300, Math.floor(rect.height));
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cvs);
    return () => { try { ro.disconnect(); } catch {} };
  }, []);

  return (
    <div className="rounded-md border overflow-hidden" style={{ background:'#0b1220', height: 480 }}>
      <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
    </div>
  );
}


