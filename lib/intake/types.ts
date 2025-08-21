export type StepType =
  | 'singleSelect'
  | 'contact'
  | 'areas_select'
  | 'topic_rate'
  | 'slider'
  | 'text'
  | 'deep_dive'
  | 'daily'
  | 'sleep_short'
  | 'cec'
  | 'metabolic'
  | 'isi'
  | 'review';

export type Step = {
  id: string;
  title: string;
  description?: string;
  type: StepType;
  field: string;
  scale?: '0-10' | '1-5' | 'minutes';
  meta?: Record<string, any>;
};

export type IntakePayload = Record<string, any>;


