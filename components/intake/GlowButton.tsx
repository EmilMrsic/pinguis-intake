import React from 'react';
import { Button } from '@/components/ui/button';

export function GlowButton({
  children,
  onClick,
  disabled,
  variant = 'default' as const,
  tone = 'primary' as const,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'default'|'outline'|'secondary'|'ghost'|'link'|'destructive'; tone?: 'primary'|'soft' }) {
  return (
    <div className="relative inline-flex">
      <div className={[
        'pointer-events-none absolute -inset-0.5 rounded-md opacity-40 blur-sm',
        tone==='soft' ? 'bg-gradient-to-r from-sky-300 to-blue-400' : 'bg-gradient-to-r from-sky-500 to-blue-600'
      ].join(' ')} />
      <Button variant={variant} onClick={onClick} disabled={disabled} className={[ 'relative', tone==='soft' ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100' : '' ].join(' ')}>{children}</Button>
    </div>
  );
}


