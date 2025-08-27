"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { onSamples, connect } from '../services/DeviceService';
import { detectArtifacts } from '../services/ArtifactService';
import { CONFIG } from '../config';
import { LABELS } from '../config/labels';
import { startTelemetry, ingestTelemetry, stopTelemetry } from '../services/Telemetry';
import { emitBandRms, emitArtifacts, emitRecording, emitBaselineSec } from '../services/SignalBus';
import { createEdfPlusBlob } from '../utils/edfPlus';

type Props = { notchHz?: number; fs?: number };
export default function RecordingConsole({ notchHz, fs }: Props) {
  const [condition, setCondition] = useState<'EC'|'EO'>('EC');
  const [cleanSec, setCleanSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const unsubRef = useRef<null|(()=>void)>(null);
  const workerRef = useRef<Worker | null>(null);
  const rawBufRef = useRef<number[][]>([]); // [ch][samples]
  const annRef = useRef<{ onsetSec:number; durSec?:number; text:string }[]>([]);

  useEffect(() => () => { try { unsubRef.current?.(); } catch {} }, []);

  async function start() {
    try { await connect(); } catch {}
    setRunning(true); setCleanSec(0);
    startTelemetry(fs || CONFIG.samplingRateHz, LABELS as unknown as string[]);
    annRef.current = [{ onsetSec: 0, text: 'Start' }];
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/filterWorker.js', import.meta.url), { type:'module' });
    }
    workerRef.current.postMessage({ type:'config', cfg:{ sampleRate: fs || CONFIG.samplingRateHz, channels: 1, hpHz: CONFIG.bandpassHz[0], lpHz: CONFIG.bandpassHz[1], notchHz: notchHz || null, notchQ: 30 } });
    unsubRef.current = onSamples((frame) => {
      const chans = frame.chans;
      // accumulate RAW
      if (rawBufRef.current.length < chans.length) rawBufRef.current = Array.from({length: chans.length}, (_,i)=> rawBufRef.current[i] || []);
      for (let i=0;i<chans.length;i++) rawBufRef.current[i].push(chans[i] || 0);
      workerRef.current?.postMessage({ type:'frame', samples: [chans] });
      // handle worker response lazily (listener install once)
      if (workerRef.current) {
        workerRef.current.onmessage = (e) => {
          const msg = e.data || {};
          if (msg.type === 'filtered') {
            const filtered = msg.out || [];
            const bandRms = msg.bandRms || [];
            emitBandRms(bandRms);
            const fsUse = fs || CONFIG.samplingRateHz;
            const artifact = detectArtifacts({ filtered, bandRms, fs: fsUse, labels: LABELS as unknown as string[], fullScaleUv: 70 });
            emitArtifacts(artifact);
            const step = 1/(fs || CONFIG.samplingRateHz);
            setCleanSec(s => {
              const next = !artifact.blink && !artifact.emg && !artifact.clip && !artifact.pop
                ? Math.min(CONFIG.baselineSeconds, s + step)
                : Math.max(0, s - 2*step);
              try { emitBaselineSec(next); } catch {}
              return next;
            });
            const tSec = rawBufRef.current[0]?.length ? rawBufRef.current[0].length / fsUse : 0;
            ingestTelemetry(bandRms, tSec);
            const add = (name:string) => annRef.current.push({ onsetSec: tSec, text: name });
            if (artifact.blink) add('BLINK');
            if (artifact.emg) add('EMG');
            if (artifact.clip) add('CLIP');
            if (artifact.pop) add('POP');
          }
        };
      }
    });
  }
  function stop() {
    setRunning(false); setRecording(false);
    try { unsubRef.current?.(); } catch {}
    // write EDF+
    try {
      const fsUse = fs || CONFIG.samplingRateHz;
      const fileName = 'session.edf';
      const blob = createEdfPlusBlob({ labels: LABELS as unknown as string[], fs: fsUse, data: rawBufRef.current, patient: 'Client', recording: 'Brain Map', montage: '19', reference: 'LE', annotations: [...annRef.current, { onsetSec: (rawBufRef.current[0]?.length||0)/fsUse, text: 'Stop' }] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 2000);
      stopTelemetry(fileName);
    } catch {}
    rawBufRef.current = [];
    annRef.current = [];
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant={condition==='EC'?'default':'outline'} size="sm" onClick={()=>setCondition('EC')}>Eyes Closed</Button>
        <Button variant={condition==='EO'?'default':'outline'} size="sm" onClick={()=>setCondition('EO')}>Eyes Open</Button>
      </div>
      <div className="text-sm">{!recording ? (
        <>Clean seconds: <span className="tabular-nums">{cleanSec.toFixed(1)}</span> / {CONFIG.baselineSeconds}s</>
      ) : (
        <span className="text-green-600">Recording…</span>
      )}</div>
      <div className="flex items-center gap-2">
        {!running ? (
          <Button onClick={start}>Start</Button>
        ) : (
          <>
            {!recording && (
              <Button disabled={cleanSec < CONFIG.baselineSeconds} onClick={()=>{ setRecording(true); emitRecording(true); }}>Record</Button>
            )}
            <Button variant="outline" onClick={stop}>{recording?'Stop Recording':'Stop'}</Button>
          </>
        )}
      </div>
    </div>
  );
}


