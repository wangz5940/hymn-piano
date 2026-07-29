import {
  SCORE_SCHEMA,
  type ContractDiagnostic,
  type PianoScoreDocument,
  type PptxSourceDocument,
  type ScoreBarlineEvent,
  type ScoreEvent,
  type ScoreLyric,
  type ScoreMeasure,
  type ScoreNoteEvent,
  type ScorePhrase,
  type ScoreSystem,
  type ScoreUnknownEvent,
  type ScoreValueWithSource,
  type SourceReference,
  type SourceTextRun,
  type SourceTextShape,
} from "../../src/features/score/contracts";
import {
  decodeSimpMusicAccent,
  lexSimpMusicBase,
  reduceGlyphTokens,
  type AccentToken,
  type DecodedSimpMusicEvent,
  type GlyphToken,
} from "./simpmusic-decoder";
import { SIMPMUSIC_DECODER_VERSION } from "./simpmusic-map";
import {
  applyOcrMetadataFallback,
  type ScoreMetadataFallback,
} from "./ocr-metadata";
import { withDocumentContentHash } from "./content-hash";

const BASE_FONT = "SimpMusic Base";
const ACCENT_FONT = "SimpMusic Accent";
const ROW_TOLERANCE = 12;

interface SpatialDecodedEvent {
  decoded: DecodedSimpMusicEvent;
  x: number;
  shape: SourceTextShape;
}

interface ScoreRow {
  centerY: number;
  shapes: SourceTextShape[];
}

interface BuiltSystem {
  system: ScoreSystem;
  row: ScoreRow;
  noteAnchors: Array<{ x: number; event: ScoreNoteEvent }>;
  eventAnchors: Array<{ x: number; event: ScoreEvent }>;
}

interface AccentShape {
  shape: SourceTextShape;
  tokens: AccentToken[];
}

function isFont(run: SourceTextRun, family: string): boolean {
  return run.font_family?.trim().toLowerCase() === family.toLowerCase();
}

function textRuns(shape: SourceTextShape): SourceTextRun[] {
  return shape.paragraphs.flatMap((paragraph) => paragraph.runs);
}

function shapeText(shape: SourceTextShape): string {
  return textRuns(shape)
    .map((run) => run.text)
    .join("");
}

function fontRuns(shape: SourceTextShape, family: string): SourceTextRun[] {
  return textRuns(shape).filter((run) => isFont(run, family));
}

function containsFont(shape: SourceTextShape, family: string): boolean {
  return fontRuns(shape, family).length > 0;
}

function centerY(shape: SourceTextShape): number {
  return shape.bbox.y + shape.bbox.height / 2;
}

function right(shape: SourceTextShape): number {
  return shape.bbox.x + shape.bbox.width;
}

function sourceAnchor(shape: SourceTextShape, x: number) {
  return {
    slide: shape.source.slide,
    x,
    y: centerY(shape),
  };
}

function groupScoreRows(shapes: SourceTextShape[]): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const shape of [...shapes].sort(
    (left, rightShape) =>
      centerY(left) - centerY(rightShape) ||
      left.bbox.x - rightShape.bbox.x ||
      left.order - rightShape.order,
  )) {
    const match = rows.find(
      (row) => Math.abs(row.centerY - centerY(shape)) <= ROW_TOLERANCE,
    );
    if (match) {
      match.shapes.push(shape);
      match.centerY =
        match.shapes.reduce((sum, item) => sum + centerY(item), 0) /
        match.shapes.length;
    } else {
      rows.push({ centerY: centerY(shape), shapes: [shape] });
    }
  }
  return rows.map((row) => ({
    ...row,
    shapes: row.shapes.sort(
      (left, rightShape) =>
        left.bbox.x - rightShape.bbox.x || left.order - rightShape.order,
    ),
  }));
}

function shiftToken(token: GlyphToken, offset: number): GlyphToken {
  return { ...token, start: token.start + offset, end: token.end + offset };
}

function decodeScoreShape(
  shape: SourceTextShape,
  diagnostics: ContractDiagnostic[],
): SpatialDecodedEvent[] {
  const runs = fontRuns(shape, BASE_FONT);
  const tokens: GlyphToken[] = [];
  let textLength = 0;
  for (const run of runs) {
    const decoded = lexSimpMusicBase(run.text, run.source);
    diagnostics.push(...decoded.diagnostics);
    tokens.push(...decoded.tokens.map((token) => shiftToken(token, textLength)));
    textLength += run.text.length;
  }
  const reduced = reduceGlyphTokens(tokens);
  diagnostics.push(...reduced.diagnostics);
  const denominator = Math.max(1, textLength);
  return reduced.events.map((decoded) => ({
    decoded,
    x:
      shape.bbox.x +
      ((decoded.start + decoded.end) / 2 / denominator) * shape.bbox.width,
    shape,
  }));
}

function sourceForEvent(event: DecodedSimpMusicEvent): SourceReference[] {
  return event.sources.length > 0 ? event.sources : [];
}

function closeMeasure(
  rawMeasures: SpatialDecodedEvent[][],
  current: SpatialDecodedEvent[],
) {
  if (current.length > 0) rawMeasures.push([...current]);
  current.length = 0;
}

function splitMeasures(events: SpatialDecodedEvent[]): SpatialDecodedEvent[][] {
  const measures: SpatialDecodedEvent[][] = [];
  const current: SpatialDecodedEvent[] = [];
  for (const event of events) {
    if (
      event.decoded.kind === "barline" &&
      event.decoded.style === "single" &&
      current.length === 0
    ) {
      continue;
    }
    current.push(event);
    if (
      event.decoded.kind === "barline" ||
      (event.decoded.kind === "repeat" &&
        event.decoded.direction === "end")
    ) {
      closeMeasure(measures, current);
    }
  }
  closeMeasure(measures, current);
  return measures;
}

function buildContractEvent(
  spatial: SpatialDecodedEvent,
  id: string,
  measureId: string,
  beat: number,
): ScoreEvent {
  const common = {
    id,
    measure_id: measureId,
    beat,
    duration: spatial.decoded.duration,
    raw_glyphs: spatial.decoded.raw_glyphs,
    sources: sourceForEvent(spatial.decoded),
    source_anchor: sourceAnchor(spatial.shape, spatial.x),
  };
  if (spatial.decoded.kind === "note") {
    return {
      ...common,
      kind: "note",
      degree: spatial.decoded.degree,
      accidental: spatial.decoded.accidental,
      octave: spatial.decoded.octave,
      augmentation_dots: spatial.decoded.augmentation_dots,
      beams: spatial.decoded.beams,
    };
  }
  if (spatial.decoded.kind === "rest") {
    return {
      ...common,
      kind: "rest",
      augmentation_dots: spatial.decoded.augmentation_dots,
      beams: spatial.decoded.beams,
    };
  }
  if (spatial.decoded.kind === "barline") {
    return { ...common, kind: "barline", style: spatial.decoded.style };
  }
  if (spatial.decoded.kind === "repeat") {
    return {
      ...common,
      kind: "repeat",
      direction: spatial.decoded.direction,
    };
  }
  return {
    ...common,
    kind: "unknown",
    reason: spatial.decoded.reason,
  };
}

function buildSystem(
  hymnKey: string,
  pageNumber: number,
  systemIndex: number,
  row: ScoreRow,
  diagnostics: ContractDiagnostic[],
): BuiltSystem | null {
  const spatialEvents = row.shapes
    .flatMap((shape) => decodeScoreShape(shape, diagnostics))
    .sort(
      (left, rightEvent) =>
        left.x - rightEvent.x ||
        left.shape.order - rightEvent.shape.order ||
        left.decoded.start - rightEvent.decoded.start,
    );
  const rawMeasures = splitMeasures(spatialEvents);
  if (rawMeasures.length === 0) return null;

  const systemId = `h${hymnKey}-p${pageNumber}-s${systemIndex + 1}`;
  const measures: ScoreMeasure[] = [];
  const noteAnchors: BuiltSystem["noteAnchors"] = [];
  const eventAnchors: BuiltSystem["eventAnchors"] = [];

  rawMeasures.forEach((rawMeasure, measureIndex) => {
    const measureId = `${systemId}-m${measureIndex + 1}`;
    let beat = 0;
    const events = rawMeasure.map((spatial, eventIndex) => {
      const event = buildContractEvent(
        spatial,
        `${measureId}-e${eventIndex + 1}`,
        measureId,
        beat,
      );
      eventAnchors.push({ x: spatial.x, event });
      if (event.kind === "note") noteAnchors.push({ x: spatial.x, event });
      if (event.kind === "note" || event.kind === "rest") beat += event.duration;
      return event;
    });
    measures.push({ id: measureId, number: measureIndex + 1, events });
  });

  const phrase: ScorePhrase = {
    id: `${systemId}-phrase-1`,
    measure_ids: measures.map((measure) => measure.id),
  };
  return {
    system: { id: systemId, measures, phrases: [phrase], lyrics: [] },
    row,
    noteAnchors,
    eventAnchors,
  };
}

function nearestBuiltSystem(
  shape: SourceTextShape,
  systems: BuiltSystem[],
): BuiltSystem | undefined {
  return [...systems].sort(
    (left, rightSystem) =>
      Math.abs(left.row.centerY - centerY(shape)) -
      Math.abs(rightSystem.row.centerY - centerY(shape)),
  )[0];
}

function nearestEvent(
  x: number,
  system: BuiltSystem,
): { x: number; event: ScoreEvent } | undefined {
  return [...system.eventAnchors].sort(
    (left, rightEvent) => Math.abs(left.x - x) - Math.abs(rightEvent.x - x),
  )[0];
}

function appendUnknownAccent(
  system: BuiltSystem,
  shape: SourceTextShape,
  token: AccentToken,
  relationIndex: number,
  reason: string,
) {
  const anchor = nearestEvent(shape.bbox.x + shape.bbox.width / 2, system);
  const firstMeasure = system.system.measures[0];
  const measureId = anchor?.event.measure_id ?? firstMeasure.id;
  const targetMeasure =
    system.system.measures.find((measure) => measure.id === measureId) ??
    firstMeasure;
  const event: ScoreUnknownEvent = {
    id: `${system.system.id}-accent-${relationIndex}`,
    measure_id: targetMeasure.id,
    beat: anchor?.event.beat ?? 0,
    duration: 0,
    raw_glyphs: token.raw,
    sources: token.sources,
    source_anchor: sourceAnchor(
      shape,
      shape.bbox.x + shape.bbox.width / 2,
    ),
    kind: "unknown",
    reason,
  };
  targetMeasure.events.push(event);
  system.eventAnchors.push({
    x: shape.bbox.x + shape.bbox.width / 2,
    event,
  });
}

function bindArc(
  system: BuiltSystem,
  shape: SourceTextShape,
  token: Extract<AccentToken, { kind: "arc" }>,
  relationIndex: number,
): boolean {
  const left = shape.bbox.x - 8;
  const rightEdge = right(shape) + 8;
  let candidates = system.noteAnchors.filter(
    (anchor) => anchor.x >= left && anchor.x <= rightEdge,
  );
  if (candidates.length < 2) {
    const center = shape.bbox.x + shape.bbox.width / 2;
    candidates = [...system.noteAnchors]
      .sort(
        (leftAnchor, rightAnchor) =>
          Math.abs(leftAnchor.x - center) - Math.abs(rightAnchor.x - center),
      )
      .slice(0, 2)
      .sort((leftAnchor, rightAnchor) => leftAnchor.x - rightAnchor.x);
  }
  if (candidates.length < 2) return false;
  const from = candidates[0].event;
  const to = candidates[candidates.length - 1].event;
  const relationKind =
    from.degree === to.degree && from.octave === to.octave ? "tie" : "slur";
  const targetMeasure = system.system.measures.find(
    (measure) => measure.id === from.measure_id,
  );
  if (!targetMeasure) return false;
  targetMeasure.events.push({
    id: `${system.system.id}-${relationKind}-${relationIndex}`,
    measure_id: from.measure_id,
    beat: from.beat,
    duration: 0,
    raw_glyphs: token.raw,
    sources: token.sources,
    source_anchor: sourceAnchor(
      shape,
      shape.bbox.x + shape.bbox.width / 2,
    ),
    kind: relationKind,
    from_event_id: from.id,
    to_event_id: to.id,
  });
  return true;
}

function bindAccents(
  accentShapes: AccentShape[],
  systems: BuiltSystem[],
  diagnostics: ContractDiagnostic[],
) {
  let relationIndex = 0;
  for (const item of accentShapes) {
    const system = nearestBuiltSystem(item.shape, systems);
    if (!system) continue;
    for (const token of item.tokens) {
      relationIndex += 1;
      if (token.kind === "arc") {
        if (bindArc(system, item.shape, token, relationIndex)) continue;
        appendUnknownAccent(
          system,
          item.shape,
          token,
          relationIndex,
          "accent_arc_unresolved",
        );
        diagnostics.push({
          code: "accent_arc_unresolved",
          severity: "warning",
          message: "Accent 弧线无法可靠绑定两个音符",
          sources: token.sources,
        });
      } else if (token.kind === "triplet") {
        appendUnknownAccent(
          system,
          item.shape,
          token,
          relationIndex,
          "triplet:3",
        );
        diagnostics.push({
          code: "triplet_detected",
          severity: "info",
          message: "检测到三连音括号，当前 Score v1 以可追溯 unknown 保存",
          sources: token.sources,
        });
      } else if (token.kind === "final_barline_candidate") {
        const barline = [...system.eventAnchors]
          .filter((anchor) => anchor.event.kind === "barline")
          .sort(
            (leftAnchor, rightAnchor) =>
              Math.abs(leftAnchor.x - item.shape.bbox.x) -
              Math.abs(rightAnchor.x - item.shape.bbox.x),
          )[0]?.event as ScoreBarlineEvent | undefined;
        if (barline) {
          barline.style = "final";
        } else {
          appendUnknownAccent(
            system,
            item.shape,
            token,
            relationIndex,
            "final_barline_candidate",
          );
        }
      } else {
        appendUnknownAccent(
          system,
          item.shape,
          token,
          relationIndex,
          token.reason,
        );
      }
    }
  }
}

function shapeSources(shape: SourceTextShape): SourceReference[] {
  const sources = textRuns(shape).map((run) => run.source);
  return sources.length > 0 ? sources : [shape.source];
}

function addLyrics(
  textShapes: SourceTextShape[],
  builtSystems: BuiltSystem[],
) {
  const candidates = textShapes.filter(
    (shape) =>
      !containsFont(shape, BASE_FONT) &&
      !containsFont(shape, ACCENT_FONT) &&
      /[\u3400-\u9fff]/u.test(shapeText(shape)),
  );
  builtSystems.forEach((built, systemIndex) => {
    const nextY =
      builtSystems[systemIndex + 1]?.row.centerY ?? Number.POSITIVE_INFINITY;
    const rowLeft = Math.min(...built.row.shapes.map((shape) => shape.bbox.x));
    const rowRight = Math.max(...built.row.shapes.map(right));
    const lyricShapes = candidates
      .filter(
        (shape) =>
          centerY(shape) > built.row.centerY &&
          centerY(shape) < nextY &&
          right(shape) >= rowLeft &&
          shape.bbox.x <= rowRight,
      )
      .sort(
        (left, rightShape) =>
          centerY(left) - centerY(rightShape) ||
          left.bbox.x - rightShape.bbox.x,
      );
    const eventIds = built.noteAnchors.map((anchor) => anchor.event.id);
    built.system.lyrics = lyricShapes.map((shape, index): ScoreLyric => {
      const text = shapeText(shape).trim();
      const verseMatch = text.match(/^\s*([一二三四五六七八九十\d]+)[、.\s]?/u);
      return {
        id: `${built.system.id}-lyric-${index + 1}`,
        verse: verseMatch?.[1] ?? String(index + 1),
        text,
        event_ids: eventIds,
        sources: shapeSources(shape),
      };
    });
  });
}

function textMetadata(
  document: PptxSourceDocument,
): Array<{ text: string; source: SourceReference }> {
  return document.slides.flatMap((slide) =>
    slide.shapes.flatMap((shape) => {
      if (shape.kind !== "text") return [];
      return textRuns(shape)
        .filter(
          (run) => !isFont(run, BASE_FONT) && !isFont(run, ACCENT_FONT),
        )
        .map((run) => ({ text: run.text, source: run.source }));
    }),
  );
}

function normalizeKey(raw: string): string {
  const value = raw.replace(/\s+/gu, "");
  const chinese = value.match(/^([升降])([A-G])$/u);
  if (chinese) return `${chinese[2]}${chinese[1] === "升" ? "♯" : "♭"}`;
  return value.replace(/#/gu, "♯").replace(/b/gu, "♭");
}

function extractKeySignature(
  metadata: Array<{ text: string; source: SourceReference }>,
): ScoreValueWithSource<string> | null {
  for (const item of metadata) {
    const match =
      item.text.match(/1\s*=\s*([A-G](?:[#♯b♭])?)/iu) ??
      item.text.match(/([升降]?[A-G]|[A-G](?:[#♯b♭])?)\s*[调調]/iu);
    if (match) {
      return {
        value: normalizeKey(match[1].toUpperCase()),
        sources: [item.source],
      };
    }
  }
  return null;
}

function extractMeter(
  metadata: Array<{ text: string; source: SourceReference }>,
): ScoreValueWithSource<string> | null {
  for (const item of metadata) {
    const match = item.text.match(/(?<!\d)(\d+\s*\/\s*\d+)(?!\d)/u);
    if (match) {
      return { value: match[1].replace(/\s+/gu, ""), sources: [item.source] };
    }
  }
  return null;
}

export function buildPianoScore(
  source: PptxSourceDocument,
  options: { metadataFallback?: ScoreMetadataFallback } = {},
): PianoScoreDocument {
  const diagnostics: ContractDiagnostic[] = [...source.diagnostics];
  const pages = source.slides.map((slide) => {
    const textShapes = slide.shapes.filter(
      (shape): shape is SourceTextShape => shape.kind === "text",
    );
    const rows = groupScoreRows(
      textShapes.filter((shape) => containsFont(shape, BASE_FONT)),
    );
    const builtSystems = rows
      .map((row, index) =>
        buildSystem(source.hymn_key, slide.number, index, row, diagnostics),
      )
      .filter((system): system is BuiltSystem => system !== null);

    const accentShapes = textShapes
      .filter((shape) => containsFont(shape, ACCENT_FONT))
      .map((shape): AccentShape => {
        const tokens: AccentToken[] = [];
        for (const run of fontRuns(shape, ACCENT_FONT)) {
          const decoded = decodeSimpMusicAccent(run.text, run.source);
          tokens.push(...decoded.tokens);
          diagnostics.push(...decoded.diagnostics);
        }
        return { shape, tokens };
      });
    bindAccents(accentShapes, builtSystems, diagnostics);
    addLyrics(textShapes, builtSystems);

    return {
      id: `h${source.hymn_key}-p${slide.number}`,
      source_slides: [slide.number],
      systems: builtSystems.map((built) => built.system),
    };
  });

  const metadata = textMetadata(source);
  const withoutHash: Omit<PianoScoreDocument, "content_hash"> = {
    schema: SCORE_SCHEMA,
    hymn_key: source.hymn_key,
    title: source.title,
    source: {
      asset: `data/generated/hymn-sources/${source.hymn_key}.json`,
      source_hash: source.source_hash,
      decoder_version: SIMPMUSIC_DECODER_VERSION,
    },
    key_signature: extractKeySignature(metadata),
    meter: extractMeter(metadata),
    pages,
    diagnostics,
  };
  return applyOcrMetadataFallback(
    withDocumentContentHash(withoutHash),
    options.metadataFallback,
  );
}
