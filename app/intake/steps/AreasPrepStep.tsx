"use client";
import React from 'react';

export default function AreasPrepStep({ selected, topics }: { selected: string[]; topics: { id: string; label: string }[] }) {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);
  const labelFor = (id: string) => topics.find(t => t.id === id)?.label || id;
  const shown = selected.slice(0, 4);
  return (
    <div className="grid gap-4">
      {loading ? (
        <div className="grid place-items-center py-12">
          <div className="h-10 w-10 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" aria-label="Loading" />
          <div className="mt-3 text-sm text-muted-foreground">Getting things ready…</div>
        </div>
      ) : (
        <div className="py-10 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-2xl sm:text-3xl font-semibold">Let’s get ready to go a bit deeper</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Please answer honestly and clearly. Be detailed enough to be helpful — not too long, not too short.
            </div>
            <div className="mt-6 rounded-2xl border bg-card/60 p-6">
              <div className="text-sm font-medium">We’ll start by looking closer at</div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {shown.map((id) => (
                  <span
                    key={id}
                    className="rounded-full border px-3 py-1 text-sm bg-primary/10 text-primary border-primary/20"
                  >
                    {labelFor(id)}
                  </span>
                ))}
              </div>
              {selected.length > 4 && (
                <div className="mt-2 text-xs text-muted-foreground">We’ll cover the rest shortly.</div>
              )}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">There are a few short chapters ahead.</div>
          </div>
        </div>
      )}
    </div>
  );
}


