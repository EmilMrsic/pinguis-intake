"use client";
import { useEffect, useState } from 'react';
import { getLastSessionLog } from '../services/Telemetry';

export default function SessionLogPanel() {
  const [log, setLog] = useState<any>(null);
  useEffect(() => { setLog(getLastSessionLog()); }, []);
  if (!log) return null;
  return (
    <div className="rounded border p-3 text-sm">
      <div className="font-medium mb-1">Session Log</div>
      <div className="text-xs text-muted-foreground mb-2">{log.filename} • Fs {log.fs} • {log.labels.length} ch • {log.startedAt} → {log.stoppedAt}</div>
      <div className="space-y-2">
        {log.minutes.map((m:any) => (
          <div key={m.minute} className="border rounded p-2">
            <div className="text-xs font-medium">Minute {m.minute}</div>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {log.labels.map((lb:string, i:number) => (
                <div key={lb} className="text-xs">{lb}: {m.artifactPctByChannel[i]?.toFixed(1)}%</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


