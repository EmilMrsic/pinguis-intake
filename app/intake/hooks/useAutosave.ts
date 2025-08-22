"use client";
import { useCallback, useRef, useState } from 'react';
import { setByPath as setByPathLib } from '@/lib/intake/paths';

const setByPath = setByPathLib;

export function useAutosavePayload(initial: Record<string, any>) {
  const [payload, setPayload] = useState<Record<string, any>>(initial || {});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>('');
  const payloadRef = useRef<Record<string, any>>({});
  payloadRef.current = payload;

  const timer = useRef<NodeJS.Timeout | null>(null);

  function generateIntakeIdFrom(next: any): string {
    const fi = (next?.profile?.first_name || '').trim().charAt(0).toLowerCase() || 'x';
    const li = (next?.profile?.last_name || '').trim().charAt(0).toLowerCase() || 'x';
    const rand = Math.floor(100000 + Math.random()*900000).toString();
    return `${fi}${li}${rand}`;
  }

  const autosave = useCallback((next: Record<string, any>, opts?: { silent?: boolean; immediate?: boolean }) => {
    const doSave = async (snapshotIn: Record<string, any>) => {
      const snapshot = { ...(snapshotIn as any) } as any;
      if (!snapshot.intakeId) {
        snapshot.intakeId = generateIntakeIdFrom(snapshot);
        setPayload((prev) => prev?.intakeId ? prev : ({ ...prev, intakeId: snapshot.intakeId }));
      }
      setSaving(true);
      try {
        const res = await fetch('/api/intake-save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practiceId: '01hpracticeuliddevdevdevdev', clientId: '01hclientuliddevdevdevdevdev', intakeId: snapshot?.intakeId, payload: snapshot })
        });
        if (res.ok && !(opts?.silent)) {
          setToast('Saved ✓');
          setTimeout(()=>setToast(''), 1200);
        }
      } finally { setSaving(false); }
    };

    if (opts?.immediate) {
      if (timer.current) clearTimeout(timer.current);
      void doSave(next);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const snapshot = { ...next } as any;
    timer.current = setTimeout(() => { void doSave(snapshot); }, 900);
  }, []);

  function updateField(path: string, value: any) {
    const next = structuredClone(payload);
    setByPath(next, path, value);
    const section = (path||'').split('.')[0];
    next.changed = { ...(next.changed||{}), [section]: Date.now() };
    setPayload(next);
    autosave(next);
  }

  return { payload, setPayload, saving, toast, autosave, updateField, payloadRef, generateIntakeIdFrom } as const;
}


