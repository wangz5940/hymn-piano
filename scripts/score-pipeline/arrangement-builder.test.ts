import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  validateArrangementDocument,
  type PianoScoreDocument,
  type ScoreNoteEvent,
} from "../../src/features/score/contracts";
import {
  MANUAL_ARRANGEMENT_SCHEMA,
  buildPianoArrangement,
  loadManualArrangement,
  type ManualArrangementOverrides,
} from "./arrangement-builder";
import { resolvePptxCorpusFile } from "./corpus-paths";
import { readPptxSource } from "./pptx-reader";
import { buildPianoScore } from "./score-builder";

let score118: PianoScoreDocument;

function noteEvents(score: PianoScoreDocument): ScoreNoteEvent[] {
  return score.pages.flatMap((page) =>
    page.systems.flatMap((system) =>
      system.measures.flatMap((measure) =>
        measure.events.filter(
          (event): event is ScoreNoteEvent => event.kind === "note",
        ),
      ),
    ),
  );
}

beforeAll(async () => {
  score118 = buildPianoScore(
    await readPptxSource(
      resolvePptxCorpusFile("118 神的儿子亲爱救主.pptx"),
    ),
    {
      metadataFallback: {
        filename: "118 神的儿子亲爱救主.jpg",
        key_signature: "F调",
        meter: "3/4",
      },
    },
  );
});

describe("buildPianoArrangement", () => {
  it("为真实 118 的每个音符生成指法，并通过引用契约校验", () => {
    const arrangement = buildPianoArrangement(score118);
    expect(arrangement.fingerings).toHaveLength(noteEvents(score118).length);
    expect(arrangement.positions.length).toBeGreaterThan(0);
    expect(arrangement.chords.length).toBeGreaterThan(0);
    expect(
      arrangement.chords.every(
        (chord) =>
          (chord as typeof chord & { display_default?: boolean })
            .display_default === true,
      ),
    ).toBe(true);
    expect(validateArrangementDocument(score118, arrangement)).toEqual([]);
  });

  it("相同输入生成完全相同的编配和哈希", () => {
    const first = buildPianoArrangement(score118);
    const second = buildPianoArrangement(score118);
    expect(second).toEqual(first);
    expect(first.content_hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.score_hash).toBe(score118.content_hash);
  });

  it("人工确认按事件和小节覆盖自动候选，并保留候选审计", () => {
    const automatic = buildPianoArrangement(score118);
    const firstNote = noteEvents(score118)[0];
    const firstPosition = automatic.positions[0];
    const firstChord = automatic.chords[0];
    const manual: ManualArrangementOverrides = {
      schema: MANUAL_ARRANGEMENT_SCHEMA,
      hymn_key: "118",
      fingerings: [
        {
          event_id: firstNote.id,
          finger: 1,
          hand: "right",
          status: "manual_confirmed",
          confidence: 1,
          reason: "F 调主音以 1 指起句，建立 F 五指位。",
        },
      ],
      positions: [
        {
          ...firstPosition,
          status: "manual_confirmed",
          confidence: 1,
          label: "F Position",
          reason: "起句保持 F 五指位。",
        },
      ],
      chords: [
        {
          ...firstChord,
          symbol: "F",
          function: "I",
          bass: "F",
          inversion: "root",
          tones: [
            { note: "F", finger: 5 },
            { note: "A", finger: 3 },
            { note: "C", finger: 1 },
          ],
          status: "manual_confirmed",
          confidence: 1,
          evidence: ["人工按谱面与终止位置确认"],
          alternatives: [],
          reason: "起句以 F 主和弦建立调性。",
        },
      ],
    };
    const arrangement = buildPianoArrangement(score118, manual);
    expect(
      arrangement.fingerings.find(
        (item) => item.event_id === firstNote.id,
      ),
    ).toMatchObject({ status: "manual_confirmed", finger: 1 });
    expect(
      arrangement.positions.find((item) => item.id === firstPosition.id),
    ).toMatchObject({ status: "manual_confirmed", label: "F Position" });
    expect(
      arrangement.chords.find(
        (item) => item.measure_id === firstChord.measure_id && item.beat === 0,
      ),
    ).toMatchObject({
      status: "manual_confirmed",
      display_default: true,
      symbol: "F",
      alternatives: [expect.stringContaining("自动候选:")],
    });
    expect(validateArrangementDocument(score118, arrangement)).toEqual([]);
  });

  it("[defect-probing] 自动候选、来源确认和人工确认和弦均默认展示", () => {
    const automatic = buildPianoArrangement(score118);
    const firstChord = automatic.chords[0];

    expect(firstChord).toMatchObject({
      status: "auto_candidate",
      display_default: true,
    });

    for (const status of [
      "source_confirmed",
      "manual_confirmed",
    ] as const) {
      const manual: ManualArrangementOverrides = {
        schema: MANUAL_ARRANGEMENT_SCHEMA,
        hymn_key: "118",
        chords: [{ ...firstChord, status }],
      };
      const arrangement = buildPianoArrangement(score118, manual);
      const merged = arrangement.chords.find(
        (chord) =>
          chord.measure_id === firstChord.measure_id &&
          chord.beat === firstChord.beat,
      );

      expect(merged).toMatchObject({
        status,
        display_default: true,
      });
    }
  });

  it("拒绝把 118 人工编配应用到 118b 或其他版本", () => {
    const manual: ManualArrangementOverrides = {
      schema: MANUAL_ARRANGEMENT_SCHEMA,
      hymn_key: "118",
    };
    const otherScore: PianoScoreDocument = {
      ...score118,
      hymn_key: "118b",
    };
    expect(() => buildPianoArrangement(otherScore, manual)).toThrow(
      /不得应用/u,
    );
  });

  it("仓库中的 118 人工方案只引用当前 118 的有效事件和小节", async () => {
    const manual = await loadManualArrangement(
      resolve("data/arrangements/manual/118.json"),
    );
    const arrangement = buildPianoArrangement(score118, manual);
    expect(manual.hymn_key).toBe("118");
    expect(
      arrangement.fingerings.filter(
        (item) => item.status === "manual_confirmed",
      ).length,
    ).toBeGreaterThan(10);
    expect(
      arrangement.chords.filter(
        (item) => item.status === "manual_confirmed",
      ).length,
    ).toBeGreaterThan(3);
    expect(validateArrangementDocument(score118, arrangement)).toEqual([]);
  });

  it("调号为空时仍生成逐音指法与相对级数和弦", () => {
    const noKeyScore: PianoScoreDocument = {
      ...score118,
      key_signature: null,
      content_hash: "c".repeat(64),
    };
    const arrangement = buildPianoArrangement(noKeyScore);
    expect(arrangement.fingerings).toHaveLength(noteEvents(noKeyScore).length);
    expect(arrangement.chords.length).toBeGreaterThan(0);
    expect(
      arrangement.chords.every(
        (chord) =>
          chord.display_default &&
          chord.status === "auto_candidate" &&
          chord.evidence.includes(
            "调号未标明，和弦音使用相对级数表达",
          ),
      ),
    ).toBe(true);
    expect(arrangement.accompaniment.status).toBe("auto_candidate");
  });
});
