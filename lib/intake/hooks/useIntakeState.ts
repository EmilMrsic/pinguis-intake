import { useCallback, useRef, useState } from 'react';
import { setByPath } from '../../intake/paths';
import { generateIntakeIdFrom } from '../../intake/id';
import { saveIntake } from '../../intake/intakeApi';

export function useIntakeState(initial: Record<string, any> = {}, ctx: { practiceId: string; clientId: string }) {
  const [payload, setPayload] = useState<Record<string, any>>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>('');
  const timer = useRef<NodeJS.Timeout | null>(null);

  const autosave = useCallback((next: Record<string, any>, opts?: { silent?: boolean; immediate?: boolean }) => {
    const doSave = async (snapshotIn: Record<string, any>) => {
      const snapshot = { ...(snapshotIn as any) } as any;
      if (!snapshot.intakeId) snapshot.intakeId = generateIntakeIdFrom(snapshot);
      setSaving(true);
      try {
        await saveIntake({ practiceId: ctx.practiceId, clientId: ctx.clientId, intakeId: snapshot?.intakeId, payload: snapshot });
        if (!opts?.silent) { setToast('Saved ✓'); setTimeout(()=>setToast(''), 1200); }
      } finally { setSaving(false); }
    };
    if (opts?.immediate) { if (timer.current) clearTimeout(timer.current); void doSave(next); return; }
    if (timer.current) clearTimeout(timer.current);
    const snapshot = { ...next } as any;
    timer.current = setTimeout(() => { void doSave(snapshot); }, 900);
  }, [ctx.clientId, ctx.practiceId]);

  const updateField = useCallback((path: string, value: any) => {
    const next = structuredClone(payload); setByPath(next, path, value); setPayload(next); autosave(next);
  }, [autosave, payload]);

  return { payload, setPayload, saving, toast, autosave, updateField };
}


