import { posix } from "node:path";
import type {
  PptxSourceDocument,
  SourceMediaShape,
  SourceSlide,
  SourceTextShape,
} from "../../src/features/score/contracts";
import {
  RENDER_SCHEMA,
  assertRenderDocument,
  type HymnRenderDocument,
  type RenderLyricVersion,
  type RenderMediaShape,
  type RenderShapeRole,
  type RenderTextShape,
  type RenderVariant,
} from "../../src/features/score/render-contracts";
import { withDocumentContentHash } from "./content-hash";
import { scoreSlideFingerprint } from "./dedupe";

export const RENDER_GENERATOR_VERSION = "render-builder/v3";

const BASE_FONT = "SimpMusic Base";
const ACCENT_FONT = "SimpMusic Accent";
const CJK_PATTERN = /[\u3400-\u9fff]/u;
const EDITORIAL_NOTE_PATTERN = /^\s*[（(]?注[：:]/u;
const MIN_LYRIC_WIDTH_RATIO = 0.4;

function shapeRuns(shape: SourceTextShape) {
  return shape.paragraphs.flatMap((paragraph) => paragraph.runs);
}

function hasFont(shape: SourceTextShape, family: string): boolean {
  return shapeRuns(shape).some(
    (run) => run.font_family?.trim() === family,
  );
}

function isScoreShape(shape: SourceTextShape): boolean {
  return hasFont(shape, BASE_FONT) || hasFont(shape, ACCENT_FONT);
}

function shapeText(shape: SourceTextShape): string {
  return shapeRuns(shape)
    .map((run) => run.text)
    .join("");
}

function isLyricShape(
  shape: SourceTextShape,
  slide: SourceSlide,
  firstScoreY: number,
): boolean {
  const text = shapeText(shape).trim();
  return (
    !isScoreShape(shape) &&
    CJK_PATTERN.test(text) &&
    !EDITORIAL_NOTE_PATTERN.test(text) &&
    shape.bbox.width >= slide.width * MIN_LYRIC_WIDTH_RATIO &&
    shape.bbox.y >= firstScoreY
  );
}

function renderRole(shape: SourceTextShape): RenderShapeRole {
  if (hasFont(shape, BASE_FONT)) return "score";
  if (hasFont(shape, ACCENT_FONT)) return "accent";
  return "lyric";
}

function toRenderShape(shape: SourceTextShape): RenderTextShape {
  return {
    id: shape.id,
    role: renderRole(shape),
    name: shape.name,
    order: shape.order,
    bbox_emu: { ...shape.bbox_emu },
    bbox: { ...shape.bbox },
    rotation: shape.rotation,
    source: { ...shape.source },
    paragraphs: shape.paragraphs.map((paragraph) => ({
      id: paragraph.id,
      order: paragraph.order,
      runs: paragraph.runs.map((run) => ({
        id: run.id,
        text: run.text,
        font_family: run.font_family,
        font_size: run.font_size,
        character_spacing: run.character_spacing ?? null,
        bold: run.bold,
        italic: run.italic,
        color: run.color,
        source: { ...run.source },
      })),
    })),
  };
}

function toRenderMediaShape(
  shape: SourceMediaShape,
  hymnKey: string,
): RenderMediaShape {
  const filename = posix.basename(shape.media_path);
  const external = /^[a-z][a-z\d+.-]*:/iu.test(shape.media_path);
  return {
    id: shape.id,
    name: shape.name,
    order: shape.order,
    bbox_emu: { ...shape.bbox_emu },
    bbox: { ...shape.bbox },
    rotation: shape.rotation,
    source: { ...shape.source },
    media_path: shape.media_path,
    asset_url: external
      ? shape.media_path
      : `/materials/hymns/${hymnKey}/media/${encodeURIComponent(filename)}`,
  };
}

function scoreShapes(slide: SourceSlide): RenderTextShape[] {
  return slide.shapes
    .filter((shape): shape is SourceTextShape => shape.kind === "text")
    .filter(isScoreShape)
    .sort(
      (left, right) =>
        left.bbox.y - right.bbox.y ||
        left.bbox.x - right.bbox.x ||
        left.id.localeCompare(right.id),
    )
    .map(toRenderShape);
}

function mediaShapes(
  slide: SourceSlide,
  hymnKey: string,
): RenderMediaShape[] {
  return slide.shapes
    .filter((shape): shape is SourceMediaShape => shape.kind === "media")
    .sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    )
    .map((shape) => toRenderMediaShape(shape, hymnKey));
}

function lyricVersion(
  slide: SourceSlide,
  variantIndex: number,
): RenderLyricVersion {
  const firstScoreY = Math.min(
    ...slide.shapes
      .filter((shape): shape is SourceTextShape => shape.kind === "text")
      .filter((shape) => hasFont(shape, BASE_FONT))
      .map((shape) => shape.bbox.y),
  );
  return {
    id: `variant-${variantIndex + 1}-lyrics-slide-${slide.number}`,
    source_slide: slide.number,
    shapes: slide.shapes
      .filter((shape): shape is SourceTextShape => shape.kind === "text")
      .filter((shape) => isLyricShape(shape, slide, firstScoreY))
      .sort(
        (left, right) =>
          left.bbox.y - right.bbox.y ||
          left.bbox.x - right.bbox.x ||
          left.id.localeCompare(right.id),
      )
      .map(toRenderShape),
  };
}

function buildVariant(
  slides: SourceSlide[],
  fingerprint: string,
  index: number,
  hymnKey: string,
): RenderVariant {
  const orderedSlides = [...slides].sort(
    (left, right) => left.number - right.number,
  );
  const canonical = orderedSlides[0];
  return {
    id: `variant-${index + 1}`,
    index,
    fingerprint,
    canonical_slide: canonical.number,
    source_slides: orderedSlides.map((slide) => slide.number),
    page: {
      width: canonical.width,
      height: canonical.height,
      view_box: [0, 0, canonical.width, canonical.height],
    },
    score_shapes: scoreShapes(canonical),
    media_shapes: mediaShapes(canonical, hymnKey),
    lyric_versions: [lyricVersion(canonical, index)],
  };
}

export function buildRenderDocument(
  source: PptxSourceDocument,
): HymnRenderDocument {
  const groups = new Map<
    string,
    { firstSlide: number; slides: SourceSlide[] }
  >();

  for (const slide of source.slides) {
    if (scoreShapes(slide).length === 0) continue;
    const fingerprint = scoreSlideFingerprint(slide);
    const current = groups.get(fingerprint) ?? {
      firstSlide: slide.number,
      slides: [],
    };
    current.firstSlide = Math.min(current.firstSlide, slide.number);
    current.slides.push(slide);
    groups.set(fingerprint, current);
  }

  const variants = [...groups.entries()]
    .sort(
      ([leftFingerprint, left], [rightFingerprint, right]) =>
        left.firstSlide - right.firstSlide ||
        leftFingerprint.localeCompare(rightFingerprint),
    )
    .map(([fingerprint, group], index) =>
      buildVariant(group.slides, fingerprint, index, source.hymn_key),
    );

  const document = withDocumentContentHash({
    schema: RENDER_SCHEMA,
    hymn_key: source.hymn_key,
    title: source.title,
    source_hash: source.source_hash,
    generator_version: RENDER_GENERATOR_VERSION,
    variants,
  });
  assertRenderDocument(document);
  return document;
}
