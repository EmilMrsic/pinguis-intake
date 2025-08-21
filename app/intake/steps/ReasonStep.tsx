import React from 'react';
import SelectCard from '@/components/SelectCard';

export function ReasonStep({ reasonChoice, setReasonChoice }: { reasonChoice?: 'problem'|'peak'; setReasonChoice: (v:'problem'|'peak')=>void }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-label="Choose your starting point">
        {[
          { v: 'problem', label: 'Addressing a challenge', emoji: '💡', sub: 'Stress, mood, sleep, focus' },
          { v: 'peak', label: 'Peak performance / optimization', emoji: '🚀', sub: 'Get an edge, optimize' },
        ].map((opt) => {
          const selected = reasonChoice === (opt.v as 'problem'|'peak');
          return (
            <SelectCard
              key={opt.v}
              role="radio"
              ariaLabel={opt.label}
              title={opt.label}
              subtitle={opt.sub}
              selected={selected}
              onSelect={() => setReasonChoice(opt.v as 'problem'|'peak')}
            >
              <div className="text-2xl" aria-hidden>{opt.emoji}</div>
            </SelectCard>
          );
        })}
      </div>
    </div>
  );
}


