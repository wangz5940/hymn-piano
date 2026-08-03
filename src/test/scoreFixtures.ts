import {
  ARRANGEMENT_SCHEMA,
  SCORE_SCHEMA,
  type PianoArrangementDocument,
  type PianoScoreDocument,
  type SourceReference,
} from "@/features/score/contracts";
import type { HymnCatalogItem } from "@/features/hymns/types";
import type { FontMetricsMeasurer } from "@/features/score/fontAvailability";
import {
  RENDER_SCHEMA,
  type HymnRenderDocument,
  type RenderTextShape,
} from "@/features/score/render-contracts";

export const TEST_HASH = "a".repeat(64);

const source: SourceReference = {
  asset: "data/generated/hymn-sources/1.json",
  slide: 1,
  shape_id: "slide-1-shape-score",
};

export function makeScore(
  overrides: Partial<PianoScoreDocument> = {},
): PianoScoreDocument {
  return {
    schema: SCORE_SCHEMA,
    hymn_key: "1",
    title: "至大医生现今可近",
    content_hash: TEST_HASH,
    source: {
      asset: source.asset,
      source_hash: TEST_HASH,
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
            phrases: [{ id: "phrase-1", measure_ids: ["measure-1"] }],
            measures: [
              {
                id: "measure-1",
                number: 1,
                events: [
                  {
                    id: "note-1",
                    kind: "note",
                    measure_id: "measure-1",
                    beat: 0,
                    duration: 1,
                    degree: 1,
                    accidental: null,
                    octave: 0,
                    augmentation_dots: 0,
                    beams: 0,
                    raw_glyphs: "1",
                    sources: [source],
                  },
                  {
                    id: "note-2",
                    kind: "note",
                    measure_id: "measure-1",
                    beat: 1,
                    duration: 1,
                    degree: 5,
                    accidental: null,
                    octave: 1,
                    augmentation_dots: 0,
                    beams: 0,
                    raw_glyphs: "T",
                    sources: [source],
                  },
                  {
                    id: "bar-1",
                    kind: "barline",
                    measure_id: "measure-1",
                    beat: 2,
                    duration: 0,
                    style: "final",
                    raw_glyphs: "|",
                    sources: [source],
                  },
                ],
              },
            ],
            lyrics: [
              {
                id: "lyric-1",
                verse: "1",
                text: "至大医生现今可近",
                event_ids: ["note-1", "note-2"],
                sources: [source],
              },
            ],
          },
        ],
      },
    ],
    diagnostics: [],
    ...overrides,
  };
}

function recommendation(text: string) {
  return {
    status: "auto_candidate" as const,
    text,
    reason: "根据本曲谱面生成。",
  };
}

export function makeArrangement(
  overrides: Partial<PianoArrangementDocument> = {},
): PianoArrangementDocument {
  return {
    schema: ARRANGEMENT_SCHEMA,
    hymn_key: "1",
    score_hash: TEST_HASH,
    content_hash: TEST_HASH,
    fingerings: [
      {
        event_id: "note-1",
        finger: 1,
        hand: "right",
        status: "auto_candidate",
        confidence: 0.82,
        reason: "主音用 1 指建立手位。",
      },
      {
        event_id: "note-2",
        finger: 5,
        hand: "right",
        status: "auto_candidate",
        confidence: 0.82,
        reason: "高音 5 用 5 指。",
      },
    ],
    positions: [
      {
        id: "position-1",
        start_event_id: "note-1",
        end_event_id: "note-2",
        label: "E♭ Position",
        finger_notes: {
          1: "E♭",
          2: "F",
          3: "G",
          4: "A♭",
          5: "B♭",
        },
        status: "auto_candidate",
        confidence: 0.82,
        reason: "固定手位覆盖本句。",
      },
    ],
    moves: [],
    chords: [
      {
        id: "chord-1",
        measure_id: "measure-1",
        beat: 0,
        display_default: true,
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
        confidence: 0.8,
        evidence: ["强拍旋律为主音"],
        alternatives: ["V"],
        reason: "起句建立主调。",
      },
    ],
    accompaniment: recommendation("6/8 两大拍伴奏"),
    intro: recommendation("取末句两小节"),
    interlude: recommendation("重复末句"),
    ending: recommendation("在主和弦上延长"),
    ...overrides,
  };
}

function renderShape(
  id: string,
  role: RenderTextShape["role"],
  text: string,
  y: number,
): RenderTextShape {
  return {
    id,
    role,
    name: id,
    order: role === "lyric" ? 2 : 1,
    bbox_emu: { x: 952_500, y: y * 9_525, width: 7_620_000, height: 476_250 },
    bbox: { x: 100, y, width: 800, height: 50 },
    rotation: 0,
    source,
    paragraphs: [
      {
        id: `${id}-paragraph-1`,
        order: 0,
        runs: [
          {
            id: `${id}-run-1`,
            text,
            font_family: role === "lyric" ? "SimHei" : "SimpMusic Base",
            font_size: 28,
            bold: false,
            italic: false,
            color: null,
            source,
          },
        ],
      },
    ],
  };
}

export function makeRender(
  overrides: Partial<HymnRenderDocument> = {},
): HymnRenderDocument {
  return {
    schema: RENDER_SCHEMA,
    hymn_key: "1",
    title: "至大医生现今可近",
    source_hash: TEST_HASH,
    generator_version: "test",
    content_hash: TEST_HASH,
    variants: [
      {
        id: "variant-1",
        index: 0,
        fingerprint: TEST_HASH,
        canonical_slide: 1,
        source_slides: [1, 2],
        page: {
          width: 960,
          height: 540,
          view_box: [0, 0, 960, 540],
        },
        score_shapes: [renderShape("score-shape", "score", "t|5", 80)],
        media_shapes: [],
        lyric_versions: [
          {
            id: "lyrics-slide-1",
            source_slide: 1,
            shapes: [renderShape("lyric-shape-1", "lyric", "第一段歌词", 140)],
          },
        ],
      },
    ],
    ...overrides,
  };
}

export function makeHymn(
  overrides: Partial<HymnCatalogItem> = {},
): HymnCatalogItem {
  return {
    key: "1",
    number: 1,
    variant: "",
    title: "至大医生现今可近",
    filename: "1 至大医生现今可近.jpg",
    image_url: "/歌谱/1.jpg",
    is_alternate_tune: false,
    score_source: "pptx",
    score_schema: SCORE_SCHEMA,
    arrangement_schema: ARRANGEMENT_SCHEMA,
    render_schema: RENDER_SCHEMA,
    score_asset_url: "/materials/hymns/1/score.json",
    arrangement_asset_url: "/materials/hymns/1/arrangement.json",
    render_asset_url: "/materials/hymns/1/render.json",
    render_variant: 0,
    fallback_reason: null,
    ...overrides,
  };
}

export function availableFontSet() {
  return {
    ready: Promise.resolve(),
    check: (font: string) => !font.includes("__shiqin_missing_"),
    load: async () => [],
  };
}

export function availableFontMetrics(): FontMetricsMeasurer {
  return (font) => {
    const isBase = font.includes('"SimpMusic Base"');
    const isAccent = font.includes('"SimpMusic Accent"');
    return {
      width: isBase ? 67 : isAccent ? 53 : 40,
      actualBoundingBoxLeft: isAccent ? 2 : 0,
      actualBoundingBoxRight: isBase ? 66 : isAccent ? 51 : 40,
      actualBoundingBoxAscent: isBase ? 19 : 12,
      actualBoundingBoxDescent: 3,
    };
  };
}
