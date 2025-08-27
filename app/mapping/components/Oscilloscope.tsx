"use client";
import { useEffect, useRef, useState } from 'react';
import { onSamples } from '../services/DeviceService';
import { LABELS } from '../config/labels';
import { niceGridSpan, yToPx } from './scopeScale';
import { onBandRms, onRxInfo } from '../services/SignalBus';
import { getImpedance } from '../services/DeviceService';

type OscProps = { channels?: number; seconds?: number; samplingRate?: number; labels?: string[]; fullScaleUv?: number; gridSpanUv?: number; zone?: readonly [string,string] | null; targetBand?: readonly [number, number] | null; impedanceMode?: boolean; rawMode?: boolean; notchHz?: number };

export default function Oscilloscope({ channels = 4, seconds = 5, samplingRate = 256, labels = LABELS as unknown as string[], fullScaleUv = 70, gridSpanUv, zone = null, targetBand = null, impedanceMode = false, rawMode = false, notchHz = 0 }: OscProps) {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const unsubRef = useRef<null | (()=>void)>(null);
  const rafRef = useRef<number| null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [buf, setBuf] = useState<number[][]>(() => Array.from({length: channels}, () => Array(seconds*samplingRate).fill(0)));
  const writeIdxRef = useRef<number>(0);
  const chCountRef = useRef<number>(channels);
  const [labelList, setLabelList] = useState<string[]>(labels);
  const latestBandRmsRef = useRef<number[][]>([]);
  useEffect(() => onBandRms(r => { latestBandRmsRef.current = r; }), []);
  useEffect(() => onRxInfo((i) => {
    // Only map labels to provided list or slice of 10-20 if channel count smaller
    const next = Array.isArray(i.labels) && i.labels.length === i.channels ? i.labels : (LABELS as unknown as string[]).slice(0, Math.max(1, i.channels));
    setLabelList(next);
  }), []);
  const [impVals, setImpVals] = useState<Record<string, number>|null>(null);
  const [impMode, setImpMode] = useState<'impedance'|'quality'|null>(null);
  useEffect(() => {
    let timer: any; let mounted = true;
    async function poll() {
      try {
        const v = await getImpedance();
        if (!mounted) return; setImpVals(v); setImpMode('impedance');
      } catch {
        // Fallback quality proxy from bandRms (alpha vs hi-beta)
        const bands = latestBandRmsRef.current || [];
        const idxAlpha = 2, idxHi = 6; const out: Record<string, number> = {};
        for (let i=0;i<labels.length;i++) {
          const a = bands[idxAlpha]?.[i] || 0; const hb = bands[idxHi]?.[i] || 0;
          const q = 100*Math.max(0, Math.min(1, a/(a+hb+1e-6)));
          out[labels[i]] = Math.round(q);
        }
        if (!mounted) return; setImpVals(out); setImpMode('quality');
      }
      timer = setTimeout(poll, 1200);
    }
    if (impedanceMode) poll();
    return () => { mounted = false; try { clearTimeout(timer); } catch {} };
  }, [impedanceMode, labels]);

  // Subscribe samples
  useEffect(() => {
    unsubRef.current?.();
    // ensure worker for filtered mode
    if (!rawMode) {
      if (!workerRef.current) workerRef.current = new Worker(new URL('../workers/filterWorker.js', import.meta.url), { type:'module' });
    }
    unsubRef.current = onSamples((frame) => {
      const chans = frame.chans;
      const cc = chans.length;
      chCountRef.current = cc;
      if (rawMode) {
        setBuf(prev => {
          const need = cc - prev.length;
          const next = need>0 ? [...prev, ...Array.from({length: need}, ()=>Array(seconds*samplingRate).fill(0))] : prev;
          const idx = writeIdxRef.current % (seconds*samplingRate);
          for (let i=0;i<cc;i++) next[i][idx] = chans[i] ?? 0;
          writeIdxRef.current = (writeIdxRef.current + 1) % (seconds*samplingRate);
          return next;
        });
      } else {
        // filtered via worker
        if (workerRef.current) {
          workerRef.current.postMessage({ type:'config', cfg:{ sampleRate: samplingRate, channels: cc, hpHz: 0.5, lpHz: 45, notchHz: notchHz || null, notchQ: 30 } });
          const samples = Array.from({length: cc}, (_,i)=> [chans[i]||0]);
          workerRef.current.onmessage = (e: MessageEvent) => {
            const msg = e.data || {};
            if (msg.type === 'filtered') {
              const out: number[][] = msg.out || [];
              const filtered = out.map((arr: number[]) => arr[0] || 0);
              setBuf(prev => {
                const need = cc - prev.length;
                const next = need>0 ? [...prev, ...Array.from({length: need}, ()=>Array(seconds*samplingRate).fill(0))] : prev;
                const idx = writeIdxRef.current % (seconds*samplingRate);
                for (let i=0;i<cc;i++) next[i][idx] = filtered[i] ?? 0;
                writeIdxRef.current = (writeIdxRef.current + 1) % (seconds*samplingRate);
                return next;
              });
            }
          };
          workerRef.current.postMessage({ type:'frame', samples });
        }
      }
    });
    return () => { try { unsubRef.current?.(); } catch {} };
  }, [seconds, samplingRate, rawMode, notchHz]);

  // Draw loop
  useEffect(() => {
    function draw() {
      const cvs = canvasRef.current; if (!cvs) { rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = cvs.getContext('2d'); if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }
      const w = cvs.width, h = cvs.height;
      ctx.clearRect(0,0,w,h);
      // dark bg
      ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,w,h);
      const leftPad = 70; // space for channel labels
      // vertical grid (time) remains fixed spacing
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      for (let x=leftPad;x<w;x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      const cc = chCountRef.current;
      const rows = zone ? 2 : (labelList.length > 0 ? labelList.length : cc);
      const rowH = h / rows;
      const N = seconds*samplingRate;
      const span = gridSpanUv || niceGridSpan(fullScaleUv);
      const chIndices = zone ? [labelList.indexOf(zone[0] as string), labelList.indexOf(zone[1] as string)].filter(i=>i>=0) : [...Array(cc).keys()];
      for (let ri=0; ri<chIndices.length; ri++) {
        const ch = chIndices[ri];
        const trace = buf[Math.min(ch, buf.length-1)] || [];
        const rowIndex = ri;
        const midY = rowH*rowIndex + rowH/2;
        // uv-based grid ticks per row at ±span
        const yOff = yToPx(span, fullScaleUv, rowH);
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, midY - yOff); ctx.lineTo(w, midY - yOff); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, midY + yOff); ctx.lineTo(w, midY + yOff); ctx.stroke();
        // center line
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();
        // left labels
        ctx.fillStyle = 'rgba(200,220,255,0.8)';
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const label = labelList[ch] || `CH${ch+1}`;
        ctx.fillText(label, 8, midY);
        if (impedanceMode && impVals) {
          const v = impVals[label];
          if (v != null) {
            if (impMode==='impedance') {
              const color = v<5 ? '#22c55e' : (v<=10 ? '#f59e0b' : '#ef4444');
              ctx.fillStyle = color;
              ctx.fillText(`${v} kΩ`, 70, midY);
            } else if (impMode==='quality') {
              const q = v;
              const color = q>=80 ? '#22c55e' : (q>=60 ? '#f59e0b' : '#ef4444');
              ctx.fillStyle = color; ctx.fillText(`${q}%`, 70, midY);
            }
          }
        }
        // glow
        ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(80,160,255,0.6)';
        ctx.strokeStyle = 'rgba(80,160,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath();
        let clipped = false;
        for (let i=0;i<N;i++) {
          const xi = leftPad + (i / (N-1)) * (w-leftPad);
          const v = trace[(writeIdxRef.current + i) % N] || 0;
          if (Math.abs(v) > fullScaleUv) clipped = true;
          const y = midY - yToPx(v, fullScaleUv, rowH);
          if (i===0) ctx.moveTo(xi, y); else ctx.lineTo(xi, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        // band target overlay bar (right side)
        if (targetBand) {
          const bands = latestBandRmsRef.current || [];
          const ordered = [[0.5,4],[4,7],[8,12],[12,15],[15,20],[20,30],[30,45]];
          const bi = ordered.findIndex(([a,b])=>Math.abs(a-targetBand[0])<1e-6 && Math.abs(b-targetBand[1])<1e-6);
          if (bi>=0 && bands[bi]) {
            const val = Math.min(1, (bands[bi][ch] || 0) / 50);
            const barW = 6; const barH = Math.max(2, Math.floor(val * (rowH-8)));
            const bx = w - 16; const by = midY + (rowH/2) - barH - 4;
            ctx.fillStyle = 'rgba(56,189,248,0.9)';
            ctx.fillRect(bx, by, barW, barH);
          }
        }
        if (clipped) {
          // draw a small clip badge on the right side of the row
          const badgeW = 34, badgeH = 16;
          const bx = w - badgeW - 8;
          const by = midY - badgeH/2;
          ctx.fillStyle = 'rgba(239,68,68,0.9)';
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const r = 4; // rounded corners
          ctx.moveTo(bx + r, by);
          ctx.lineTo(bx + badgeW - r, by);
          ctx.quadraticCurveTo(bx + badgeW, by, bx + badgeW, by + r);
          ctx.lineTo(bx + badgeW, by + badgeH - r);
          ctx.quadraticCurveTo(bx + badgeW, by + badgeH, bx + badgeW - r, by + badgeH);
          ctx.lineTo(bx + r, by + badgeH);
          ctx.quadraticCurveTo(bx, by + badgeH, bx, by + badgeH - r);
          ctx.lineTo(bx, by + r);
          ctx.quadraticCurveTo(bx, by, bx + r, by);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'white';
          ctx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('CLIP', bx + badgeW/2, midY);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [buf, seconds, samplingRate, fullScaleUv, gridSpanUv, zone, targetBand]);

  // Resize canvas to container
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    function resize() {
      const rect = cvs.getBoundingClientRect();
      cvs.width = Math.max(600, Math.floor(rect.width));
      cvs.height = Math.max(240, Math.floor(rect.height));
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cvs);
    return () => { try { ro.disconnect(); } catch {} };
  }, []);

  return (
    <div className="rounded-md border overflow-hidden" style={{ background:'#0b1220', height: 360 }}>
      <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
    </div>
  );
}


