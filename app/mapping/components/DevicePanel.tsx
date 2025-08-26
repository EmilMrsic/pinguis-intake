"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import * as Dev from '../services/DeviceService';
import { CONFIG } from '../config';

export default function DevicePanel() {
  const [info, setInfo] = useState<{model?:string; serial?:string; sampleRate:number}|null>(null);
  const [connected, setConnected] = useState(false);
  const [notch, setNotch] = useState(CONFIG.notchHz);
  const [scale, setScale] = useState(1);

  async function onConnect() {
    const rv = await Dev.connect();
    setInfo(rv); setConnected(true);
  }
  async function onDisconnect() { await Dev.disconnect(); setConnected(false); setInfo(null); }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {!connected ? <Button onClick={onConnect}>Connect</Button> : <Button variant="outline" onClick={onDisconnect}>Disconnect</Button>}
        {info && <span className="text-sm text-muted-foreground">{info.model} • {info.serial} • {info.sampleRate} Hz</span>}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div>Scale ±</div>
        <Button size="sm" variant="outline" onClick={()=>setScale(s=>Math.max(0.5, s-0.5))}>-</Button>
        <span>{scale.toFixed(1)}×</span>
        <Button size="sm" variant="outline" onClick={()=>setScale(s=>s+0.5)}>+</Button>
        <div className="ml-4">Notch</div>
        <Button size="sm" variant={notch===50?'default':'outline'} onClick={()=>setNotch(50)}>50 Hz</Button>
        <Button size="sm" variant={notch===60?'default':'outline'} onClick={()=>setNotch(60)}>60 Hz</Button>
      </div>
    </div>
  );
}


