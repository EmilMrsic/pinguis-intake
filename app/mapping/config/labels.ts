export const LABELS = [
  "Fp1","Fp2","F7","F3","Fz","F4","F8",
  "T3","C3","Cz","C4","T4",
  "T5","P3","Pz","P4","T6",
  "O1","O2"
] as const;

export const ZONES: Record<string, readonly [string, string]> = {
  "Fz/Cz": ["Fz","Cz"],
  "F3/F4": ["F3","F4"],
  "C3/C4": ["C3","C4"],
  "P3/P4": ["P3","P4"],
  "T3/T4": ["T3","T4"],
  "O1/O2": ["O1","O2"],
} as const;

export function indicesFor(labels: readonly string[], pair: readonly [string,string]): [number, number] {
  const [a,b] = pair;
  return [labels.indexOf(a), labels.indexOf(b)];
}


