import React from 'react';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { GlowButton } from '@/components/intake/GlowButton';

export function StepHeader({
  title,
  description,
  showWelcome,
  firstName,
  onContinue,
}: {
  title: string;
  description?: string;
  showWelcome?: boolean;
  firstName?: string;
  onContinue?: () => void;
}) {
  return (
    <>
      <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
      {showWelcome && (
        <div className="mt-2 text-sm">
          <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2">
            <span>Welcome back{firstName ? `, ${firstName}` : ''}! You can continue your intake.</span>
            <GlowButton onClick={onContinue}>Continue</GlowButton>
          </div>
        </div>
      )}
    </>
  );
}


