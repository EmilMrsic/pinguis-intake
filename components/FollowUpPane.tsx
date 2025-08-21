"use client";
import * as React from 'react';

export type FollowUpCopy = {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  questions?: string[];
};

type Props = {
  topicId: string;
  topicLabel: string;
  severity: 1|2|3|4|5;
  value: string;
  onChange: (s: string) => void;
  onDraft?: (s: string) => void;
  chips?: string[];
  copy?: FollowUpCopy;
};

export default function FollowUpPane({ topicId, topicLabel, severity, value, onChange, onDraft, chips = [], copy }: Props) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [revealed] = React.useState(true);
  const [localText, setLocalText] = React.useState<string>(value || '');
  // We intentionally do NOT autosave while typing; we only persist on blur or when parent tells us

  // Autosize textarea
  const autosize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(600, Math.max(140, el.scrollHeight)) + 'px';
  }, []);

  React.useEffect(() => { autosize(); }, [localText, autosize]);

  // Sync incoming value only when topic/severity changes (avoid stomping while typing)
  React.useEffect(() => {
    setLocalText(value || '');
  }, [topicId, severity]);

  // Removed scroll-into-view and auto-focus to avoid any perceived flicker during typing

  if (!(severity >= 1)) return null;

  const fallbackSubtitle = severity === 1
    ? 'What kept it low?'
    : (severity <= 3 ? 'What pushes it up or down?' : `What makes it this high right now?`);

  const titleText = copy?.title || `You chose ${severity} for ${topicLabel}`;
  const subText = copy?.subtitle || fallbackSubtitle;
  const questions = (copy?.questions && copy.questions.length ? copy.questions.slice(0,3) : undefined) ?? [];
  const placeholder = copy?.placeholder || (
    severity >= 4
      ? `In 1–3 sentences: why it’s a ${severity} today, and what would move it closer to a ${Math.max(0, severity-2)}?`
      : severity >= 2
        ? `What pushes it up or down, and what helps—even a little?`
        : `What kept it low, and what you want to keep doing.`
  );

  function insertChipText(t: string) {
    const prefix = t.endsWith(':') ? `${t} ` : `${t}: `;
    const next = localText ? (localText + (localText.endsWith('\n') ? '' : '\n') + prefix) : prefix;
    setLocalText(next);
    onDraft?.(next);
    // return focus to textarea
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <div
      ref={wrapperRef}
      className={[
        'mt-6 rounded-2xl border bg-background/60 p-5 md:p-6 shadow-sm',
        'transition-all duration-150',
        revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        'motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100'
      ].join(' ')}
    >
      <div className="text-xl md:text-2xl font-semibold tracking-tight">{titleText}</div>
      <div className="text-sm text-muted-foreground mt-1">{subText}</div>

      {questions.length > 0 && (
        <ul className="mt-4 space-y-2 text-[15px] list-disc list-inside">
          {questions.slice(0,3).map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {chips.slice(0,6).map((c, i) => (
            <button
              key={i}
              type="button"
              className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
              onClick={() => insertChipText(c)}
            >{c}</button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="mt-4 w-full min-h-[140px] md:min-h-[180px] resize-none rounded-xl border p-4 md:p-5 text-base leading-6 focus-visible:ring-2 focus-visible:ring-primary/40"
        placeholder={placeholder}
        value={localText}
        onChange={(e)=> { setLocalText(e.target.value); onDraft?.(e.target.value); }}
        onBlur={()=> onChange(localText)}
      />

      {(!value && severity >= 4) && (
        <div className="text-xs text-muted-foreground mt-2">Two lines is perfect. Start with “It’s a {severity} because…”.</div>
      )}
    </div>
  );
}


