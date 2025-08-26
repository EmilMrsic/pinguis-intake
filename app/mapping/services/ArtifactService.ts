export type ArtifactFlags = { blink:boolean; emg:boolean; clip:boolean };

export function detectArtifacts(frame: number[][]): ArtifactFlags {
  // Stub: randomize lightly; real impl will analyze channels
  const r = Math.random();
  return { blink: r < 0.02, emg: r > 0.98, clip: false };
}


