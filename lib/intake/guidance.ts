export function getGuidance(topicId: string, sev: number) {
  const prompts = {
    low: 'What’s keeping this low right now?',
    mid: 'When does this pop up most?',
    high: 'What made it this high today?',
  } as const;
  const line = sev <= 2 ? prompts.low : (sev === 3 ? prompts.mid : prompts.high);

  const chipsByTopic: Record<string, { low: string[]; mid: string[]; high: string[] }> = {
    anx: {
      low: ['Routine', 'Exercise', 'Time off'],
      mid: ['Deadlines', 'Social plans', 'Tight schedule'],
      high: ['Poor sleep', 'Work stress', 'Caffeine'],
    },
    dep: {
      low: ['Getting outside', 'Support', 'Structure'],
      mid: ['Low energy', 'Motivation dips', 'Isolation'],
      high: ['Poor sleep', 'Overwhelm', 'Recent setback'],
    },
    mem: {
      low: ['Quiet space', 'Lists', 'Timers'],
      mid: ['Distractions', 'Multitasking', 'Fatigue'],
      high: ['Poor sleep', 'High stress', 'Interruptions'],
    },
    imp: {
      low: ['Breaks', 'Checklists', 'Cues'],
      mid: ['Boredom', 'Rushed pace', 'Interruptions'],
      high: ['High stress', 'Strong urges', 'Lack of plan'],
    },
    sleep: {
      low: ['Consistent schedule', 'Wind‑down', 'Cool room'],
      mid: ['Awakenings', 'Early wake', 'Noise/light'],
      high: ['Late caffeine', 'Late screens', 'Irregular schedule'],
    },
    learn: {
      low: ['Short chunks', 'Clear steps', 'Quiet setting'],
      mid: ['Reading load', 'Math load', 'Noisy class'],
      high: ['Long tasks', 'Tests', 'New material'],
    },
  };

  const topic = chipsByTopic[topicId] || chipsByTopic['anx'];
  const base = sev <= 2 ? topic.low : (sev === 3 ? topic.mid : topic.high);
  const chips = base.slice(0, 3);
  return { line, chips };
}


