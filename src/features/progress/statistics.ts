import type {
  HymnPracticeRecord,
  PracticeStatistics,
  SelfRating,
} from "./types";

const ratingKeys: readonly (keyof SelfRating)[] = [
  "continuity",
  "pulse",
  "left_hand",
  "melody",
  "leadership",
];

const dayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function totalMinutes(
  records: readonly Pick<HymnPracticeRecord, "duration_seconds">[],
): number {
  const seconds = records.reduce(
    (total, record) => total + Math.max(0, record.duration_seconds),
    0,
  );
  return Math.round(seconds / 60);
}

function startOfWeek(reference: Date): Date {
  const result = new Date(reference);
  const day = result.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

function getStreak(records: readonly HymnPracticeRecord[], now: Date): number {
  const practicedDays = new Set(
    records.map((record) => dayKey(new Date(record.started_at))),
  );
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!practicedDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (practicedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function calculateStatistics(
  records: readonly HymnPracticeRecord[],
  now = new Date(),
): PracticeStatistics {
  const weekStart = startOfWeek(now);
  const weekRecords = records.filter(
    (record) => new Date(record.started_at) >= weekStart,
  );

  const average_rating = Object.fromEntries(
    ratingKeys.map((key) => {
      if (records.length === 0) return [key, 0];
      const sum = records.reduce(
        (total, record) => total + record.self_rating[key],
        0,
      );
      return [key, Number((sum / records.length).toFixed(1))];
    }),
  ) as Record<keyof SelfRating, number>;

  return {
    total_minutes: totalMinutes(records),
    week_minutes: totalMinutes(weekRecords),
    practiced_hymns: new Set(records.map((record) => record.hymn_key)).size,
    streak_days: getStreak(records, now),
    average_rating,
  };
}
