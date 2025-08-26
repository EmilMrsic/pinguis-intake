"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { onSamples } from '../services/DeviceService';
import { detectArtifacts } from '../services/ArtifactService';
import { CONFIG } from '../config';

export default function RecordingConsole() {
  const [condition, setCondition] = useState<'EC'|'EO'>('EC');
  const [cleanSec, setCleanSec] = useState(0);
  const [running, setRunning] = useState(false);
  const unsubRef = useRef<null|(()=>void)>(null);

  useEffect(() => () => { try { unsubRef.current?.(); } catch {} }, []);

  function start() {
    setRunning(true); setCleanSec(0);
    unsubRef.current = onSamples((_t, chans) => {
      const artifact = detectArtifacts([chans]);
      if (!artifact.blink && !artifact.emg && !artifact.clip) setCleanSec(s=>Math.min(CONFIG.baselineSeconds, s + 1/CONFIG.samplingRateHz));
      if (cleanSec >= CONFIG.baselineSeconds) { stop(); }
    });
  }
  function stop() { setRunning(false); try { unsubRef.current?.(); } catch {} }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant={condition==='EC'?'default':'outline'} size="sm" onClick={()=>setCondition('EC')}>Eyes Closed</Button>
        <Button variant={condition==='EO'?'default':'outline'} size="sm" onClick={()=>setCondition('EO')}>Eyes Open</Button>
      </div>
      <div className="text-sm">Clean seconds: <span className="tabular-nums">{cleanSec.toFixed(1)}</span> / {CONFIG.baselineSeconds}s</div>
      {!running ? <Button onClick={start}>Start</Button> : <Button variant="outline" onClick={stop}>Stop</Button>}
    </div>
  );
}


