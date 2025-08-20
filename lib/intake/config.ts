export type FlowState =
  | 'CONSENT' | 'REASON' | 'SCREEN' | 'DEEP_DIVE' | 'DAILY' | 'SLEEP_SHORT'
  | 'CEC' | 'METABOLIC' | 'ISI' | 'REVIEW' | 'SUBMIT' | 'DONE';

export const DEEP_DIVE_TRIGGER = 3;
export const TRACKER_TRIGGER = 6;
export const USE_ISI_18_PLUS = true;
export const REMOVE_CEC_SLEEP = true;
export const FLOW_VARIANT: 'problem' | 'peak' = 'peak';

export const AREAS = [
  { key: 'anx', label: 'Stress & anxiety' },
  { key: 'dep', label: 'Mood & depression' },
  { key: 'mem', label: 'Memory & thinking' },
  { key: 'imp', label: 'Impulsivity' },
  { key: 'sleep', label: 'Sleep issues' },
  { key: 'learn', label: 'Learning issues (kids)' },
];

export const DEEP_DIVES: Record<string, { key: string; prompt: string }[]> = {
  anx: [
    { key: 'palpitations', prompt: 'Heart palpitations' },
    { key: 'sweating', prompt: 'Sweating' },
    { key: 'trembling', prompt: 'Trembling or shaking' },
    { key: 'constant_worry', prompt: 'Constant worry' },
    { key: 'on_edge', prompt: 'Feeling on edge or restless' },
    { key: 'panic_waves', prompt: 'Sudden waves of panic' },
  ],
  dep: [
    { key: 'persistent_sadness', prompt: 'Persistent sadness or low mood' },
    { key: 'loss_of_interest', prompt: 'Loss of interest in activities' },
    { key: 'emotional_swings', prompt: 'Emotional ups and downs' },
    { key: 'hopelessness', prompt: 'Feeling hopeless' },
    { key: 'irritability', prompt: 'Irritability' },
    { key: 'low_energy', prompt: 'Low energy or motivation' },
  ],
  mem: [
    { key: 'forget_appointments', prompt: 'Forgetting appointments or plans' },
    { key: 'recall_conversations', prompt: 'Trouble recalling conversations' },
    { key: 'directions', prompt: 'Losing track of directions' },
    { key: 'follow_instructions', prompt: 'Difficulty following multi-step instructions' },
    { key: 'misplacing_items', prompt: 'Misplacing items' },
    { key: 'task_concentration', prompt: 'Trouble concentrating on tasks' },
  ],
  imp: [
    { key: 'speak_without_thinking', prompt: 'Speaking without thinking' },
    { key: 'interrupting', prompt: 'Interrupting others' },
    { key: 'waiting_turn', prompt: 'Difficulty waiting turn' },
    { key: 'acting_on_impulse', prompt: 'Acting without considering consequences' },
    { key: 'resist_urges', prompt: 'Difficulty resisting urges' },
    { key: 'task_switching', prompt: 'Trouble completing tasks before starting new ones' },
  ],
  sleep: [
    { key: 'sleep_onset', prompt: 'Trouble falling asleep' },
    { key: 'night_wakings', prompt: 'Waking up often at night' },
    { key: 'early_wakening', prompt: 'Waking too early' },
    { key: 'unrefreshed', prompt: 'Feeling unrefreshed in the morning' },
    { key: 'nightmares_vivid', prompt: 'Nightmares or vivid dreams' },
    { key: 'daytime_sleepy', prompt: 'Daytime sleepiness' },
  ],
  learn: [
    { key: 'follow_instructions', prompt: 'Trouble following instructions' },
    { key: 'stay_on_task', prompt: 'Difficulty staying on task' },
    { key: 'reading_comprehension', prompt: 'Struggles with reading comprehension' },
    { key: 'math_difficulty', prompt: 'Trouble with math' },
    { key: 'disorganized_work', prompt: 'Disorganized schoolwork' },
    { key: 'retain_new_info', prompt: 'Difficulty remembering new information' },
  ],
};


