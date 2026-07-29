import {
  createDefaultServiceSet,
  progressStorage,
  serviceSetStorage,
  STORAGE_KEYS,
} from "./storage";
import { calculateStatistics, totalMinutes } from "./statistics";
import type { HymnPracticeRecord } from "./types";

const makeRecord = (
  id: string,
  startedAt: string,
  durationSeconds: number,
): HymnPracticeRecord => ({
  id,
  hymn_key: id,
  started_at: startedAt,
  duration_seconds: durationSeconds,
  practice_key: "C",
  target_bpm: 72,
  pattern: "bass_chord",
  mode: "hands_together",
  intro_ready: false,
  ending_ready: false,
  self_rating: {
    continuity: 4,
    pulse: 3,
    left_hand: 3,
    melody: 4,
    leadership: 2,
  },
  issue: "左手换和弦",
  next_goal: "保持拍点",
});

describe("本地仓储", () => {
  it("损坏的进度回退到第一周第一日", () => {
    localStorage.setItem(STORAGE_KEYS.progress, "{broken");
    expect(progressStorage.load()).toMatchObject({
      current_week: 1,
      current_day: 1,
    });
  });

  it("拒绝不存在于曲库的导入项", () => {
    const value = createDefaultServiceSet();
    value.items.push({
      id: "one",
      hymn_key: "999",
      position: 0,
      practice_key: "C",
      bpm: 72,
      count_in: "四拍预备",
      transition_note: "",
    });
    expect(() =>
      serviceSetStorage.import(JSON.stringify(value), new Set(["1"])),
    ).toThrow("不存在的诗歌");
  });
});

describe("练习统计", () => {
  it("把秒数换算为分钟", () => {
    expect(
      totalMinutes([
        { duration_seconds: 121 },
        { duration_seconds: 179 },
      ]),
    ).toBe(5);
  });

  it("计算本周、练习诗歌数和连续天数", () => {
    const records = [
      makeRecord("1", "2026-07-22T10:00:00.000Z", 600),
      makeRecord("2", "2026-07-21T10:00:00.000Z", 300),
    ];
    const result = calculateStatistics(
      records,
      new Date("2026-07-22T12:00:00.000Z"),
    );
    expect(result.total_minutes).toBe(15);
    expect(result.practiced_hymns).toBe(2);
    expect(result.streak_days).toBe(2);
    expect(result.average_rating.continuity).toBe(4);
  });
});
