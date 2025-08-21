import React, { useCallback, useEffect, useRef, useState } from 'react';

export function TopicNoteField({
  topicId,
  initial,
  chips,
  onSave,
  onComplete,
  debug,
  onLiveChange,
}: { topicId: string; initial: string; chips: string[]; onSave: (text: string) => void; onComplete: (text: string) => void; debug?: boolean; onLiveChange?: (text: string)=>void }) {
  const [text, setText] = useState<string>(initial || '');
  const [showHint, setShowHint] = useState<boolean>(false);
  const liveRows = text.length > 120 || text.includes('\n') ? 3 : 1;
  const debounceRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    setText(initial || '');
    setShowHint(false);
    if ((initial || '').length > 0) {
      try {
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus({ preventScroll: true });
            const len = el.value.length; el.setSelectionRange(len, len);
          }
        });
      } catch {}
    }
  }, [topicId]);

  const scheduleSave = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { onSave(val.trim()); }, 1000);
  }, [onSave]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {chips.map((label, i) => (
          <button
            key={i}
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
            onClick={() => { setText((prev)=> (prev ? (prev + (prev.endsWith('\n')?'':'\n') + label + ' ') : (label + ' '))); setShowHint(true); if (debug) console.log('[Intake] note:chip', { topicId, label, t: Date.now() }); }}
          >{label}</button>
        ))}
      </div>
      <textarea
        className="w-full min-h-[44px] max-h-[120px] resize-none rounded-md border p-3 text-base leading-6"
        rows={liveRows}
        placeholder="A quick line in your own words…"
        value={text}
        autoFocus
        ref={textareaRef}
        onChange={(e)=> { const v=e.target.value; setText(v); onLiveChange && onLiveChange(v); scheduleSave(v); if ((v||'').length > 0) setShowHint(false); if (debug) console.log('[Intake] note:change', { topicId, len: v.length, t: Date.now() }); }}
        onBlur={(e)=> { const t=(e.currentTarget.value||'').trim(); if (debug) console.log('[Intake] note:blur', { topicId, len: t.length, t: Date.now() }); onSave(t); }}
        onFocus={(e)=>{ if (debug) console.log('[Intake] note:focus', { topicId, t: Date.now() }); try { const len=e.currentTarget.value.length; e.currentTarget.setSelectionRange(len,len); } catch {} }}
        onKeyDown={(e)=>{
          if (debug) console.log('[Intake] note:key', { key: e.key, topicId, t: Date.now() });
          e.stopPropagation();
          if (e.key==='Enter' && !e.shiftKey) {
            e.preventDefault();
            const t=(e.currentTarget.value||'').trim();
            if (debug) console.log('[Intake] note:enter', { topicId, len: t.length, t: Date.now() });
            if (t.length>=3) { onComplete(t); } else { onSave(t); }
          }
        }}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        data-lpignore="true" data-1p-ignore="true" data-bwignore="true"
      />
      {showHint && (
        <div className="text-xs text-muted-foreground">Anything else you'd like to share with your provider?</div>
      )}
      <div className="text-[11px] text-muted-foreground">{200 - (text?.length ?? 0)} characters left</div>
    </div>
  );
}


