import type {
  HymnPracticeRecord,
  LearningProgress,
  ServiceSet,
  ServiceSetItem,
} from "./types";

export const STORAGE_KEYS = {
  progress: "shiqin.progress.v1",
  records: "shiqin.practice-records.v1",
  serviceSet: "shiqin.service-set.v1",
} as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function createDefaultProgress(): LearningProgress {
  return {
    schema_version: 1,
    current_week: 1,
    current_day: 1,
    completed_tasks: [],
    favorite_hymn_keys: [],
    recent_hymn_keys: [],
  };
}

export function createDefaultServiceSet(): ServiceSet {
  return {
    schema_version: 1,
    id: "current-service-set",
    title: "本次聚会",
    items: [],
    updated_at: new Date().toISOString(),
  };
}

function isLearningProgress(value: unknown): value is LearningProgress {
  if (!isObject(value)) return false;
  return (
    value.schema_version === 1 &&
    typeof value.current_week === "number" &&
    value.current_week >= 1 &&
    value.current_week <= 48 &&
    [1, 2, 3].includes(Number(value.current_day)) &&
    Array.isArray(value.completed_tasks) &&
    Array.isArray(value.favorite_hymn_keys) &&
    Array.isArray(value.recent_hymn_keys)
  );
}

function isPracticeRecord(value: unknown): value is HymnPracticeRecord {
  if (!isObject(value) || !isObject(value.self_rating)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.hymn_key === "string" &&
    typeof value.started_at === "string" &&
    typeof value.duration_seconds === "number" &&
    typeof value.target_bpm === "number" &&
    typeof value.practice_key === "string" &&
    typeof value.issue === "string" &&
    typeof value.next_goal === "string"
  );
}

function isServiceSetItem(value: unknown): value is ServiceSetItem {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.hymn_key === "string" &&
    typeof value.position === "number" &&
    typeof value.practice_key === "string" &&
    typeof value.bpm === "number" &&
    typeof value.count_in === "string" &&
    typeof value.transition_note === "string"
  );
}

function isServiceSet(value: unknown): value is ServiceSet {
  if (!isObject(value) || !Array.isArray(value.items)) return false;
  return (
    value.schema_version === 1 &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    value.title.length <= 80 &&
    typeof value.updated_at === "string" &&
    value.items.length <= 100 &&
    value.items.every(isServiceSetItem)
  );
}

function readJson<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const serialized = window.localStorage.getItem(key);
    if (!serialized) return fallback;
    const value: unknown = JSON.parse(serialized);
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const progressStorage = {
  load: (): LearningProgress =>
    readJson(
      STORAGE_KEYS.progress,
      createDefaultProgress(),
      isLearningProgress,
    ),
  save: (value: LearningProgress): boolean =>
    writeJson(STORAGE_KEYS.progress, value),
};

export const practiceStorage = {
  load: (): HymnPracticeRecord[] =>
    readJson(
      STORAGE_KEYS.records,
      [],
      (value): value is HymnPracticeRecord[] =>
        Array.isArray(value) && value.every(isPracticeRecord),
    ),
  save: (value: HymnPracticeRecord[]): boolean =>
    writeJson(STORAGE_KEYS.records, value.slice(0, 2000)),
};

export const serviceSetStorage = {
  load: (): ServiceSet =>
    readJson(
      STORAGE_KEYS.serviceSet,
      createDefaultServiceSet(),
      isServiceSet,
    ),
  save: (value: ServiceSet): boolean =>
    writeJson(STORAGE_KEYS.serviceSet, value),
  export: (value: ServiceSet): string => JSON.stringify(value, null, 2),
  import: (serialized: string, validHymnKeys: ReadonlySet<string>): ServiceSet => {
    const parsed: unknown = JSON.parse(serialized);
    if (!isServiceSet(parsed)) {
      throw new Error("曲单文件结构不符合诗琴 v1 格式");
    }
    if (parsed.items.some((item) => !validHymnKeys.has(item.hymn_key))) {
      throw new Error("曲单包含当前曲库中不存在的诗歌");
    }
    return {
      ...parsed,
      items: [...parsed.items]
        .sort((left, right) => left.position - right.position)
        .map((item, index) => ({ ...item, position: index })),
      updated_at: new Date().toISOString(),
    };
  },
};
