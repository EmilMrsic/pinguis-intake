import { useCallback, useState, startTransition } from 'react';

export function useAiHints(intakeId: string, disabled = true) {
  const [aiCopyMap, setAiCopyMap] = useState<Record<string, any>>({});
  const [aiChipsMap, setAiChipsMap] = useState<Record<string, string[]>>({});
  const aiTurn = useCallback(async (screenId: string, event: string, extra?: any) => {
    if (disabled) return;
    try {
      const key = extra?.topicId ? `${screenId}:${extra.topicId}` : screenId;
      const res = await fetch('/api/model-hook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intakeId, screenId, event, context: extra||{} }) });
      if (!res.ok) return;
      const data = await res.json().catch(()=>({}));
      startTransition(() => {
        if (data?.suggested_copy) setAiCopyMap((m)=>({ ...m, [key]: data.suggested_copy }));
        if (Array.isArray(data?.suggested_chips)) setAiChipsMap((m)=>({ ...m, [key]: data.suggested_chips }));
      });
    } catch {}
  }, [disabled, intakeId]);
  return { aiCopyMap, aiChipsMap, aiTurn } as const;
}


