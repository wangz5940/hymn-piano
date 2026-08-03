import type { HymnCatalogItem } from "./types";

export type LearningStageId =
  | "c-four-four-foundation"
  | "c-four-four-shifts"
  | "c-meter-variety"
  | "c-advanced-shifts"
  | "new-key-stable"
  | "new-key-shifts"
  | "new-key-advanced";

export interface LearningStage {
  id: LearningStageId;
  order: number;
  title: string;
  shortTitle: string;
  criteria: string;
  description: string;
}

export interface LearningStageGroup extends LearningStage {
  hymns: HymnCatalogItem[];
}

export const LEARNING_STAGES: readonly LearningStage[] = [
  {
    id: "c-four-four-foundation",
    order: 1,
    title: "C 大调 · 稳定起步",
    shortTitle: "C 调起步",
    criteria: "4/4 拍 · 0–2 次换位",
    description:
      "先把白键位置、四拍节奏和稳定手型练熟，尽量减少看手。",
  },
  {
    id: "c-four-four-shifts",
    order: 2,
    title: "C 大调 · 开始换位",
    shortTitle: "C 调换位",
    criteria: "4/4 拍 · 3–4 次换位",
    description:
      "保持熟悉的 C 大调与四拍节奏，只增加少量手位移动。",
  },
  {
    id: "c-meter-variety",
    order: 3,
    title: "C 大调 · 节拍扩展",
    shortTitle: "节拍扩展",
    criteria: "其他拍号 · 0–4 次换位",
    description:
      "继续只弹白键，在熟悉音位的前提下适应三拍、六拍等节奏。",
  },
  {
    id: "c-advanced-shifts",
    order: 4,
    title: "C 大调 · 多次换位",
    shortTitle: "C 调进阶",
    criteria: "任意拍号 · 5 次以上换位",
    description:
      "仍使用熟悉的 C 大调，集中训练跨手位连接和提前落位。",
  },
  {
    id: "new-key-stable",
    order: 5,
    title: "其他调 · 固定手位",
    shortTitle: "认识新调",
    criteria: "0–2 次换位",
    description:
      "从 G、F 等邻近调开始认识黑键，每首尽量保持稳定手位。",
  },
  {
    id: "new-key-shifts",
    order: 6,
    title: "其他调 · 少量换位",
    shortTitle: "新调换位",
    criteria: "3–4 次换位",
    description:
      "在不同调号中练习换位，同时保持旋律和节拍连续。",
  },
  {
    id: "new-key-advanced",
    order: 7,
    title: "其他调 · 综合进阶",
    shortTitle: "综合进阶",
    criteria: "5 次以上换位",
    description:
      "综合处理黑键、多次换位和不同拍号，作为聚会司琴进阶曲目。",
  },
] as const;

const KEY_COMPLEXITY: Readonly<Record<string, number>> = {
  C: 0,
  G: 1,
  F: 1,
  D: 2,
  "B♭": 2,
  A: 3,
  "E♭": 3,
  E: 4,
  "A♭": 4,
  B: 5,
  "D♭": 5,
  "F♯": 6,
  "G♭": 6,
};

function hasLearningProfile(
  hymn: HymnCatalogItem,
): hymn is HymnCatalogItem & {
  key_signature: string;
  meter: string;
  position_change_count: number;
} {
  return (
    hymn.variant === "" &&
    hymn.score_source === "pptx" &&
    Boolean(hymn.key_signature) &&
    Boolean(hymn.meter) &&
    typeof hymn.position_change_count === "number"
  );
}

export function learningStageFor(
  hymn: HymnCatalogItem,
): LearningStageId | null {
  if (!hasLearningProfile(hymn)) return null;
  const moves = hymn.position_change_count;

  if (hymn.key_signature === "C") {
    if (hymn.meter === "4/4" && moves <= 2) {
      return "c-four-four-foundation";
    }
    if (hymn.meter === "4/4" && moves <= 4) {
      return "c-four-four-shifts";
    }
    if (hymn.meter !== "4/4" && moves <= 4) {
      return "c-meter-variety";
    }
    return "c-advanced-shifts";
  }

  if (moves <= 2) return "new-key-stable";
  if (moves <= 4) return "new-key-shifts";
  return "new-key-advanced";
}

function compareRecommendedHymns(
  left: HymnCatalogItem,
  right: HymnCatalogItem,
): number {
  const keyDifference =
    (KEY_COMPLEXITY[left.key_signature ?? ""] ?? 99) -
    (KEY_COMPLEXITY[right.key_signature ?? ""] ?? 99);
  if (keyDifference !== 0) return keyDifference;

  const moveDifference =
    (left.position_change_count ?? 99) -
    (right.position_change_count ?? 99);
  if (moveDifference !== 0) return moveDifference;

  const meterDifference =
    (left.meter === "4/4" ? 0 : 1) -
    (right.meter === "4/4" ? 0 : 1);
  if (meterDifference !== 0) return meterDifference;

  return (
    left.number - right.number ||
    left.variant.localeCompare(right.variant)
  );
}

export function buildLearningPath(
  hymns: readonly HymnCatalogItem[],
): LearningStageGroup[] {
  const grouped = new Map<LearningStageId, HymnCatalogItem[]>(
    LEARNING_STAGES.map((stage) => [stage.id, []]),
  );

  for (const hymn of hymns) {
    const stage = learningStageFor(hymn);
    if (stage) grouped.get(stage)?.push(hymn);
  }

  return LEARNING_STAGES.map((stage) => ({
    ...stage,
    hymns: [...(grouped.get(stage.id) ?? [])].sort(
      compareRecommendedHymns,
    ),
  }));
}

export function keySignatureLabel(keySignature: string): string {
  return `${keySignature} 大调`;
}

export function positionChangeLabel(count: number): string {
  return count === 0 ? "固定手位" : `${count} 次换位`;
}
