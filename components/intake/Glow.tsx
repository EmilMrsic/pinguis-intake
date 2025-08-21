import React from 'react';

export function Glow({
  children,
  radius = 'rounded-xl',
  from = 'from-sky-500',
  to = 'to-blue-600',
}: { children: React.ReactNode; radius?: string; from?: string; to?: string }) {
  return (
    <div className={`relative ${radius}`}>
      <div className={`pointer-events-none absolute -inset-1 ${radius} bg-gradient-to-r ${from} ${to} opacity-35 blur`} />
      {children}
    </div>
  );
}


