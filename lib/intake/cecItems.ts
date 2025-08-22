export type CecItem = { id: string; text: string; domain: string };

// Minimal adult CEC exemplar set (expandable)
export const CEC_ITEMS: CecItem[] = [
  // Focus & Flexibility
  { id: 'focus_mind_wanders', text: 'My mind frequently wanders during conversations.', domain: 'Focus & Flexibility' },
  { id: 'focus_lose_interest', text: 'I lose interest quickly in tasks I find dull.', domain: 'Focus & Flexibility' },
  { id: 'focus_switch_gears', text: 'I find it hard to switch gears between topics.', domain: 'Focus & Flexibility' },
  { id: 'focus_disorganized', text: 'My workspace or thoughts feel chronically disorganized.', domain: 'Focus & Flexibility' },
  { id: 'focus_reread', text: 'I re‑read simple text before it makes sense.', domain: 'Focus & Flexibility' },

  // Memory
  { id: 'mem_forget_appts', text: 'I forget appointments unless I write them down.', domain: 'Memory' },
  { id: 'mem_recall_details', text: 'I have trouble recalling details from conversations.', domain: 'Memory' },
  { id: 'mem_misplace_items', text: 'I frequently misplace items like keys or glasses.', domain: 'Memory' },
  { id: 'mem_directions', text: 'I lose track of directions in familiar places.', domain: 'Memory' },
  { id: 'mem_sequence_steps', text: 'I struggle to remember steps in a sequence.', domain: 'Memory' },

  // Impulsivity & Self‑Control
  { id: 'imp_speak_without_thinking', text: 'I often speak without thinking.', domain: 'Impulsivity & Self‑Control' },
  { id: 'imp_interrupt', text: 'I interrupt others frequently in conversation.', domain: 'Impulsivity & Self‑Control' },
  { id: 'imp_resist_urges', text: 'I find it hard to resist urges even when I know better.', domain: 'Impulsivity & Self‑Control' },
  { id: 'imp_task_switching', text: 'I switch tasks before completing the current one.', domain: 'Impulsivity & Self‑Control' },

  // Mood & Emotional Regulation
  { id: 'mood_low_motivation', text: 'I feel little motivation for things I used to enjoy.', domain: 'Mood & Emotional' },
  { id: 'mood_swings', text: 'I swing between emotional highs and lows.', domain: 'Mood & Emotional' },
  { id: 'mood_hopelessness', text: 'I experience periods of hopelessness.', domain: 'Mood & Emotional' },
];

export const CEC_SCALE = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Sometimes' },
  { value: 2, label: 'Often' },
  { value: 3, label: 'Always' },
];


