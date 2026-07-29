import { createHash } from "node:crypto";
import type {
  PianoScoreDocument,
  PptxSourceDocument,
  ScoreEvent,
  ScoreLyric,
  ScorePage,
  SourceSlide,
  SourceTextShape,
} from "../../src/features/score/contracts";
import { normalizedGlyph } from "./simpmusic-map";
import { withDocumentContentHash } from "./content-hash";

const BASE_FONT = "SimpMusic Base";
const ACCENT_FONT = "SimpMusic Accent";

export interface ScoreDedupeResult {
  score: PianoScoreDocument;
  original_page_count: number;
  unique_page_count: number;
  duplicate_page_count: number;
  groups: Array<{
    fingerprint: string;
    source_slides: number[];
  }>;
}

function roundRatio(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) {
    return 0;
  }
  return Number((value / total).toFixed(6));
}

function normalizeBaseText(text: string): string {
  return Array.from(text, normalizedGlyph).join("").replace(/\s+/gu, "");
}

function normalizedRuns(shape: SourceTextShape) {
  const families = new Map<
    string,
    {
      family: string;
      text: string;
      font_sizes: Set<number | null>;
      bold: Set<boolean>;
      italic: Set<boolean>;
      colors: Set<string | null>;
    }
  >();

  for (const paragraph of shape.paragraphs) {
    for (const run of paragraph.runs) {
      const family = run.font_family?.trim() ?? "";
      if (family !== BASE_FONT && family !== ACCENT_FONT) continue;
      const current = families.get(family) ?? {
        family,
        text: "",
        font_sizes: new Set<number | null>(),
        bold: new Set<boolean>(),
        italic: new Set<boolean>(),
        colors: new Set<string | null>(),
      };
      current.text +=
        family === BASE_FONT
          ? normalizeBaseText(run.text)
          : run.text.replace(/\s+/gu, "");
      current.font_sizes.add(run.font_size);
      current.bold.add(run.bold);
      current.italic.add(run.italic);
      current.colors.add(run.color);
      families.set(family, current);
    }
  }

  return [...families.values()]
    .map((item) => ({
      family: item.family,
      text: item.text,
      font_sizes: [...item.font_sizes].sort(compareNullable),
      bold: [...item.bold].sort(),
      italic: [...item.italic].sort(),
      colors: [...item.colors].sort(compareNullable),
    }))
    .sort((left, right) => left.family.localeCompare(right.family));
}

function compareNullable<T extends number | string>(
  left: T | null,
  right: T | null,
): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return left < right ? -1 : 1;
}

export function scoreSlideFingerprint(slide: SourceSlide): string {
  const scoreShapes = slide.shapes
    .filter((shape): shape is SourceTextShape => shape.kind === "text")
    .flatMap((shape) => {
      const runs = normalizedRuns(shape);
      if (runs.length === 0) return [];
      return [
        {
          x: roundRatio(shape.bbox.x, slide.width),
          y: roundRatio(shape.bbox.y, slide.height),
          width: roundRatio(shape.bbox.width, slide.width),
          height: roundRatio(shape.bbox.height, slide.height),
          rotation: Number(shape.rotation.toFixed(4)),
          runs,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.y - right.y ||
        left.x - right.x ||
        JSON.stringify(left.runs).localeCompare(JSON.stringify(right.runs)),
    );

  return createHash("sha256")
    .update(JSON.stringify(scoreShapes))
    .digest("hex");
}

function eventIds(page: ScorePage): string[] {
  return page.systems.flatMap((system) =>
    system.measures.flatMap((measure) =>
      measure.events
        .filter(
          (event) => event.kind === "note" || event.kind === "rest",
        )
        .map((event) => event.id),
    ),
  );
}

function remapLyric(
  lyric: ScoreLyric,
  eventMap: ReadonlyMap<string, string>,
  id: string,
): ScoreLyric {
  return {
    ...lyric,
    id,
    event_ids: lyric.event_ids
      .map((eventId) => eventMap.get(eventId))
      .filter((eventId): eventId is string => Boolean(eventId)),
  };
}

function lyricIdentity(lyric: ScoreLyric): string {
  return JSON.stringify({
    verse: lyric.verse,
    text: lyric.text,
    slides: lyric.sources.map((source) => source.slide),
  });
}

function mergePageLyrics(target: ScorePage, duplicate: ScorePage): void {
  const sourceEvents = eventIds(duplicate);
  const targetEvents = eventIds(target);
  const eventMap = new Map(
    sourceEvents.map((sourceId, index) => [
      sourceId,
      targetEvents[index] ?? "",
    ]),
  );

  duplicate.systems.forEach((duplicateSystem, systemIndex) => {
    const targetSystem = target.systems[systemIndex];
    if (!targetSystem) return;
    const identities = new Set(targetSystem.lyrics.map(lyricIdentity));
    for (const lyric of duplicateSystem.lyrics) {
      const identity = lyricIdentity(lyric);
      if (identities.has(identity)) continue;
      const next = remapLyric(
        lyric,
        eventMap,
        `${targetSystem.id}-lyric-${targetSystem.lyrics.length + 1}`,
      );
      targetSystem.lyrics.push(next);
      identities.add(identity);
    }
  });
}

export function dedupeScorePages(
  source: PptxSourceDocument,
  score: PianoScoreDocument,
): ScoreDedupeResult {
  const sourceBySlide = new Map(
    source.slides.map((slide) => [slide.number, slide]),
  );
  const pages: ScorePage[] = [];
  const pageByFingerprint = new Map<string, ScorePage>();
  const groups = new Map<string, number[]>();

  for (const page of score.pages) {
    const sourceSlide = sourceBySlide.get(page.source_slides[0]);
    const fingerprint = sourceSlide
      ? scoreSlideFingerprint(sourceSlide)
      : createHash("sha256").update(page.id).digest("hex");
    const group = groups.get(fingerprint) ?? [];
    group.push(...page.source_slides);
    groups.set(fingerprint, group);

    const existing = pageByFingerprint.get(fingerprint);
    if (!existing) {
      const copied = structuredClone(page);
      pages.push(copied);
      pageByFingerprint.set(fingerprint, copied);
      continue;
    }
    existing.source_slides = [
      ...new Set([...existing.source_slides, ...page.source_slides]),
    ].sort((left, right) => left - right);
    mergePageLyrics(existing, page);
  }

  const deduped: PianoScoreDocument = withDocumentContentHash({
    schema: score.schema,
    hymn_key: score.hymn_key,
    title: score.title,
    source: score.source,
    key_signature: score.key_signature,
    meter: score.meter,
    pages,
    diagnostics: score.diagnostics,
  });
  return {
    score: deduped,
    original_page_count: score.pages.length,
    unique_page_count: pages.length,
    duplicate_page_count: score.pages.length - pages.length,
    groups: [...groups.entries()]
      .map(([fingerprint, sourceSlides]) => ({
        fingerprint,
        source_slides: [...new Set(sourceSlides)].sort(
          (left, right) => left - right,
        ),
      }))
      .sort(
        (left, right) =>
          left.source_slides[0] - right.source_slides[0],
      ),
  };
}

export function timedEvents(page: ScorePage): ScoreEvent[] {
  return page.systems.flatMap((system) =>
    system.measures.flatMap((measure) =>
      measure.events.filter(
        (event) => event.kind === "note" || event.kind === "rest",
      ),
    ),
  );
}
