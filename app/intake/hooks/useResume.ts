"use client";
import { useCallback } from 'react';

export function useResume(steps: { id:string }[], jumpToNextRelevantIndex: (ctx:any)=>number) {
  const jumpToNextRelevant = useCallback((ctx:any) => {
    try { return Math.max(0, Math.min(steps.length - 1, jumpToNextRelevantIndex(ctx))); } catch { return 0; }
  }, [steps, jumpToNextRelevantIndex]);

  return { jumpToNextRelevant } as const;
}


