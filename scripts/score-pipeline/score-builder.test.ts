import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SOURCE_SCHEMA,
  validateScoreDocument,
  type PptxSourceDocument,
  type ScoreEvent,
} from "../../src/features/score/contracts";
import { readPptxSource } from "./pptx-reader";
import { buildPianoScore } from "./score-builder";

const hymn001 = resolve("712首-文字/001 至大医生.pptx");
const hymn013 = resolve("712首-文字/013 神差爱子.pptx");
const hymn023 = resolve("712首-文字/023 听啊救主叩门.pptx");
const hymn101 = resolve("712首-文字/101 此时何时孤单之时.pptx");
const hymn127 = resolve("712首-文字/127 橄榄山前一别离.pptx");
const hymn154 = resolve("712首-文字/154 一直走十架窄路.pptx");
const hymn185 = resolve("712首-文字/185 我今转身背向俗世.pptx");
const hymn696 = resolve("712首-文字/696 愿祢崇高.pptx");

function events(score: ReturnType<typeof buildPianoScore>): ScoreEvent[] {
  return score.pages.flatMap((page) =>
    page.systems.flatMap((system) =>
      system.measures.flatMap((measure) => measure.events),
    ),
  );
}

describe("buildPianoScore", () => {
  it("从真实 001 PPTX 构建可校验的稳定 Score AST", async () => {
    const source = await readPptxSource(hymn001);
    const first = buildPianoScore(source);
    const second = buildPianoScore(source);

    expect(first).toEqual(second);
    expect(first.content_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.source).toMatchObject({
      asset: "data/generated/hymn-sources/1.json",
      source_hash: source.source_hash,
      decoder_version: "simpmusic-decoder/v3",
    });
    expect(first.pages).toHaveLength(source.slides.length);
    expect(events(first).some((event) => event.kind === "note")).toBe(true);
    expect(validateScoreDocument(first)).toEqual([]);
  });

  it("真实 154 保留 eod 节奏、调拍号、歌词与 source reference", async () => {
    const score = buildPianoScore(await readPptxSource(hymn154));
    const allEvents = events(score);
    const dottedThree = allEvents.find(
      (event) =>
        event.kind === "note" &&
        event.degree === 3 &&
        event.duration === 0.75 &&
        event.raw_glyphs.includes("eo"),
    );

    expect(dottedThree).toBeDefined();
    expect(dottedThree?.sources[0]).toMatchObject({
      asset: "data/generated/hymn-sources/154.json",
      slide: expect.any(Number),
      shape_id: expect.stringMatching(/^slide-/),
    });
    expect(score.meter?.value).toMatch(/^\d+\/\d+$/);
    expect(score.key_signature).toBeNull();
    expect(
      score.pages.some((page) =>
        page.systems.some((system) => system.lyrics.length > 0),
      ),
    ).toBe(true);
    expect(validateScoreDocument(score)).toEqual([]);
  });

  it("真实 013 按页面、系统、小节生成唯一稳定 ID", async () => {
    const score = buildPianoScore(await readPptxSource(hymn013));
    const ids = events(score).map((event) => event.id);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^h13-p\d+-s\d+-m\d+-e\d+|h13-p\d+-s\d+-(?:tie|slur|accent)-\d+$/.test(id))).toBe(
      true,
    );
    expect(validateScoreDocument(score)).toEqual([]);
  });

  it("真实谱例生成变音、反复、终止线与倍高音事件", async () => {
    const [score023, score101, score127, score185, score696] =
      await Promise.all(
        [hymn023, hymn101, hymn127, hymn185, hymn696].map(async (path) =>
          buildPianoScore(await readPptxSource(path)),
        ),
      );

    expect(
      events(score101).some(
        (event) => event.kind === "note" && event.accidental === "sharp",
      ),
    ).toBe(true);
    expect(
      events(score127).some(
        (event) => event.kind === "note" && event.accidental === "sharp",
      ),
    ).toBe(true);
    expect(
      events(score127).some(
        (event) => event.kind === "note" && event.accidental === "natural",
      ),
    ).toBe(true);
    expect(
      events(score185).some(
        (event) => event.kind === "note" && event.accidental === "flat",
      ),
    ).toBe(true);
    expect(events(score696)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "repeat", direction: "start" }),
        expect.objectContaining({ kind: "repeat", direction: "end" }),
        expect.objectContaining({ kind: "barline", style: "final" }),
      ]),
    );
    expect(events(score023)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "note",
          degree: 2,
          octave: 2,
          raw_glyphs: "–",
        }),
      ]),
    );

    for (const score of [score023, score101, score127, score185, score696]) {
      expect(validateScoreDocument(score)).toEqual([]);
      expect(
        events(score).some(
          (event) =>
            event.kind === "unknown" &&
            ['"', ":", "L", "\uf04c", "[", "\\", "]", "–"].includes(
              event.raw_glyphs,
            ),
        ),
      ).toBe(false);
    }
  });

  it("按 Accent 空间覆盖和两端音高判定 tie 或 slur", () => {
    const source = syntheticSource();
    const score = buildPianoScore(source);
    const allEvents = events(score);
    const relation = allEvents.find(
      (event) => event.kind === "tie" || event.kind === "slur",
    );
    expect(relation).toMatchObject({
      kind: "tie",
      raw_glyphs: "-",
      source_anchor: {
        slide: 1,
        x: 300,
        y: 85,
      },
      sources: [
        expect.objectContaining({ shape_id: "slide-1-shape-accent" }),
      ],
    });
    expect(validateScoreDocument(score)).toEqual([]);
  });

  it("[defect-probing] 所有 Base 与 Accent 事件保留原 PPT 空间锚点", () => {
    const score = buildPianoScore(
      syntheticSource("[1|?0]\\", "zcc3ccZ"),
    );
    const allEvents = events(score);
    const baseEvents = allEvents.filter(
      (event) => !event.id.includes("-accent-"),
    );
    const accentEvents = allEvents.filter((event) =>
      event.id.includes("-accent-"),
    );

    expect(baseEvents.length).toBeGreaterThan(0);
    expect(accentEvents).toHaveLength(1);
    for (const event of baseEvents) {
      const anchor = event.source_anchor;
      expect(anchor).toMatchObject({ slide: 1, y: 125 });
      expect(anchor?.x).toBeGreaterThanOrEqual(100);
      expect(anchor?.x).toBeLessThanOrEqual(500);
    }
    expect(accentEvents[0].source_anchor).toEqual({
      slide: 1,
      x: 300,
      y: 85,
    });
  });

  it("未知 Base 字形保持 unknown 且不具有 degree", () => {
    const source = syntheticSource("1?2", "");
    const score = buildPianoScore(source);
    const unknown = events(score).find((event) => event.kind === "unknown");
    expect(unknown).toMatchObject({
      kind: "unknown",
      raw_glyphs: "?",
      duration: 0,
    });
    expect(unknown).not.toHaveProperty("degree");
    expect(score.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown_base_glyph" }),
      ]),
    );
  });

  it("[defect-probing] PPTX 缺失调拍号时只使用 OCR 顶层元数据回退", () => {
    const source = syntheticSource("1 2 3", "");
    const metadataShape = source.slides[0].shapes.find(
      (shape) => shape.id === "slide-1-shape-meta" && shape.kind === "text",
    );
    if (metadataShape?.kind === "text") {
      metadataShape.paragraphs[0].runs[0].text = "测试诗歌";
    }
    const buildWithFallback = buildPianoScore as unknown as (
      input: PptxSourceDocument,
      options: {
        metadataFallback: {
          filename: string;
          key_signature: string;
          meter: string;
          blocks: Array<{ text: string }>;
        };
      },
    ) => ReturnType<typeof buildPianoScore>;
    const score = buildWithFallback(source, {
      metadataFallback: {
        filename: "999 测试诗歌.jpg",
        key_signature: "降E调",
        meter: "6/8",
        blocks: [{ text: "7 7 7 不得生成音符" }],
      },
    });

    expect(score.key_signature).toEqual({
      value: "E♭",
      sources: [
        {
          asset: "data/hymn-ocr.jsonl",
          slide: 1,
          shape_id: "999 测试诗歌.jpg",
        },
      ],
    });
    expect(score.meter?.value).toBe("6/8");
    expect(score.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "metadata_fallback",
          sources: [
            expect.objectContaining({
              asset: "data/hymn-ocr.jsonl",
              shape_id: "999 测试诗歌.jpg",
            }),
          ],
        }),
      ]),
    );
    expect(
      events(score).filter((event) => event.kind === "note"),
    ).toHaveLength(3);
  });
});

function syntheticSource(
  baseText = "1 1",
  accentText = "-",
): PptxSourceDocument {
  const asset = "data/generated/hymn-sources/999.json";
  return {
    schema: SOURCE_SCHEMA,
    hymn_key: "999",
    title: "测试诗歌",
    source_file: "999 测试诗歌.pptx",
    source_hash: "a".repeat(64),
    generator_version: "test",
    diagnostics: [],
    slides: [
      {
        id: "slide-1",
        number: 1,
        width_emu: 9_144_000,
        height_emu: 5_143_500,
        width: 960,
        height: 540,
        diagnostics: [],
        shapes: [
          {
            id: "slide-1-shape-score",
            kind: "text",
            name: "score",
            order: 1,
            bbox_emu: { x: 100, y: 100, width: 400, height: 50 },
            bbox: { x: 100, y: 100, width: 400, height: 50 },
            rotation: 0,
            source: {
              asset,
              slide: 1,
              shape_id: "slide-1-shape-score",
            },
            paragraphs: [
              {
                id: "score-p0",
                order: 0,
                runs: [
                  {
                    id: "score-r0",
                    text: baseText,
                    font_family: "SimpMusic Base",
                    font_size: 32,
                    bold: false,
                    italic: false,
                    color: null,
                    source: {
                      asset,
                      slide: 1,
                      shape_id: "slide-1-shape-score",
                      paragraph: 0,
                      run: 0,
                    },
                  },
                ],
              },
            ],
          },
          ...(accentText
            ? [
                {
                  id: "slide-1-shape-accent",
                  kind: "text" as const,
                  name: "accent",
                  order: 2,
                  bbox_emu: { x: 90, y: 70, width: 420, height: 30 },
                  bbox: { x: 90, y: 70, width: 420, height: 30 },
                  rotation: 0,
                  source: {
                    asset,
                    slide: 1,
                    shape_id: "slide-1-shape-accent",
                  },
                  paragraphs: [
                    {
                      id: "accent-p0",
                      order: 0,
                      runs: [
                        {
                          id: "accent-r0",
                          text: accentText,
                          font_family: "SimpMusic Accent",
                          font_size: 20,
                          bold: false,
                          italic: false,
                          color: null,
                          source: {
                            asset,
                            slide: 1,
                            shape_id: "slide-1-shape-accent",
                            paragraph: 0,
                            run: 0,
                          },
                        },
                      ],
                    },
                  ],
                },
              ]
            : []),
          {
            id: "slide-1-shape-meta",
            kind: "text",
            name: "metadata",
            order: 3,
            bbox_emu: { x: 20, y: 20, width: 200, height: 30 },
            bbox: { x: 20, y: 20, width: 200, height: 30 },
            rotation: 0,
            source: {
              asset,
              slide: 1,
              shape_id: "slide-1-shape-meta",
            },
            paragraphs: [
              {
                id: "meta-p0",
                order: 0,
                runs: [
                  {
                    id: "meta-r0",
                    text: "1 = C 4/4",
                    font_family: "SimHei",
                    font_size: 18,
                    bold: false,
                    italic: false,
                    color: null,
                    source: {
                      asset,
                      slide: 1,
                      shape_id: "slide-1-shape-meta",
                      paragraph: 0,
                      run: 0,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
