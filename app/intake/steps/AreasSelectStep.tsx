import React from 'react';
import SelectCard from '@/components/SelectCard';
import { topics } from '@/lib/intake/topics';

export function AreasSelectStep({ selected, toggle }: { selected: string[]; toggle: (id: string)=>void }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Topics">
        {topics.map((t) => {
          const isSelected = selected.includes(t.id);
          return (
            <SelectCard
              key={t.id}
              role="button"
              ariaLabel={t.label}
              title={t.label}
              subtitle="Select to include this."
              selected={isSelected}
              onSelect={() => toggle(t.id)}
            />
          );
        })}
      </div>
    </div>
  );
}


