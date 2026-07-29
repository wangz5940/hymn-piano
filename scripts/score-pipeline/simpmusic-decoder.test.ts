import type { SourceReference } from "../../src/features/score/contracts";
import { describe, expect, it } from "vitest";
import {
  decodeSimpMusicAccent,
  decodeSimpMusicBase,
  lexSimpMusicBase,
} from "./simpmusic-decoder";

const source: SourceReference = {
  asset: "data/generated/hymn-sources/test.json",
  slide: 1,
  shape_id: "slide-1-shape-1",
  paragraph: 0,
  run: 0,
};

function notes(text: string) {
  return decodeSimpMusicBase(text, source).events.filter(
    (event) => event.kind === "note",
  );
}

describe("SimpMusic Base 两阶段解码", () => {
  it("[defect-probing] 按字体真实高低音点拆分移位键音符", () => {
    expect(notes("!@#$%^&*")).toMatchObject([
      { degree: 1, octave: 1, duration: 1 },
      { degree: 2, octave: 1, duration: 1 },
      { degree: 3, octave: 1, duration: 1 },
      { degree: 4, octave: 1, duration: 1 },
      { degree: 5, octave: -1, duration: 1 },
      { degree: 6, octave: -1, duration: 1 },
      { degree: 7, octave: -1, duration: 1 },
      { degree: 1, octave: -1, duration: 1 },
    ]);
    expect(notes("QWERTYUI")).toMatchObject([
      { degree: 1, octave: 1, duration: 0.5 },
      { degree: 2, octave: 1, duration: 0.5 },
      { degree: 3, octave: 1, duration: 0.5 },
      { degree: 4, octave: 1, duration: 0.5 },
      { degree: 5, octave: -1, duration: 0.5 },
      { degree: 6, octave: -1, duration: 0.5 },
      { degree: 7, octave: -1, duration: 0.5 },
      { degree: 1, octave: -1, duration: 0.5 },
    ]);
    expect(notes("ASDFGHJK")).toMatchObject([
      { degree: 1, octave: 1, duration: 0.25 },
      { degree: 2, octave: 1, duration: 0.25 },
      { degree: 3, octave: 1, duration: 0.25 },
      { degree: 4, octave: 1, duration: 0.25 },
      { degree: 5, octave: -1, duration: 0.25 },
      { degree: 6, octave: -1, duration: 0.25 },
      { degree: 7, octave: -1, duration: 0.25 },
      { degree: 1, octave: -1, duration: 0.25 },
    ]);
  });

  it("把 eod 归约为附点八分 3 加十六分 3", () => {
    expect(notes("eod")).toMatchObject([
      { degree: 3, duration: 0.75, beams: 1, augmentation_dots: 1 },
      { degree: 3, duration: 0.25, beams: 2, augmentation_dots: 0 },
    ]);
  });

  it("忽略 Qiiy 与 tieiq 中不计时的连接 token", () => {
    expect(notes("Qiiy")).toMatchObject([
      { degree: 1, octave: 1, duration: 0.5 },
      { degree: 6, octave: 0, duration: 0.5 },
    ]);
    expect(notes("tieiq")).toMatchObject([
      { degree: 5, duration: 0.5 },
      { degree: 3, duration: 0.5 },
      { degree: 1, duration: 0.5 },
    ]);
    expect(
      decodeSimpMusicBase("Qiiy", source).events.reduce(
        (sum, event) => sum + event.duration,
        0,
      ),
    ).toBe(1);
  });

  it("把 3-eiw qos 解成总计四拍的真实节奏", () => {
    const events = decodeSimpMusicBase("3-eiw qos", source).events.filter(
      (event) => event.kind === "note",
    );
    expect(events).toMatchObject([
      { degree: 3, duration: 2, beams: 0 },
      { degree: 3, duration: 0.5, beams: 1 },
      { degree: 2, duration: 0.5, beams: 1 },
      { degree: 1, duration: 0.75, beams: 1, augmentation_dots: 1 },
      { degree: 2, duration: 0.25, beams: 2 },
    ]);
    expect(events.reduce((sum, event) => sum + event.duration, 0)).toBe(4);
  });

  it("规范化 Symbol PUA，并显式报告保守扩展映射", () => {
    expect(notes("\uf031")[0]).toMatchObject({
      degree: 1,
      octave: 0,
      duration: 1,
    });
    expect(notes("\uf086")[0]).toMatchObject({
      degree: 1,
      octave: -1,
      duration: 1,
    });
    const conservative = decodeSimpMusicBase("\uf0a7", source);
    expect(conservative.events[0]).toMatchObject({
      kind: "note",
      degree: 5,
      octave: 1,
    });
    expect(conservative.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "conservative_pua_mapping" }),
      ]),
    );
  });

  it("未知字形只生成 unknown，不伪造音高或时值", () => {
    const result = decodeSimpMusicBase("?", source);
    expect(result.events).toEqual([
      expect.objectContaining({
        kind: "unknown",
        raw_glyphs: "?",
        duration: 0,
        sources: [source],
      }),
    ]);
    expect(result.events[0]).not.toHaveProperty("degree");
    expect(result.diagnostics[0]).toMatchObject({
      code: "unknown_base_glyph",
      severity: "error",
    });
  });

  it("把升、还原、降记号合并到下一音符并保留原始字形", () => {
    const decoded = decodeSimpMusicBase('L4 "4 :7 \uf04c4', source);
    expect(decoded.events).toMatchObject([
      {
        kind: "note",
        degree: 4,
        accidental: "sharp",
        raw_glyphs: "L4",
        sources: [source],
      },
      {
        kind: "note",
        degree: 4,
        accidental: "natural",
        raw_glyphs: '"4',
        sources: [source],
      },
      {
        kind: "note",
        degree: 7,
        accidental: "flat",
        raw_glyphs: ":7",
        sources: [source],
      },
      {
        kind: "note",
        degree: 4,
        accidental: "sharp",
        raw_glyphs: "\uf04c4",
        sources: [source],
      },
    ]);
    expect(decoded.diagnostics).toEqual([]);
  });

  it("把反复、终止线和倍高音 2 解码为明确事件", () => {
    const decoded = decodeSimpMusicBase("[1|2]\\–", source);
    expect(decoded.events).toMatchObject([
      { kind: "repeat", direction: "start", raw_glyphs: "[" },
      { kind: "note", degree: 1, octave: 0 },
      { kind: "barline", style: "single" },
      { kind: "note", degree: 2, octave: 0 },
      { kind: "repeat", direction: "end", raw_glyphs: "]" },
      { kind: "barline", style: "final", raw_glyphs: "\\" },
      { kind: "note", degree: 2, octave: 2, duration: 1 },
    ]);
    expect(decoded.events.some((event) => event.kind === "unknown")).toBe(
      false,
    );
    expect(decoded.diagnostics).toEqual([]);
  });

  it("[defect-probing] 空白字形 8 只影响布局，不生成 unknown 事件", () => {
    const decoded = decodeSimpMusicBase("38988T", source);
    const spacingEights = decoded.tokens.filter(
      (token) => token.raw === "8",
    );
    expect(spacingEights).toHaveLength(3);
    expect(spacingEights.every((token) => token.kind === "spacing")).toBe(true);
    expect(
      decoded.events.filter(
        (event) => event.kind === "unknown" && event.raw_glyphs === "8",
      ),
    ).toEqual([]);
  });

  it("lexer 保留 connector，但归约不生成额外事件", () => {
    const lexed = lexSimpMusicBase("eikd", source);
    expect(lexed.tokens.map((token) => token.kind)).toEqual([
      "note",
      "beam_connector",
      "beam_connector",
      "note",
    ]);
    expect(decodeSimpMusicBase("eikd", source).events).toHaveLength(2);
  });
});

describe("SimpMusic Accent 解码", () => {
  it("区分弧线、三连音与低可信终止线", () => {
    expect(decodeSimpMusicAccent("-", source).tokens[0]).toMatchObject({
      kind: "arc",
      confidence: "context_required",
    });
    expect(decodeSimpMusicAccent("zcc3ccZ", source).tokens[0]).toMatchObject({
      kind: "triplet",
      count: 3,
    });
    const finalCandidate = decodeSimpMusicAccent("v", source);
    expect(finalCandidate.tokens[0]).toMatchObject({
      kind: "final_barline_candidate",
      confidence: "low",
    });
    expect(finalCandidate.diagnostics[0].code).toBe(
      "low_confidence_final_barline",
    );
  });

  it("[defect-probing] 无数字长括号归约为一个待上下文解释的 bracket", () => {
    const result = decodeSimpMusicAccent(
      "zcccccccccccccccccccccccccccccccZ",
      source,
    );
    expect(result.tokens).toEqual([
      expect.objectContaining({
        kind: "bracket",
        confidence: "context_required",
      }),
    ]);
    expect(result.diagnostics).toEqual([]);
  });
});
