"use client";
import * as React from 'react';

type SelectCardProps = {
  selected: boolean;
  title: string;
  subtitle?: string;
  onSelect: () => void;
  role?: 'radio' | 'button';
  ariaLabel?: string;
  className?: string;
  children?: React.ReactNode;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
};

export function SelectCard({
  selected,
  title,
  subtitle,
  onSelect,
  role = 'radio',
  ariaLabel,
  className,
  children,
  onKeyDown,
}: SelectCardProps) {
  const ariaProps =
    role === 'radio'
      ? { 'aria-checked': selected }
      : { 'aria-pressed': selected };

  return (
    <button
      type="button"
      role={role}
      {...ariaProps}
      aria-label={ariaLabel || title}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={[
        'relative sel-card w-full text-left rounded-xl border p-5 bg-transparent transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        selected
          ? 'is-selected border-primary/60 shadow-[0_8px_24px_rgba(35,50,110,0.22)]'
          : 'hover:bg-accent hover:translate-y-[1px]',
        className || '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {children}
        <div className="min-w-0">
          <div className="text-lg font-semibold">{title}</div>
          {subtitle && (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
      {role === 'button' && (
        <div className="absolute right-4 top-4 h-5 w-5 rounded-md border grid place-items-center text-[10px] select-none pointer-events-none">
          {selected ? '✓' : ''}
        </div>
      )}
    </button>
  );
}

export default SelectCard;


