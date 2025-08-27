"use client";
import { useEffect, useMemo, useState } from 'react';
import { firebaseClient } from '@/lib/firebaseClient';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import DevicePanel from '@/app/mapping/components/DevicePanel';
import ImpedancePanel from '@/app/mapping/components/ImpedancePanel';
import RecordingConsole from '@/app/mapping/components/RecordingConsole';
import Oscilloscope from '@/app/mapping/components/Oscilloscope';
import ReviewSave from '@/app/mapping/components/ReviewSave';
import RecordMap from '@/app/mapping/components/RecordMap';
import StatusBadge from '@/app/mapping/components/StatusBadge';
import SessionLogPanel from '@/app/mapping/components/SessionLogPanel';
import { CONFIG } from '@/app/mapping/config';
import { LABELS } from '@/app/mapping/config/labels';
import { ZONES } from '@/app/mapping/config/labels';

firebaseClient();

export default function MapPage({ params }: { params: { patientId: string; sessionId: string } }) {
  const { patientId, sessionId } = params;
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [scopeUv, setScopeUv] = useState<number>(70);
  const [notchHz, setNotchHz] = useState<number>(CONFIG.notchHz);
  const [zone, setZone] = useState<null | readonly [string,string]>(null);
  const [frontalAlt, setFrontalAlt] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUserEmail(u?.email ?? null));
    return () => { try { unsub(); } catch {} };
  }, []);

  const targetBand = useMemo(() => {
    if (!zone) return null;
    const key = Object.entries(ZONES).find(([,p])=>p[0]===zone[0] && p[1]===zone[1])?.[0] || '';
    if (key==='C3/C4') return [12,15] as const;
    if (key==='O1/O2' || key==='P3/P4') return [8,12] as const;
    if (key==='F3/F4' || key==='Fz/Cz') return (frontalAlt ? [15,20] : [4,7]) as const;
    if (key==='T3/T4') return [4,7] as const;
    return null;
  }, [zone, frontalAlt]);

  return (
    <main className="p-6 space-y-6">
      <StatusBadge />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Brain Mapping</h1>
        <div className="text-sm text-muted-foreground">{userEmail ? `Signed in as ${userEmail}` : 'Not signed in'}</div>
      </div>

      <section className="grid gap-6" style={{ gridTemplateColumns: '3fr 1fr' }}>
        <div className="space-y-3">
          <DevicePanel notch={notchHz} onNotchChange={setNotchHz} scopeUv={scopeUv} onScopeUvChange={setScopeUv} />
          <div className="flex items-center gap-2 text-sm">
            <div>Zones</div>
            <Button size="sm" variant={!zone?'default':'outline'} onClick={()=>setZone(null)}>All</Button>
            {Object.entries(ZONES).map(([k, pair]) => (
              <Button key={k} size="sm" variant={zone && zone[0]===pair[0] && zone[1]===pair[1] ? 'default':'outline'} onClick={()=>setZone(pair)}>{k}</Button>
            ))}
            <div className="ml-4">Frontal target</div>
            <Button size="sm" variant={!frontalAlt?'default':'outline'} onClick={()=>setFrontalAlt(false)}>4–7 Hz</Button>
            <Button size="sm" variant={frontalAlt?'default':'outline'} onClick={()=>setFrontalAlt(true)}>15–20 Hz</Button>
            <div className="ml-4">Impedance</div>
          </div>
          <Oscilloscope labels={LABELS as unknown as string[]} fullScaleUv={scopeUv} impedanceMode={false} zone={zone} targetBand={targetBand} />
          <RecordingConsole notchHz={notchHz} />
          <div className="mt-2">
            <RecordMap activeZone={zone} />
          </div>
        </div>
        <div className="space-y-3">
          <ImpedancePanel />
          <ReviewSave />
          <SessionLogPanel />
        </div>
      </section>
    </main>
  );
}


