const NICE_STEPS = [4,6,8,10,15,20,30,40,60,80,100] as const;

export function niceGridSpan(fullScaleUv: number): number {
  const target = 0.9 * Math.max(1, fullScaleUv);
  let best = NICE_STEPS[0];
  for (const v of NICE_STEPS) {
    if (v <= target) best = v;
  }
  return best;
}

// Maps a microvolt value to pixel offset from the midline, clamped to ±FS.
// Positive yUv returns a positive offset upwards when used as (midY - offset).
export function yToPx(yUv: number, fullScaleUv: number, heightPx: number): number {
  const fs = Math.max(1e-6, fullScaleUv);
  const clamped = Math.max(-fs, Math.min(fs, yUv));
  const halfH = heightPx / 2;
  const scale = halfH / fs; // ±FS maps to ±halfH
  return clamped * scale;
}


