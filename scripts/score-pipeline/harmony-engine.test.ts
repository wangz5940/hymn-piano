import { describe, expect, it } from "vitest";
import {
  SCORE_SCHEMA,
  type PianoScoreDocument,
  type ScoreMeasure,
  type ScoreNoteEvent,
} from "../../src/features/score/contracts";
import { generateHarmonyPlan } from "./harmony-engine";

const HASH = "b".repeat(64);

function measure(
  number: number,
  degrees: ScoreNoteEvent["degree"][],
): ScoreMeasure {
  const id = `h900-p1-s1-m${number}`;
  return {
    id,
    number,
    events: degrees.map((degree, index) => ({
      id: `${id}-e${index + 1}`,
      measure_id: id,
      kind: "note",
      beat: index,
      duration: 1,
      degree,
      accidental: null,
      octave: 0,
      augmentation_dots: 0,
      beams: 0,
      raw_glyphs: String(degree),
      sources: [
        {
          asset: "data/generated/hymn-sources/900.json",
          slide: 1,
          shape_id: "score",
        },
      ],
    })),
  };
}

function score(
  keySignature: string | null,
  measures: ScoreMeasure[],
  meter = "4/4",
): PianoScoreDocument {
  return {
    schema: SCORE_SCHEMA,
    hymn_key: "900",
    title: "和声测试",
    content_hash: HASH,
    source: {
      asset: "data/generated/hymn-sources/900.json",
      source_hash: HASH,
      decoder_version: "test",
    },
    key_signature: keySignature
      ? {
          value: keySignature,
          sources: [
            {
              asset: "data/hymn-ocr.jsonl",
              slide: 1,
              shape_id: "900 测试.jpg",
            },
          ],
        }
      : null,
    meter: {
      value: meter,
      sources: [
        {
          asset: "data/hymn-ocr.jsonl",
          slide: 1,
          shape_id: "900 测试.jpg",
        },
      ],
    },
    pages: [
      {
        id: "h900-p1",
        source_slides: [1],
        systems: [
          {
            id: "h900-p1-s1",
            measures,
            phrases: [
              {
                id: "phrase-1",
                measure_ids: measures.map((item) => item.id),
              },
            ],
            lyrics: [],
          },
        ],
      },
    ],
    diagnostics: [],
  };
}

describe("generateHarmonyPlan", () => {
  it("无调号时不伪造和弦音名，并明确标记 unavailable", () => {
    const plan = generateHarmonyPlan(
      score(null, [measure(1, [1, 3, 5])]),
    );
    expect(plan.chords).toEqual([]);
    expect(plan.accompaniment.status).toBe("unavailable");
    expect(plan.ending.text).toContain("调号未确认");
  });

  it("根据实际旋律与终止位置生成不同功能，而不是固定 I-V7-I", () => {
    const plan = generateHarmonyPlan(
      score("F", [
        measure(1, [1, 3, 5]),
        measure(2, [6, 1, 3]),
        measure(3, [5, 7, 2, 4]),
        measure(4, [1, 3, 1]),
      ]),
    );
    const functions = plan.chords.map((chord) => chord.function);
    expect(functions).toHaveLength(4);
    expect(new Set(functions).size).toBeGreaterThan(2);
    expect(functions.at(-1)).toBe("I");
    expect(functions).not.toEqual(["I", "V7", "I", "V7"]);
  });

  it("输出实际和弦音名、转位和逐音左手手指，并随连接改变手型", () => {
    const plan = generateHarmonyPlan(
      score("E♭", [
        measure(1, [1, 3, 5]),
        measure(2, [4, 6, 1]),
        measure(3, [5, 7, 2, 4]),
        measure(4, [1, 3, 5]),
      ]),
    );
    expect(plan.chords[0].symbol).toContain("E♭");
    expect(
      plan.chords.every(
        (chord) =>
          chord.tones.length >= 3 &&
          chord.tones.every(
            (tone) => tone.finger >= 1 && tone.finger <= 5,
          ),
      ),
    ).toBe(true);
    expect(
      new Set(
        plan.chords.map((chord) =>
          chord.tones.map((tone) => tone.finger).join("-"),
        ),
      ).size,
    ).toBeGreaterThan(1);
    expect(
      plan.chords.some((chord) => chord.inversion !== "root"),
    ).toBe(true);
  });

  it("伴奏建议随拍号变化", () => {
    const three = generateHarmonyPlan(
      score("C", [measure(1, [1, 3, 5])], "3/4"),
    );
    const sixEight = generateHarmonyPlan(
      score("C", [measure(1, [1, 3, 5])], "6/8"),
    );
    expect(three.accompaniment.text).toContain("低音｜和弦｜和弦");
    expect(sixEight.accompaniment.text).toContain("第 1、4");
  });

  it("[defect-probing] 自动和弦保留为候选数据但默认不展示", () => {
    const plan = generateHarmonyPlan(
      score("F", [
        measure(1, [1, 3, 5]),
        measure(2, [5, 7, 2]),
      ]),
    );

    expect(plan.chords).toHaveLength(2);
    expect(plan.chords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "auto_candidate",
          display_default: false,
        }),
      ]),
    );
    expect(
      plan.chords.every(
        (chord) =>
          (chord as typeof chord & { display_default?: boolean })
            .display_default === false,
      ),
    ).toBe(true);
  });
});
