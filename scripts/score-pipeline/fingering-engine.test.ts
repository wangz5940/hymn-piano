import { describe, expect, it } from "vitest";
import {
  SCORE_SCHEMA,
  type PianoScoreDocument,
  type ScoreNoteEvent,
} from "../../src/features/score/contracts";
import {
  generateFingeringPlan,
  isBlackKeyPitch,
  scoreNotePitch,
} from "./fingering-engine";

const HASH = "a".repeat(64);

function scoreWithDegrees(
  keySignature: string | null,
  degrees: Array<{ degree: ScoreNoteEvent["degree"]; octave?: number }>,
): PianoScoreDocument {
  const events: ScoreNoteEvent[] = degrees.map((item, index) => ({
    id: `h999-p1-s1-m1-e${index + 1}`,
    measure_id: "h999-p1-s1-m1",
    kind: "note",
    beat: index,
    duration: 1,
    degree: item.degree,
    accidental: null,
    octave: item.octave ?? 0,
    augmentation_dots: 0,
    beams: 0,
    raw_glyphs: String(item.degree),
    sources: [
      {
        asset: "data/generated/hymn-sources/999.json",
        slide: 1,
        shape_id: "score",
      },
    ],
  }));
  return {
    schema: SCORE_SCHEMA,
    hymn_key: "999",
    title: "指法测试",
    content_hash: HASH,
    source: {
      asset: "data/generated/hymn-sources/999.json",
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
              shape_id: "999 测试.jpg",
            },
          ],
        }
      : null,
    meter: null,
    pages: [
      {
        id: "h999-p1",
        source_slides: [1],
        systems: [
          {
            id: "h999-p1-s1",
            measures: [
              { id: "h999-p1-s1-m1", number: 1, events },
            ],
            phrases: [
              { id: "phrase-1", measure_ids: ["h999-p1-s1-m1"] },
            ],
            lyrics: [],
          },
        ],
      },
    ],
    diagnostics: [],
  };
}

describe("generateFingeringPlan", () => {
  it("为每个音符分配手指，并为超出五指位的旋律生成换位", () => {
    const score = scoreWithDegrees("F", [
      { degree: 1 },
      { degree: 2 },
      { degree: 3 },
      { degree: 4 },
      { degree: 5 },
      { degree: 6 },
      { degree: 7 },
      { degree: 1, octave: 1 },
    ]);
    const plan = generateFingeringPlan(score);

    expect(plan.fingerings).toHaveLength(8);
    expect(new Set(plan.fingerings.map((item) => item.event_id)).size).toBe(8);
    expect(plan.positions.length).toBeGreaterThan(1);
    expect(plan.moves.length).toBeGreaterThan(0);
    expect(
      plan.moves.every((move) =>
        plan.positions.some(
          (position) => position.id === move.to_position_id,
        ),
      ),
    ).toBe(true);
  });

  it("D 大调黑键优先使用 2、3、4 指", () => {
    const score = scoreWithDegrees("D", [
      { degree: 1 },
      { degree: 2 },
      { degree: 3 },
      { degree: 4 },
      { degree: 5 },
    ]);
    const plan = generateFingeringPlan(score);
    const third = score.pages[0].systems[0].measures[0]
      .events[2] as ScoreNoteEvent;
    expect(isBlackKeyPitch(scoreNotePitch(third, "D"))).toBe(true);
    expect([2, 3, 4]).toContain(
      plan.fingerings.find((item) => item.event_id === third.id)?.finger,
    );
  });

  it("黑键使用中间手指时明确说明优先原则", () => {
    const plan = generateFingeringPlan(
      scoreWithDegrees("E♭", [{ degree: 1 }]),
    );

    expect([2, 3, 4]).toContain(plan.fingerings[0].finger);
    expect(plan.fingerings[0].reason).toMatch(
      /黑键.*优先.*[234] 指/u,
    );
  });

  it("[defect-probing] 黑键使用 1 或 5 指时说明中间手指替代成本与前后文", () => {
    const plan = generateFingeringPlan(
      scoreWithDegrees("E♭", [
        { degree: 1 },
        { degree: 2 },
        { degree: 3 },
        { degree: 4 },
        { degree: 5 },
      ]),
    );
    const exceptions = [
      plan.fingerings[0],
      plan.fingerings[plan.fingerings.length - 1],
    ];

    expect(exceptions.map((item) => item.finger)).toEqual([1, 5]);
    for (const assignment of exceptions) {
      expect(assignment.reason).toMatch(/未采用 [234] 指/u);
      expect(assignment.reason).toMatch(
        /全句总成本.*(?:低|少) \d+(?:\.\d+)?/u,
      );
      expect(assignment.reason).toMatch(
        /固定手位|额外换位|反向交叉|衔接前后音/u,
      );
      expect(assignment.reason).not.toMatch(
        /^.+是黑键，使用 [15] 指以保持手腕自然。$/u,
      );
    }
  });

  it("重复音保持同一手指，且未知调号仍保留可练的指序", () => {
    const score = scoreWithDegrees(null, [
      { degree: 3 },
      { degree: 3 },
      { degree: 3 },
      { degree: 2 },
      { degree: 1 },
    ]);
    const plan = generateFingeringPlan(score);
    expect(plan.fingerings.slice(0, 3).map((item) => item.finger)).toEqual([
      plan.fingerings[0].finger,
      plan.fingerings[0].finger,
      plan.fingerings[0].finger,
    ]);
    expect(plan.fingerings.every((item) => item.confidence < 0.8)).toBe(true);
  });

  it("[defect-probing] 第 5 首首行保留 E 到 G 的三音换位", () => {
    const score = scoreWithDegrees("D", [
      { degree: 5 },
      { degree: 5 },
      { degree: 3 },
      { degree: 5 },
      { degree: 1, octave: 1 },
      { degree: 1, octave: 1 },
      { degree: 6 },
      { degree: 1, octave: 1 },
    ]);
    const eventIds = score.pages[0].systems[0].measures[0].events.map(
      (event) => event.id,
    );
    const plan = generateFingeringPlan(score);

    expect(plan.positions.map((position) => position.label)).toEqual([
      "E Position",
      "G Position",
    ]);
    expect(plan.positions[0]).toMatchObject({
      start_event_id: eventIds[0],
      end_event_id: eventIds[2],
    });
    expect(plan.positions[1]).toMatchObject({
      start_event_id: eventIds[3],
      end_event_id: eventIds[7],
    });
    expect(plan.moves).toEqual([
      expect.objectContaining({
        trigger_event_id: eventIds[3],
        instruction: "Move to G Position",
      }),
    ]);
  });

  it("[defect-probing] 合并少于三音的瞬时手位，逐音指法仍完整保留", () => {
    const score = scoreWithDegrees("E♭", [
      { degree: 5 },
      { degree: 5 },
      { degree: 3 },
      { degree: 1 },
      { degree: 2 },
      { degree: 3 },
      { degree: 4 },
      { degree: 5 },
      { degree: 5 },
      { degree: 5 },
      { degree: 1 },
      { degree: 3 },
      { degree: 1 },
      { degree: 2 },
      { degree: 1 },
    ]);
    const eventIds = score.pages[0].systems[0].measures[0].events.map(
      (event) => event.id,
    );
    const eventIndexes = new Map(
      eventIds.map((eventId, index) => [eventId, index]),
    );
    const plan = generateFingeringPlan(score);

    expect(plan.fingerings).toHaveLength(eventIds.length);
    expect(plan.positions.length).toBeLessThanOrEqual(2);
    expect(
      plan.positions.every((position) => {
        const start = eventIndexes.get(position.start_event_id);
        const end = eventIndexes.get(position.end_event_id);
        return start !== undefined && end !== undefined && end - start + 1 >= 3;
      }),
    ).toBe(true);
    expect(plan.moves.length).toBeLessThanOrEqual(1);
  });
});
