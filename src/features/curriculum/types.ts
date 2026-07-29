export type PracticeKind =
  | "warmup"
  | "method"
  | "accompaniment"
  | "repertoire"
  | "sight_reading"
  | "service_simulation";

export interface PracticeTask {
  id: string;
  kind: PracticeKind;
  title: string;
  minutes: number;
  objective: string;
  completion_criteria: string[];
  suggested_hymn_numbers?: number[];
}

export interface PracticeDay {
  id: string;
  week: number;
  day: 1 | 2 | 3;
  focus: "学习" | "连接" | "服侍模拟";
  tasks: PracticeTask[];
}

export interface CurriculumWeek {
  week: number;
  phase_id: string;
  phase_title: string;
  title: string;
  capability: string;
  materials: string[];
  hymn_numbers: number[];
  pass_criteria: string[];
  days: PracticeDay[];
}

export interface CurriculumPhase {
  id: string;
  order: number;
  title: string;
  week_start: number;
  week_end: number;
  outcome: string;
}
