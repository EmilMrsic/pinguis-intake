"use client";
import React from 'react';

export default function MedsIntroStep() {
  return (
    <div className="py-10 sm:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-2xl sm:text-3xl font-semibold">Thank you for sharing those details</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Next, we’re going to look at medications and supplements.
        </div>
        <div className="mt-6 rounded-2xl border bg-card/60 p-6">
          <div className="text-sm text-muted-foreground">This helps your clinician interpret your map and tailor guidance.</div>
        </div>
      </div>
    </div>
  );
}


