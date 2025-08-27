"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { startSynthetic } from '../services/DeviceService';
import { LABELS } from '../config/labels';
import DevicePanel from '../components/DevicePanel';
import Oscilloscope from '../components/Oscilloscope';
import RecordingConsole from '../components/RecordingConsole';

const FS = 256;

function makeHarnessGen() {
  const idx = (name:string) => LABELS.indexOf(name as any);
  const chs = LABELS.length;
  // targets
  const O1 = idx('O1'), O2 = idx('O2');
  const C3 = idx('C3'), C4 = idx('C4');
  const Fp1 = idx('Fp1'), Fp2 = idx('Fp2');
  const T3 = idx('T3'), T4 = idx('T4');
  const mainsHz = 60;
  return (t:number) => {
    const out = new Array(chs).fill(0);
    // 10 Hz @ 20 uV on O1/O2
    const s10 = Math.sin(2*Math.PI*10*t) * 20;
    if (O1>=0) out[O1] += s10; if (O2>=0) out[O2] += s10;
    // 14 Hz @ 15 uV on C3/C4
    const s14 = Math.sin(2*Math.PI*14*t) * 15;
    if (C3>=0) out[C3] += s14; if (C4>=0) out[C4] += s14;
    // Blink bursts on Fp1/Fp2: slow transient every ~3s
    const blinkEnv = Math.max(0, 1 - Math.abs((t%3)-1.5)/0.3);
    const blink = Math.sin(2*Math.PI*1*t) * 60 * blinkEnv;
    if (Fp1>=0) out[Fp1] += blink; if (Fp2>=0) out[Fp2] += blink;
    // EMG noise 30–45 Hz on temporal
    function rand(seed:number){ const x = Math.sin(seed*9999)*10000; return x - Math.floor(x); }
    const emg = (Math.sin(2*Math.PI*33*t)+Math.sin(2*Math.PI*41*t)+Math.sin(2*Math.PI*37.5*t))*3;
    if (T3>=0) out[T3] += emg; if (T4>=0) out[T4] += emg;
    // Mains hum 60 Hz small
    const hum = Math.sin(2*Math.PI*mainsHz*t) * 12;
    for (let i=0;i<chs;i++) out[i] += hum*0.2;
    return out;
  };
}

export default function Harness() {
  const [running, setRunning] = useState(false);
  const [notch, setNotch] = useState<50|60>(60);
  const [scopeUv, setScopeUv] = useState(70);
  function start() { startSynthetic(makeHarnessGen(), FS); setRunning(true); }
  function stop() { setRunning(false); }
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">QA Harness</h1>
      <div className="flex items-center gap-2">
        {!running ? <Button onClick={start}>Start Synthetic</Button> : <Button variant="outline" onClick={stop}>Stop</Button>}
      </div>
      <DevicePanel notch={notch} onNotchChange={setNotch} scopeUv={scopeUv} onScopeUvChange={setScopeUv} />
      <Oscilloscope labels={LABELS as unknown as string[]} fullScaleUv={scopeUv} />
      <RecordingConsole notchHz={notch} />
    </main>
  );
}


