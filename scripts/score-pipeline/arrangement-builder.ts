import { readFile } from "node:fs/promises";
import {
  ARRANGEMENT_SCHEMA,
  assertArrangementDocument,
  shouldDisplayTeachingCandidate,
  type ArrangementRecommendation,
  type ChordAssignment,
  type FingerAssignment,
  type PianoArrangementDocument,
  type PianoScoreDocument,
  type PositionMove,
  type PositionSegment,
} from "../../src/features/score/contracts";
import { generateFingeringPlan } from "./fingering-engine";
import { generateHarmonyPlan } from "./harmony-engine";
import { withDocumentContentHash } from "./content-hash";

export const MANUAL_ARRANGEMENT_SCHEMA =
  "shiqin-manual-arrangement/v1" as const;

export interface ManualArrangementOverrides {
  schema: typeof MANUAL_ARRANGEMENT_SCHEMA;
  hymn_key: string;
  fingerings?: FingerAssignment[];
  positions?: PositionSegment[];
  moves?: PositionMove[];
  chords?: ChordAssignment[];
  accompaniment?: ArrangementRecommendation;
  intro?: ArrangementRecommendation;
  interlude?: ArrangementRecommendation;
  ending?: ArrangementRecommendation;
}

function mergeByKey<T>(
  automatic: T[],
  manual: T[] | undefined,
  keyFor: (value: T) => string,
): T[] {
  const merged = new Map(automatic.map((value) => [keyFor(value), value]));
  for (const value of manual ?? []) merged.set(keyFor(value), value);
  return [...merged.values()];
}

function mergeChords(
  automatic: ChordAssignment[],
  manual: ChordAssignment[] | undefined,
): ChordAssignment[] {
  const byAnchor = new Map(
    automatic.map((chord) => [
      `${chord.measure_id}:${chord.beat}`,
      {
        ...chord,
        display_default: shouldDisplayTeachingCandidate(chord.status),
      },
    ]),
  );
  for (const chord of manual ?? []) {
    const key = `${chord.measure_id}:${chord.beat}`;
    const candidate = byAnchor.get(key);
    byAnchor.set(key, {
      ...chord,
      display_default: shouldDisplayTeachingCandidate(chord.status),
      evidence: [
        ...chord.evidence,
        ...(candidate
          ? [`人工确认覆盖自动候选 ${candidate.symbol}`]
          : []),
      ],
      alternatives: [
        ...new Set([
          ...chord.alternatives,
          ...(candidate ? [`自动候选:${candidate.symbol}`] : []),
        ]),
      ],
    });
  }
  return [...byAnchor.values()];
}

export async function loadManualArrangement(
  path: string,
): Promise<ManualArrangementOverrides> {
  const parsed = JSON.parse(
    await readFile(path, "utf8"),
  ) as ManualArrangementOverrides;
  if (parsed.schema !== MANUAL_ARRANGEMENT_SCHEMA) {
    throw new Error(`人工编配 schema 无效：${parsed.schema}`);
  }
  return parsed;
}

export function buildPianoArrangement(
  score: PianoScoreDocument,
  manual?: ManualArrangementOverrides,
): PianoArrangementDocument {
  if (manual && manual.hymn_key !== score.hymn_key) {
    throw new Error(
      `人工编配 ${manual.hymn_key} 不得应用于曲目 ${score.hymn_key}`,
    );
  }
  const fingering = generateFingeringPlan(score);
  const harmony = generateHarmonyPlan(score);
  const withoutHash: Omit<PianoArrangementDocument, "content_hash"> = {
    schema: ARRANGEMENT_SCHEMA,
    hymn_key: score.hymn_key,
    score_hash: score.content_hash,
    fingerings: mergeByKey(
      fingering.fingerings,
      manual?.fingerings,
      (value) => value.event_id,
    ),
    positions: mergeByKey(
      fingering.positions,
      manual?.positions,
      (value) => value.id,
    ),
    moves: mergeByKey(
      fingering.moves,
      manual?.moves,
      (value) => value.id,
    ),
    chords: mergeChords(harmony.chords, manual?.chords),
    accompaniment: manual?.accompaniment ?? harmony.accompaniment,
    intro: manual?.intro ?? harmony.intro,
    interlude: manual?.interlude ?? harmony.interlude,
    ending: manual?.ending ?? harmony.ending,
  };
  const arrangement = withDocumentContentHash(withoutHash);
  assertArrangementDocument(score, arrangement);
  return arrangement;
}
