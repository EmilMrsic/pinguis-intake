import React from 'react';
import { Button } from '@/components/ui/button';
import { GlowButton } from '@/components/intake/GlowButton';

export function FooterNav({
  onBack,
  onNext,
  backDisabled,
  nextDisabled,
  saving,
  toast,
}: {
  onBack: () => void;
  onNext: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  saving?: boolean;
  toast?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
      <Button variant="outline" onClick={onBack} disabled={!!backDisabled}>Back</Button>
      <GlowButton onClick={onNext} disabled={!!nextDisabled}>Next</GlowButton>
      <div className="sm:ml-auto text-sm text-muted-foreground" aria-live="polite">{saving ? 'Saving…' : toast || 'Saved'}</div>
    </div>
  );
}


