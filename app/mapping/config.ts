export const CONFIG = {
  baselineSeconds: 30,
  cleanTimeRequired: true,
  artifactMaxRatio: 0.20,
  impedanceThresholdKOhm: 10,
  bandpassHz: [0.5, 45] as const,
  notchHz: 60, // 50 in EU
  samplingRateHz: 256,
  defaultMontage: '12_site',
  intakeMaxAgeDays: 30,
} as const;


