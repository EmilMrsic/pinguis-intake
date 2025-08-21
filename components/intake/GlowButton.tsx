import React from 'react';
import { Button } from '@/components/ui/button';

export function GlowButton({
  children,
  onClick,
  disabled,
  variant = 'default' as const,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'default'|'outline'|'secondary'|'ghost'|'link'|'destructive' }) {
  return (
    <div className="relative inline-flex">
      <div className="pointer-events-none absolute -inset-0.5 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 opacity-40 blur-sm" />
      <Button variant={variant} onClick={onClick} disabled={disabled} className="relative">{children}</Button>
    </div>
  );
}


