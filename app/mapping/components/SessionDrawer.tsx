"use client";
import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  summary: { durationSec: number; channels: number; scaleUv: number; notch: string };
};

export default function SessionDrawer({ open, onClose, summary }: Props) {
  const panelRef = useRef<HTMLDivElement|null>(null);

  // focus trap + esc to close
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    const selectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = el ? Array.from(el.querySelectorAll<HTMLElement>(selectors)) : [];
    const first = focusables[0]; const last = focusables[focusables.length-1];
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        if (focusables.length === 0) { e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const durMin = Math.floor(summary.durationSec/60);
  const durSec = Math.floor(summary.durationSec%60);
  const dur = `${durMin}:${String(durSec).padStart(2,'0')}`;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div ref={panelRef} className="absolute right-0 top-0 h-full w-[420px] bg-white border-l shadow-xl p-4 flex flex-col" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Session Summary</div>
          <button className="border rounded px-2 py-1 text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-slate-600">Duration</span><span className="font-medium tabular-nums">{dur}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-600">Channels</span><span className="font-medium">{summary.channels}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-600">Scale</span><span className="font-medium">{summary.scaleUv} µV</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-600">Notch</span><span className="font-medium">{summary.notch}</span></div>
        </div>
        <div className="mt-auto pt-4 flex items-center justify-end gap-2">
          <button disabled className="border rounded px-3 py-1 text-sm text-slate-400">Save EDF</button>
          <button disabled className="border rounded px-3 py-1 text-sm text-slate-400">Export Log</button>
          <button className="bg-slate-900 text-white rounded px-3 py-1 text-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}


