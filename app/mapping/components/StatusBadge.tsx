"use client";
import { useEffect, useRef, useState } from 'react';
import { onArtifacts, onConnection } from '../services/SignalBus';
import { LABELS } from '../config/labels';

type Props = { qualityByLabel?: Record<string, number> | null };

export default function StatusBadge({ qualityByLabel }: Props) {
  const [text, setText] = useState<string>('No Amplifier Connected');
  const hideAtRef = useRef<number>(0);
  useEffect(() => onConnection(c => {
    if (!c.connected) { setText('No Amplifier Connected'); hideAtRef.current = 0; return; }
    if (c.simulation) { setText('Simulation Mode'); hideAtRef.current = performance.now() + 3000; return; }
    // else keep waiting for quality/artifacts
  }), []);
  useEffect(() => onArtifacts(a => {
    if (a.blink || a.emg || a.clip || a.pop) {
      const flags = [a.blink?'Blink':null, a.emg?'EMG':null, a.clip?'Clip':null, a.pop?'Pop':null].filter(Boolean).join(' / ');
      setText(`Artifact Detected: ${flags}`);
      hideAtRef.current = performance.now() + 3000;
    }
  }), []);
  useEffect(() => {
    const id = setInterval(() => {
      if (hideAtRef.current && performance.now() > hideAtRef.current) { hideAtRef.current = 0; setText(''); }
    }, 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (qualityByLabel && Object.keys(qualityByLabel).length) {
      const hasRed = Object.values(qualityByLabel).some((v)=> v<60);
      if (!hasRed) setText('Connections Good');
    }
  }, [qualityByLabel]);
  if (!text) return null;
  return (
    <div className="fixed top-3 left-3 z-50">
      <div className="rounded-md px-3 py-1 text-xs text-white" style={{ background: 'rgba(15,23,42,0.9)', border:'1px solid rgba(255,255,255,0.15)'}}>
        {text}
      </div>
    </div>
  );
}


