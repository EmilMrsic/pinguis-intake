"use client";
import { ReactNode } from 'react';

type Props = {
  top: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right?: ReactNode;
};

export default function EEGAppShell({ top, left, center, right }: Props) {
  return (
    <div className="grid h-screen" style={{ gridTemplateRows: '56px 1fr', gridTemplateColumns: right ? '300px 1fr 320px' : '300px 1fr' }}>
      <header className="col-span-2 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="h-[56px] flex items-center px-4">{top}</div>
      </header>
      <aside className="border-r overflow-y-auto" style={{ width: 300 }}>
        <div className="p-3">{left}</div>
      </aside>
      <main className="min-w-0 overflow-auto">
        <div className="p-3">{center}</div>
      </main>
      {right && (
        <aside className="border-l overflow-y-auto" style={{ width: 320 }}>
          <div className="p-3">{right}</div>
        </aside>
      )}
    </div>
  );
}


