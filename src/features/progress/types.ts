export type Rating = 1 | 2 | 3 | 4 | 5;

export interface TaskCompletion {
  task_id: string;
  completed_at: string;
}

export interface LearningProgress {
  schema_version: 1;
  current_week: number;
  current_day: 1 | 2 | 3;
  completed_tasks: TaskCompletion[];
  favorite_hymn_keys: string[];
  recent_hymn_keys: string[];
}

export type AccompanimentPattern =
  | "block_chords"
  | "bass_chord"
  | "broken_chord"
  | "octave_bass"
  | "custom";

export type PracticeMode =
  | "right_hand"
  | "left_hand"
  | "hands_together"
  | "service";

export interface SelfRating {
  continuity: Rating;
  pulse: Rating;
  left_hand: Rating;
  melody: Rating;
  leadership: Rating;
}

export interface HymnPracticeRecord {
  id: string;
  hymn_key: string;
  started_at: string;
  duration_seconds: number;
  practice_key: string;
  target_bpm: number;
  pattern: AccompanimentPattern;
  mode: PracticeMode;
  intro_ready: boolean;
  ending_ready: boolean;
  self_rating: SelfRating;
  issue: string;
  next_goal: string;
}

export interface ServiceSetItem {
  id: string;
  hymn_key: string;
  position: number;
  practice_key: string;
  bpm: number;
  count_in: string;
  transition_note: string;
}

export interface ServiceSet {
  schema_version: 1;
  id: string;
  title: string;
  scheduled_for?: string;
  items: ServiceSetItem[];
  updated_at: string;
}

export interface PracticeStatistics {
  total_minutes: number;
  week_minutes: number;
  practiced_hymns: number;
  streak_days: number;
  average_rating: Record<keyof SelfRating, number>;
}
