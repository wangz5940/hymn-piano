import {
  ARRANGEMENT_SCHEMA,
  SCORE_SCHEMA,
  SOURCE_SCHEMA,
  assertArrangementDocument,
  assertCatalogEntry,
  assertScoreDocument,
  assertSourceDocument,
  validateArrangementDocument,
  validateCatalogEntry,
  validateScoreDocument,
  validateSourceDocument,
} from "./contracts";
import type {
  PianoArrangementDocument,
  PianoScoreDocument,
  PptxSourceDocument,
  SourceReference,
} from "./contracts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const source: SourceReference = {
  asset: "data/generated/hymn-sources/1.json",
  slide: 1,
  shape_id: "slide-1-shape-2",
  paragraph: 0,
  run: 0,
};

function makeSourceDocument(): PptxSourceDocument {
  return {
    schema: SOURCE_SCHEMA,
    hymn_key: "1",
    title: "至大医生",
    source_file: "712首-文字/001 至大医生.pptx",
    source_hash: HASH_A,
    generator_version: "test",
    slides: [
      {
        id: "slide-1",
        number: 1,
        width_emu: 9_144_000,
        height_emu: 5_143_500,
        width: 960,
        height: 540,
        shapes: [
          {
            id: "slide-1-shape-2",
            kind: "text",
            name: "TextBox 2",
            order: 2,
            bbox_emu: { x: 1, y: 2, width: 3, height: 4 },
            bbox: { x: 1, y: 2, width: 3, height: 4 },
            rotation: 0,
            source,
            paragraphs: [
              {
                id: "slide-1-shape-2-p0",
                order: 0,
                runs: [
                  {
                    id: "slide-1-shape-2-p0-r0",
                    text: "eod",
                    font_family: "SimpMusic Base",
                    font_size: 24,
                    bold: false,
                    italic: false,
                    color: null,
                    source,
                  },
                ],
              },
            ],
          },
        ],
        diagnostics: [],
      },
    ],
    diagnostics: [],
  };
}

function makeScore(): PianoScoreDocument {
  return {
    schema: SCORE_SCHEMA,
    hymn_key: "1",
    title: "至大医生",
    content_hash: HASH_B,
    source: {
      asset: "data/generated/hymn-sources/1.json",
      source_hash: HASH_A,
      decoder_version: "test",
    },
    key_signature: { value: "E♭", sources: [source] },
    meter: { value: "6/8", sources: [source] },
    pages: [
      {
        id: "page-1",
        source_slides: [1],
        systems: [
          {
            id: "system-1",
            measures: [
              {
                id: "measure-1",
                number: 1,
                events: [
                  {
                    id: "event-1",
                    measure_id: "measure-1",
                    kind: "note",
                    beat: 0,
                    duration: 1,
                    degree: 1,
                    accidental: null,
                    octave: 0,
                    augmentation_dots: 0,
                    beams: 0,
                    raw_glyphs: "e",
                    sources: [source],
                    source_anchor: { slide: 1, x: 12.5, y: 24.75 },
                  },
                  {
                    id: "event-2",
                    measure_id: "measure-1",
                    kind: "rest",
                    beat: 1,
                    duration: 1,
                    augmentation_dots: 0,
                    beams: 0,
                    raw_glyphs: "0",
                    sources: [source],
                  },
                ],
              },
            ],
            phrases: [{ id: "phrase-1", measure_ids: ["measure-1"] }],
            lyrics: [
              {
                id: "lyric-1",
                verse: "1",
                text: "至大医生",
                event_ids: ["event-1"],
                sources: [source],
              },
            ],
          },
        ],
      },
    ],
    diagnostics: [],
  };
}

function makeArrangement(): PianoArrangementDocument {
  return {
    schema: ARRANGEMENT_SCHEMA,
    hymn_key: "1",
    score_hash: HASH_B,
    content_hash: HASH_A,
    fingerings: [
      {
        event_id: "event-1",
        finger: 1,
        hand: "right",
        status: "auto_candidate",
        confidence: 0.8,
        reason: "主音起句保持自然手位。",
      },
    ],
    positions: [
      {
        id: "position-1",
        start_event_id: "event-1",
        end_event_id: "event-1",
        label: "E♭ Position",
        finger_notes: { 1: "E♭", 2: "F", 3: "G" },
        status: "auto_candidate",
        confidence: 0.8,
        reason: "乐句在五指范围内。",
      },
    ],
    moves: [],
    chords: [
      {
        id: "chord-1",
        measure_id: "measure-1",
        beat: 0,
        display_default: false,
        symbol: "E♭",
        function: "I",
        bass: "E♭",
        inversion: "root",
        tones: [
          { note: "E♭", finger: 5 },
          { note: "G", finger: 3 },
          { note: "B♭", finger: 1 },
        ],
        status: "auto_candidate",
        confidence: 0.7,
        evidence: ["强拍旋律为主音"],
        alternatives: [],
        reason: "起句建立主调。",
      },
    ],
    accompaniment: {
      status: "auto_candidate",
      text: "两大拍型",
      reason: "拍号为 6/8。",
    },
    intro: {
      status: "auto_candidate",
      text: "末句两小节",
      reason: "建立调性。",
    },
    interlude: {
      status: "auto_candidate",
      text: "重复末句",
      reason: "保持会众入口。",
    },
    ending: {
      status: "auto_candidate",
      text: "V-I",
      reason: "明确终止。",
    },
  };
}

describe("乐谱数据契约", () => {
  it("接受来源、谱面、编配和目录的合法文档", () => {
    const sourceDocument = makeSourceDocument();
    const score = makeScore();
    const arrangement = makeArrangement();
    const catalog = {
      hymn_key: "1",
      score_source: "pptx",
      score_schema: SCORE_SCHEMA,
      arrangement_schema: ARRANGEMENT_SCHEMA,
      score_asset_url: "/materials/hymns/1/score.json",
      arrangement_asset_url: "/materials/hymns/1/arrangement.json",
      image_url: "/歌谱/1.jpg",
      fallback_reason: null,
    };

    expect(validateSourceDocument(sourceDocument)).toEqual([]);
    expect(validateScoreDocument(score)).toEqual([]);
    expect(validateArrangementDocument(score, arrangement)).toEqual([]);
    expect(validateCatalogEntry(catalog)).toEqual([]);
    expect(() => assertSourceDocument(sourceDocument)).not.toThrow();
    expect(() => assertScoreDocument(score)).not.toThrow();
    expect(() => assertArrangementDocument(score, arrangement)).not.toThrow();
    expect(() => assertCatalogEntry(catalog)).not.toThrow();
  });

  it("拒绝缺失来源引用", () => {
    const sourceDocument = makeSourceDocument() as unknown as {
      slides: Array<{ shapes: Array<{ paragraphs: Array<{ runs: Array<{ source?: SourceReference }> }> }> }>;
    };
    delete sourceDocument.slides[0].shapes[0].paragraphs[0].runs[0].source;

    const score = makeScore();
    score.pages[0].systems[0].measures[0].events[0].sources = [];

    expect(validateSourceDocument(sourceDocument)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_source" })]),
    );
    expect(validateScoreDocument(score)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_source" })]),
    );
  });

  it("[defect-probing] 接受可选的合法 source anchor，拒绝非有限坐标和非正 slide", () => {
    const score = makeScore();
    const note = score.pages[0].systems[0].measures[0].events[0];
    note.source_anchor = { slide: 1, x: 120.5, y: 240.25 };

    expect(validateScoreDocument(score)).toEqual([]);
    expect(
      score.pages[0].systems[0].measures[0].events[1].source_anchor,
    ).toBeUndefined();

    const invalidAnchors = [
      { slide: 0, x: 120.5, y: 240.25 },
      { slide: 1, x: Number.NaN, y: 240.25 },
      { slide: 1, x: 120.5, y: Number.POSITIVE_INFINITY },
    ];
    for (const sourceAnchor of invalidAnchors) {
      note.source_anchor = sourceAnchor;
      expect(validateScoreDocument(score)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining(".source_anchor"),
            code: "invalid_source_anchor",
          }),
        ]),
      );
    }
  });

  it("拒绝悬空 eventId 和非法指法", () => {
    const score = makeScore();
    const arrangement = makeArrangement() as unknown as {
      fingerings: Array<{ event_id: string; finger: number }>;
    };
    arrangement.fingerings[0].event_id = "event-missing";
    arrangement.fingerings[0].finger = 6;

    expect(validateArrangementDocument(score, arrangement)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "dangling_event_id" }),
        expect.objectContaining({ code: "invalid_finger" }),
      ]),
    );
  });

  it("和弦默认展示状态必须与候选或确认来源一致", () => {
    const score = makeScore();
    const arrangement = makeArrangement();
    arrangement.chords[0].display_default = true;

    expect(validateArrangementDocument(score, arrangement)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "display_status_mismatch" }),
      ]),
    );

    arrangement.chords[0].status = "manual_confirmed";
    expect(validateArrangementDocument(score, arrangement)).toEqual([]);

    const missingDisplay = makeArrangement() as unknown as {
      chords: Array<{ display_default?: boolean }>;
    };
    delete missingDisplay.chords[0].display_default;
    expect(validateArrangementDocument(score, missingDisplay)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_display_default" }),
      ]),
    );
  });

  it("拒绝跨原调和第二调引用", () => {
    const score = makeScore();
    const arrangement = makeArrangement();
    arrangement.hymn_key = "1b";

    expect(validateArrangementDocument(score, arrangement)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "cross_version" })]),
    );
    expect(
      validateCatalogEntry({
        hymn_key: "118b",
        score_source: "pptx",
        score_schema: SCORE_SCHEMA,
        arrangement_schema: ARRANGEMENT_SCHEMA,
        score_asset_url: "/materials/hymns/118/score.json",
        arrangement_asset_url: "/materials/hymns/118/arrangement.json",
        image_url: "/歌谱/118b.jpg",
        fallback_reason: null,
      }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "cross_version" })]),
    );
  });
});
