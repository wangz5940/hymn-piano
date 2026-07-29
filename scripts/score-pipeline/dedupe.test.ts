import { describe, expect, it } from "vitest";
import {
  SCORE_SCHEMA,
  SOURCE_SCHEMA,
  type PianoScoreDocument,
  type PptxSourceDocument,
  type SourceSlide,
} from "../../src/features/score/contracts";
import {
  dedupeScorePages,
  scoreSlideFingerprint,
  timedEvents,
} from "./dedupe";

const HASH = "a".repeat(64);

function slide(number: number, score = "1 2 |", lyric = "歌词"): SourceSlide {
  const asset = "data/generated/hymn-sources/1.json";
  return {
    id: `slide-${number}`,
    number,
    width_emu: 9_144_000,
    height_emu: 5_143_500,
    width: 960,
    height: 540,
    diagnostics: [],
    shapes: [
      {
        id: `slide-${number}-shape-score`,
        kind: "text",
        name: "score",
        order: 1,
        bbox_emu: { x: 100, y: 100, width: 500, height: 60 },
        bbox: { x: 100, y: 100, width: 500, height: 60 },
        rotation: 0,
        source: {
          asset,
          slide: number,
          shape_id: `slide-${number}-shape-score`,
        },
        paragraphs: [
          {
            id: `score-${number}-p0`,
            order: 0,
            runs: [
              {
                id: `score-${number}-r0`,
                text: score,
                font_family: "SimpMusic Base",
                font_size: 24,
                bold: false,
                italic: false,
                color: "#000000",
                source: {
                  asset,
                  slide: number,
                  shape_id: `slide-${number}-shape-score`,
                  paragraph: 0,
                  run: 0,
                },
              },
            ],
          },
        ],
      },
      {
        id: `slide-${number}-shape-lyric`,
        kind: "text",
        name: "lyric",
        order: 2,
        bbox_emu: { x: 100, y: 180, width: 500, height: 40 },
        bbox: { x: 100, y: 180, width: 500, height: 40 },
        rotation: 0,
        source: {
          asset,
          slide: number,
          shape_id: `slide-${number}-shape-lyric`,
        },
        paragraphs: [
          {
            id: `lyric-${number}-p0`,
            order: 0,
            runs: [
              {
                id: `lyric-${number}-r0`,
                text: lyric,
                font_family: "SimHei",
                font_size: 20,
                bold: false,
                italic: false,
                color: "#000000",
                source: {
                  asset,
                  slide: number,
                  shape_id: `slide-${number}-shape-lyric`,
                  paragraph: 0,
                  run: 0,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

function sourceDocument(slides: SourceSlide[]): PptxSourceDocument {
  return {
    schema: SOURCE_SCHEMA,
    hymn_key: "1",
    title: "测试",
    source_file: "001 测试.pptx",
    source_hash: HASH,
    generator_version: "test",
    slides,
    diagnostics: [],
  };
}

function scorePage(slideNumber: number, lyric: string) {
  const prefix = `h1-p${slideNumber}-s1`;
  const source = {
    asset: "data/generated/hymn-sources/1.json",
    slide: slideNumber,
    shape_id: `slide-${slideNumber}-shape-score`,
  };
  return {
    id: `h1-p${slideNumber}`,
    source_slides: [slideNumber],
    systems: [
      {
        id: prefix,
        measures: [
          {
            id: `${prefix}-m1`,
            number: 1,
            events: [
              {
                id: `${prefix}-m1-e1`,
                measure_id: `${prefix}-m1`,
                kind: "note" as const,
                beat: 0,
                duration: 1,
                degree: 1 as const,
                accidental: null,
                octave: 0,
                augmentation_dots: 0,
                beams: 0,
                raw_glyphs: "1",
                sources: [source],
              },
              {
                id: `${prefix}-m1-e2`,
                measure_id: `${prefix}-m1`,
                kind: "note" as const,
                beat: 1,
                duration: 1,
                degree: 2 as const,
                accidental: null,
                octave: 0,
                augmentation_dots: 0,
                beams: 0,
                raw_glyphs: "2",
                sources: [source],
              },
            ],
          },
        ],
        phrases: [{ id: `${prefix}-phrase-1`, measure_ids: [`${prefix}-m1`] }],
        lyrics: [
          {
            id: `${prefix}-lyric-1`,
            verse: String(slideNumber),
            text: lyric,
            event_ids: [`${prefix}-m1-e1`, `${prefix}-m1-e2`],
            sources: [
              {
                ...source,
                shape_id: `slide-${slideNumber}-shape-lyric`,
              },
            ],
          },
        ],
      },
    ],
  };
}

function scoreDocument(): PianoScoreDocument {
  return {
    schema: SCORE_SCHEMA,
    hymn_key: "1",
    title: "测试",
    content_hash: HASH,
    source: {
      asset: "data/generated/hymn-sources/1.json",
      source_hash: HASH,
      decoder_version: "test",
    },
    key_signature: null,
    meter: null,
    pages: [
      scorePage(1, "第一节"),
      scorePage(2, "第二节"),
      scorePage(3, "不同谱面"),
    ],
    diagnostics: [],
  };
}

describe("谱面去重", () => {
  it("指纹忽略歌词与 shape id，但保留谱面差异", () => {
    expect(scoreSlideFingerprint(slide(1, "1 2 |", "第一节"))).toBe(
      scoreSlideFingerprint(slide(2, "1 2 |", "第二节")),
    );
    expect(scoreSlideFingerprint(slide(1, "1 2 |", "第一节"))).not.toBe(
      scoreSlideFingerprint(slide(3, "1 3 |", "第一节")),
    );
  });

  it("指纹忽略 shape order、Base 空格和 run 分段", () => {
    const left = slide(1, "1  2 |", "第一节");
    const right = slide(2, "12|", "第二节");
    const rightScore = right.shapes[0];
    if (rightScore.kind !== "text") throw new Error("测试谱面必须是文本框");
    rightScore.order = 99;
    const originalRun = rightScore.paragraphs[0].runs[0];
    rightScore.paragraphs[0].runs = [
      { ...originalRun, id: "split-1", text: "1" },
      {
        ...originalRun,
        id: "split-2",
        text: "2|",
        source: { ...originalRun.source, run: 1 },
      },
    ];

    expect(scoreSlideFingerprint(left)).toBe(scoreSlideFingerprint(right));
  });

  it("合并相同谱面并保留歌词版本和原 slide", () => {
    const source = sourceDocument([
      slide(1, "1 2 |", "第一节"),
      slide(2, "1 2 |", "第二节"),
      slide(3, "1 3 |", "不同谱面"),
    ]);
    const result = dedupeScorePages(source, scoreDocument());

    expect(result.original_page_count).toBe(3);
    expect(result.unique_page_count).toBe(2);
    expect(result.duplicate_page_count).toBe(1);
    expect(result.score.pages[0].source_slides).toEqual([1, 2]);
    expect(
      result.score.pages[0].systems[0].lyrics.map((lyric) => lyric.text),
    ).toEqual(["第一节", "第二节"]);
    expect(
      result.score.pages[0].systems[0].lyrics[1].event_ids,
    ).toEqual(timedEvents(result.score.pages[0]).map((event) => event.id));
    expect(result.score.pages[1].source_slides).toEqual([3]);
  });

  it("重复执行产生相同文档和哈希", () => {
    const source = sourceDocument([
      slide(1, "1 2 |", "第一节"),
      slide(2, "1 2 |", "第二节"),
      slide(3, "1 3 |", "不同谱面"),
    ]);
    const first = dedupeScorePages(source, scoreDocument()).score;
    const second = dedupeScorePages(source, scoreDocument()).score;

    expect(first).toEqual(second);
    expect(first.content_hash).toMatch(/^[a-f0-9]{64}$/u);
  });
});
