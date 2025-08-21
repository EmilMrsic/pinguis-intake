import { useMemo, useState } from 'react';

export function useDeepDiveQueue(selected: string[], severity: Record<string, number>) {
  const queue = useMemo(() => (selected || []).filter((t) => (severity?.[t] ?? 0) >= 3), [selected, severity]);
  const [ddIndex, setDdIndex] = useState(0);
  return { queue, ddIndex, setDdIndex } as const;
}


