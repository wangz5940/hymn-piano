import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { isConfirmedTeachingStatus } from "./contracts";
import type {
  BBox,
  ChordAssignment,
  FingerAssignment,
  PianoArrangementDocument,
  PianoScoreDocument,
  PositionSegment,
  ScoreEvent,
  ScoreNoteEvent,
  ScoreSourceAnchor,
} from "./contracts";
import {
  DEFAULT_SCORE_DISPLAY_PREFERENCES,
  type ScoreDisplayPreferences,
} from "./display-preferences";
import type {
  HymnRenderDocument,
  RenderMediaShape,
  RenderParagraph,
  RenderTextRun,
  RenderTextShape,
} from "./render-contracts";
import { scoreNoteName } from "./pitch";
import {
  appendChordTracks,
  buildScoreReflowLayout,
  fontSize,
  nearestRow,
  POINT_TO_CSS_PX,
  shapeFontSize,
  type ScoreReflowLayout,
} from "./ppt-score-layout";

interface PptScoreProps {
  document: HymnRenderDocument;
  variantIndex: number;
  score?: PianoScoreDocument;
  arrangement?: PianoArrangementDocument;
  visibility?: ScoreDisplayPreferences;
  className?: string;
}

const fingerCircles = {
  1: "①",
  2: "②",
  3: "③",
  4: "④",
  5: "⑤",
} as const;
const teachingPalette = {
  cedar: "#1f5548",
  cedarLight: "#dbe8e1",
  amber: "#a85e24",
  amberLight: "#f6e7d6",
  muted: "#67736d",
  line: "#d8d1c3",
};
const CHORD_GAP = 8;
const CHORD_EDGE_PADDING = 2;
const CHORD_CARD_HORIZONTAL_PADDING = 4;
const CHORD_TRACK_HEADER_HEIGHT = 24;
const CHORD_CARD_HEIGHT = 48;
const CHORD_ROW_HEIGHT = 56;

function confirmedChord(chord: ChordAssignment): boolean {
  return isConfirmedTeachingStatus(chord.status);
}

function estimatedTextWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce((width, character) => {
    if (/\p{Script=Han}/u.test(character)) return width + fontSize;
    if (character === " ") return width + fontSize * 0.32;
    if (character === "♭" || character === "♯") {
      return width + fontSize * 0.65;
    }
    if (character === "·" || character === "-") {
      return width + fontSize * 0.42;
    }
    if (/[A-Z0-9]/u.test(character)) return width + fontSize * 0.62;
    return width + fontSize * 0.55;
  }, 0);
}

function chordCardWidth(chord: ChordAssignment): number {
  const lines: Array<[string, number]> = [
    [`${chord.symbol} · ${chord.function}`, 11],
    [chord.tones.map((tone) => tone.finger).join("-"), 10],
    [confirmedChord(chord) ? "已确认" : "自动预判", 8],
  ];
  return Math.ceil(
    Math.max(
      ...lines.map(([text, fontSize]) =>
        estimatedTextWidth(text, fontSize),
      ),
    ) +
      CHORD_CARD_HORIZONTAL_PADDING * 2,
  );
}

function fontFamily(
  run: RenderTextRun,
  role: RenderTextShape["role"],
): string {
  if (run.font_family) {
    const sanitized = run.font_family.replace(/["';\\]/gu, "").trim();
    if (sanitized) {
      return `"${sanitized}", "SimpMusic Base", "SimpMusic Accent", serif`;
    }
  }
  if (role === "accent") return "SimpMusic Accent";
  if (role === "score") return "SimpMusic Base";
  return "Songti SC, SimSun, Noto Serif CJK SC, serif";
}

function runStyle(
  run: RenderTextRun,
  role: RenderTextShape["role"],
): CSSProperties {
  return {
    color:
      run.color?.startsWith("#") === true ? run.color : undefined,
    fontFamily: fontFamily(run, role),
    fontSize: fontSize(run, role),
    fontStyle: run.italic ? "italic" : "normal",
    fontWeight: run.bold ? 700 : 400,
    letterSpacing:
      run.character_spacing === null ||
      run.character_spacing === undefined
        ? undefined
        : Number(
            (run.character_spacing * POINT_TO_CSS_PX).toFixed(3),
          ),
  };
}

function rotationTransform(
  shape: RenderTextShape | RenderMediaShape,
  bbox: BBox = shape.bbox,
): string | undefined {
  if (shape.rotation === 0) return undefined;
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  return `rotate(${shape.rotation} ${centerX} ${centerY})`;
}

function dominantValue<T extends string | number>(
  values: T[],
  fallback: T,
): T {
  const counts = new Map<T, number>();
  let selected = fallback;
  let selectedCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > selectedCount) {
      selected = value;
      selectedCount = count;
    }
  }
  return selected;
}

function shapeFontFamily(shape: RenderTextShape): string {
  const families = shape.paragraphs.flatMap((paragraph) =>
    paragraph.runs.map((run) => fontFamily(run, shape.role)),
  );
  return dominantValue(
    families,
    shape.role === "accent"
      ? "SimpMusic Accent"
      : shape.role === "score"
        ? "SimpMusic Base"
        : "Songti SC, SimSun, Noto Serif CJK SC, serif",
  );
}

function textShape(
  shape: RenderTextShape,
  options: {
    bbox?: BBox;
    paragraphs?: RenderParagraph[];
    key?: string;
    nowrap?: boolean;
  } = {},
): ReactNode {
  const bbox = options.bbox ?? shape.bbox;
  const paragraphs = options.paragraphs ?? shape.paragraphs;
  const isLyric = shape.role === "lyric";
  const boxStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    color: "#16130f",
    fontFamily: shapeFontFamily(shape),
    fontSize: shapeFontSize(shape),
    lineHeight: isLyric ? 1.35 : 1,
    overflow: "visible",
    padding: isLyric ? "2px 4px" : 0,
    textAlign: "left",
    whiteSpace: isLyric && !options.nowrap ? "pre-line" : "pre",
  };
  return (
    <foreignObject
      key={options.key ?? shape.id}
      data-render-role={shape.role}
      data-shape-id={shape.id}
      x={bbox.x}
      y={bbox.y}
      width={bbox.width}
      height={bbox.height}
      overflow="visible"
      transform={rotationTransform(shape, bbox)}
    >
      <div
        className={`ppt-render-box ppt-render-box--${shape.role}`}
        style={boxStyle}
      >
        {paragraphs.map((paragraph, paragraphIndex) => (
          <Fragment key={paragraph.id}>
            {paragraph.runs.map((run) => (
              <span
                key={run.id}
                data-score-run-id={
                  shape.role === "score" ? run.id : undefined
                }
                style={runStyle(run, shape.role)}
              >
                {run.text}
              </span>
            ))}
            {paragraphIndex < paragraphs.length - 1 && (
              <br aria-hidden="true" />
            )}
          </Fragment>
        ))}
      </div>
    </foreignObject>
  );
}

function mediaShape(shape: RenderMediaShape, bbox: BBox = shape.bbox): ReactNode {
  return (
    <image
      key={shape.id}
      data-render-role="media"
      data-shape-id={shape.id}
      href={shape.asset_url}
      x={bbox.x}
      y={bbox.y}
      width={bbox.width}
      height={bbox.height}
      preserveAspectRatio="none"
      transform={rotationTransform(shape, bbox)}
    />
  );
}

interface AnchoredEvent {
  event: ScoreEvent;
  anchor: ScoreSourceAnchor;
}

interface TeachingData {
  fingers: Array<{
    assignment: FingerAssignment;
    anchored: AnchoredEvent;
  }>;
  noteNames: Array<{
    label: string;
    anchored: AnchoredEvent & { event: ScoreNoteEvent };
  }>;
  positions: Array<{
    segment: PositionSegment;
    start: AnchoredEvent;
    end: AnchoredEvent;
  }>;
  chords: Array<{
    chord: ChordAssignment;
    anchored: AnchoredEvent;
  }>;
}

interface MeasuredAnchorState {
  key: string;
  xByEventId: Readonly<Record<string, number>>;
}

function baseRuns(shape: RenderTextShape): RenderTextRun[] {
  return shape.paragraphs.flatMap((paragraph) =>
    paragraph.runs.filter(
      (run) => run.font_family?.trim().toLowerCase() === "simpmusic base",
    ),
  );
}

function eventGlyph(event: ScoreEvent): string | null {
  const accidentalGlyphs = new Set(["L", '"', ":", "\uf04c"]);
  for (const glyph of Array.from(event.raw_glyphs)) {
    if (!accidentalGlyphs.has(glyph)) return glyph;
  }
  return Array.from(event.raw_glyphs)[0] ?? null;
}

function nearestGlyphOffset(
  text: string,
  glyph: string,
  approximateCenter: number,
): number | null {
  let selected: number | null = null;
  let selectedDistance = Number.POSITIVE_INFINITY;
  let searchFrom = 0;

  while (searchFrom <= text.length) {
    const offset = text.indexOf(glyph, searchFrom);
    if (offset < 0) break;
    const distance = Math.abs(
      offset + glyph.length / 2 - approximateCenter,
    );
    if (distance < selectedDistance) {
      selected = offset;
      selectedDistance = distance;
    }
    searchFrom = offset + Math.max(1, glyph.length);
  }

  return selected;
}

function measuredAnchorXs(
  svg: SVGSVGElement,
  score: PianoScoreDocument | undefined,
  variant: HymnRenderDocument["variants"][number],
): Readonly<Record<string, number>> {
  if (!score) return {};
  const svgRect = svg.getBoundingClientRect();
  const viewBox = svg
    .getAttribute("viewBox")
    ?.split(/\s+/u)
    .map(Number);
  if (
    svgRect.width <= 0 ||
    !viewBox ||
    viewBox.length !== 4 ||
    !viewBox.every(Number.isFinite)
  ) {
    return {};
  }

  const shapesById = new Map<string, RenderTextShape>();
  for (const shape of variant.score_shapes.filter(
    (candidate) => candidate.role === "score",
  )) {
    shapesById.set(shape.id, shape);
    shapesById.set(shape.source.shape_id, shape);
  }
  const spansByRunId = new Map(
    Array.from(
      svg.querySelectorAll<HTMLElement>("[data-score-run-id]"),
    ).map((span) => [span.dataset.scoreRunId ?? "", span]),
  );
  const xByEventId: Record<string, number> = {};

  for (const page of score.pages) {
    for (const system of page.systems) {
      for (const measure of system.measures) {
        for (const event of measure.events) {
          const anchor = event.source_anchor;
          if (!anchor || anchor.slide !== variant.canonical_slide) continue;
          const shape = event.sources
            .map((source) => shapesById.get(source.shape_id))
            .find((candidate) => candidate !== undefined);
          if (!shape || shape.bbox.width <= 0) continue;
          const runs = baseRuns(shape);
          const text = runs.map((run) => run.text).join("");
          const glyph = eventGlyph(event);
          if (!glyph || text.length === 0) continue;
          const approximateCenter =
            ((anchor.x - shape.bbox.x) / shape.bbox.width) *
            text.length;
          const glyphOffset = nearestGlyphOffset(
            text,
            glyph,
            approximateCenter,
          );
          if (glyphOffset === null) continue;

          let runStart = 0;
          const run = runs.find((candidate) => {
            const runEnd = runStart + candidate.text.length;
            if (glyphOffset >= runStart && glyphOffset < runEnd) return true;
            runStart = runEnd;
            return false;
          });
          if (!run) continue;
          const span = spansByRunId.get(run.id);
          const textNode = span?.firstChild;
          if (!span || !textNode || textNode.nodeType !== Node.TEXT_NODE) {
            continue;
          }
          const localOffset = glyphOffset - runStart;
          const localEnd = Math.min(
            run.text.length,
            localOffset + glyph.length,
          );
          if (localOffset < 0 || localEnd <= localOffset) continue;

          try {
            const range = document.createRange();
            range.setStart(textNode, localOffset);
            range.setEnd(textNode, localEnd);
            const glyphRect = range.getBoundingClientRect();
            if (
              glyphRect.width <= 0 ||
              !Number.isFinite(glyphRect.left)
            ) {
              continue;
            }
            const screenCenter = glyphRect.left + glyphRect.width / 2;
            xByEventId[event.id] = Number(
              (
                viewBox[0] +
                ((screenCenter - svgRect.left) / svgRect.width) *
                  viewBox[2]
              ).toFixed(3),
            );
          } catch {
            // Source anchors remain the deterministic fallback.
          }
        }
      }
    }
  }

  return xByEventId;
}

function projectAnchoredEvent(
  anchored: AnchoredEvent,
  xByEventId: Readonly<Record<string, number>>,
): AnchoredEvent {
  const measuredX = xByEventId[anchored.event.id];
  return measuredX === undefined
    ? anchored
    : {
        event: anchored.event,
        anchor: {
          ...anchored.anchor,
          x: measuredX,
        },
      };
}

function projectTeachingData(
  data: TeachingData,
  xByEventId: Readonly<Record<string, number>>,
): TeachingData {
  return {
    fingers: data.fingers.map(({ assignment, anchored }) => ({
      assignment,
      anchored: projectAnchoredEvent(anchored, xByEventId),
    })),
    noteNames: data.noteNames.map(({ label, anchored }) => ({
      label,
      anchored: projectAnchoredEvent(
        anchored,
        xByEventId,
      ) as AnchoredEvent & { event: ScoreNoteEvent },
    })),
    positions: data.positions.map(({ segment, start, end }) => ({
      segment,
      start: projectAnchoredEvent(start, xByEventId),
      end: projectAnchoredEvent(end, xByEventId),
    })),
    chords: data.chords.map(({ chord, anchored }) => ({
      chord,
      anchored: projectAnchoredEvent(anchored, xByEventId),
    })),
  };
}

function sameAnchorXs(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([eventId, x]) => right[eventId] === x)
  );
}

type AnchoredChord = TeachingData["chords"][number];

interface PositionedChord extends AnchoredChord {
  x: number;
  width: number;
  lane: number;
}

interface ChordRowTrack {
  rowIndex: number;
  laneCount: number;
  height: number;
  chords: PositionedChord[];
}

function buildTeachingData(
  score: PianoScoreDocument | undefined,
  arrangement: PianoArrangementDocument | undefined,
  canonicalSlide: number,
): TeachingData {
  if (!score) {
    return { fingers: [], noteNames: [], positions: [], chords: [] };
  }
  const anchoredEvents = score.pages.flatMap((page) =>
    page.systems.flatMap((system) =>
      system.measures.flatMap((measure) =>
        measure.events.flatMap((event): AnchoredEvent[] => {
          const anchor = event.source_anchor;
          return anchor?.slide === canonicalSlide
            ? [{ event, anchor }]
            : [];
        }),
      ),
    ),
  );
  const eventById = new Map(
    anchoredEvents.map((anchored) => [anchored.event.id, anchored]),
  );
  const eventsByMeasure = new Map<string, AnchoredEvent[]>();
  for (const anchored of anchoredEvents) {
    const current = eventsByMeasure.get(anchored.event.measure_id) ?? [];
    current.push(anchored);
    eventsByMeasure.set(anchored.event.measure_id, current);
  }
  const noteNames = anchoredEvents.flatMap(
    ({ event, anchor }): TeachingData["noteNames"] =>
      event.kind === "note"
        ? [
            {
              label: scoreNoteName(
                event,
                score.key_signature?.value ?? null,
              ),
              anchored: { event, anchor },
            },
          ]
        : [],
  );
  if (!arrangement) {
    return { fingers: [], noteNames, positions: [], chords: [] };
  }
  return {
    fingers: arrangement.fingerings.flatMap((assignment) => {
      const anchored = eventById.get(assignment.event_id);
      return anchored ? [{ assignment, anchored }] : [];
    }),
    noteNames,
    positions: arrangement.positions.flatMap((segment) => {
      const start = eventById.get(segment.start_event_id);
      const end = eventById.get(segment.end_event_id);
      if (!start || !end || Math.abs(start.anchor.y - end.anchor.y) > 24) {
        return [];
      }
      return [{ segment, start, end }];
    }),
    chords: arrangement.chords
      .filter((chord) => chord.display_default)
      .flatMap((chord) => {
        const candidates = eventsByMeasure.get(chord.measure_id) ?? [];
        const anchored = [...candidates].sort(
          (left, right) =>
            Math.abs(left.event.beat - chord.beat) -
              Math.abs(right.event.beat - chord.beat) ||
            (left.event.kind === "note" ? 0 : 1) -
              (right.event.kind === "note" ? 0 : 1) ||
            left.anchor.x - right.anchor.x,
        )[0];
        return anchored ? [{ chord, anchored }] : [];
      }),
  };
}

function buildChordTracks(
  chords: AnchoredChord[],
  layout: ScoreReflowLayout,
  pageWidth: number,
): ChordRowTrack[] {
  const tracks = layout.rows.map(
    (row): ChordRowTrack => ({
      rowIndex: row.index,
      laneCount: 0,
      height: 0,
      chords: [],
    }),
  );
  if (tracks.length === 0) return tracks;

  for (const chord of chords) {
    const row = nearestRow(layout.rows, chord.anchored.anchor.y);
    const width = chordCardWidth(chord.chord);
    const sourceCenterX = chord.anchored.anchor.x;
    const cardCenterX = Math.min(
      pageWidth - CHORD_EDGE_PADDING - width / 2,
      Math.max(CHORD_EDGE_PADDING + width / 2, sourceCenterX),
    );
    tracks[row.index].chords.push({
      ...chord,
      x: cardCenterX - width / 2,
      width,
      lane: 0,
    });
  }

  for (const track of tracks) {
    const laneEnds: number[] = [];
    track.chords
      .sort(
        (left, right) =>
          left.x - right.x ||
          left.anchored.anchor.x - right.anchored.anchor.x ||
          left.chord.id.localeCompare(right.chord.id),
      )
      .forEach((chord) => {
        let lane = laneEnds.findIndex(
          (laneEnd) => chord.x >= laneEnd + CHORD_GAP,
        );
        if (lane < 0) {
          lane = laneEnds.length;
          laneEnds.push(0);
        }
        chord.lane = lane;
        laneEnds[lane] = chord.x + chord.width;
      });
    track.laneCount = laneEnds.length;
    track.height =
      track.laneCount > 0
        ? CHORD_TRACK_HEADER_HEIGHT + track.laneCount * CHORD_ROW_HEIGHT
        : 0;
  }

  return tracks;
}

function TeachingLayers({
  data,
  layout,
  chordTracks,
  pageWidth,
  visibility,
}: {
  data: TeachingData;
  layout: ScoreReflowLayout;
  chordTracks: ChordRowTrack[];
  pageWidth: number;
  visibility: ScoreDisplayPreferences;
}) {
  return (
    <g data-layer="teaching" pointerEvents="none">
      {visibility.positions && (
        <g data-layer="positions">
          {data.positions.map(({ segment, start, end }) => {
            const startRow = nearestRow(layout.rows, start.anchor.y);
            const endRow = nearestRow(layout.rows, end.anchor.y);
            if (startRow.index !== endRow.index) return null;
            const x = Math.min(start.anchor.x, end.anchor.x) - 8;
            const width =
              Math.abs(end.anchor.x - start.anchor.x) + 16;
            const y = startRow.positionY;
            return (
              <g
                key={segment.id}
                data-position-id={segment.id}
                data-score-row={startRow.index}
              >
                <rect
                  x={x}
                  y={y}
                  width={Math.max(30, width)}
                  height={17}
                  rx={5}
                  fill={teachingPalette.cedarLight}
                  fillOpacity={0.82}
                  stroke={teachingPalette.cedar}
                  strokeOpacity={0.42}
                />
                <text
                  x={x + 6}
                  y={y + 12}
                  fill={teachingPalette.cedar}
                  fontSize={9}
                  fontWeight={700}
                >
                  {segment.label}
                </text>
              </g>
            );
          })}
        </g>
      )}
      {visibility.fingerings && (
        <g data-layer="fingerings">
          {data.fingers.map(({ assignment, anchored }) => {
            const row = nearestRow(layout.rows, anchored.anchor.y);
            return (
              <text
                key={assignment.event_id}
                data-event-id={assignment.event_id}
                data-score-row={row.index}
                x={anchored.anchor.x}
                y={row.fingeringY}
                fill={
                  assignment.status === "manual_confirmed"
                    ? teachingPalette.cedar
                    : teachingPalette.amber
                }
                fontSize={16}
                fontWeight={700}
                textAnchor="middle"
              >
                {fingerCircles[assignment.finger]}
              </text>
            );
          })}
        </g>
      )}
      {visibility.noteNames && (
        <g data-layer="note-names">
          {data.noteNames.map(({ label, anchored }) => {
            const row = nearestRow(layout.rows, anchored.anchor.y);
            return (
              <text
                key={`${anchored.event.id}-note-name`}
                data-event-id={anchored.event.id}
                data-score-row={row.index}
                x={anchored.anchor.x}
                y={row.noteNameY}
                fill={teachingPalette.muted}
                fontSize={9}
                fontWeight={650}
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </g>
      )}
      {visibility.chords &&
        chordTracks.some((track) => track.chords.length > 0) && (
        <g data-layer="chords">
          {chordTracks.map((track) => {
            if (track.chords.length === 0) return null;
            const row = layout.rows[track.rowIndex];
            return (
              <g
                key={`chord-track-${track.rowIndex}`}
                data-chord-track={track.rowIndex}
                data-score-row={track.rowIndex}
                data-lane-count={track.laneCount}
              >
                <rect
                  x={0}
                  y={row.chordY}
                  width={pageWidth}
                  height={track.height}
                  fill="#fbf8f0"
                  stroke={teachingPalette.line}
                  strokeOpacity={0.72}
                />
                <text
                  x={CHORD_EDGE_PADDING}
                  y={row.chordY + 15}
                  fill={teachingPalette.muted}
                  fontSize={10}
                  fontWeight={700}
                >
                  左手和弦
                </text>
                {track.chords.map(
                  ({
                    chord,
                    anchored,
                    x,
                    width,
                    lane,
                  }) => {
                    const y =
                      row.chordY +
                      CHORD_TRACK_HEADER_HEIGHT +
                      lane * CHORD_ROW_HEIGHT;
                    const isConfirmed = confirmedChord(chord);
                    const color = isConfirmed
                      ? teachingPalette.cedar
                      : teachingPalette.amber;
                    return (
                      <g
                        key={chord.id}
                        data-chord-id={chord.id}
                        data-measure-id={chord.measure_id}
                        data-score-row={track.rowIndex}
                        data-lane={lane}
                        data-status={chord.status}
                        data-source-x={anchored.anchor.x}
                        data-source-y={anchored.anchor.y}
                        data-chord-x={x}
                        data-chord-width={width}
                      >
                      <line
                        x1={anchored.anchor.x}
                        y1={row.chordY + 18}
                        x2={x + width / 2}
                        y2={y}
                        stroke={color}
                        strokeOpacity={0.3}
                      />
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={CHORD_CARD_HEIGHT}
                        rx={6}
                        fill={
                          isConfirmed
                            ? teachingPalette.cedarLight
                            : teachingPalette.amberLight
                        }
                        stroke={color}
                        strokeOpacity={0.38}
                      />
                      <text
                        x={x + width / 2}
                        y={y + 15}
                        fill={color}
                        fontSize={11}
                        fontWeight={800}
                        textAnchor="middle"
                      >
                        {chord.symbol} · {chord.function}
                      </text>
                      <text
                        x={x + width / 2}
                        y={y + 30}
                        fill={teachingPalette.muted}
                        fontSize={10}
                        textAnchor="middle"
                      >
                        {chord.tones.map((tone) => tone.finger).join("-")}
                      </text>
                      <text
                        x={x + width / 2}
                        y={y + 42}
                        fill={color}
                        fontSize={8}
                        fontWeight={700}
                        textAnchor="middle"
                      >
                        {isConfirmed ? "已确认" : "自动预判"}
                      </text>
                    </g>
                  );
                },
              )}
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

export function PptScore({
  document,
  variantIndex,
  score,
  arrangement,
  visibility = DEFAULT_SCORE_DISPLAY_PREFERENCES,
  className,
}: PptScoreProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const variant = document.variants[variantIndex] ?? document.variants[0];
  const measurementKey = [
    document.content_hash,
    variant.id,
    score?.content_hash ?? "no-score",
  ].join(":");
  const [measuredAnchors, setMeasuredAnchors] =
    useState<MeasuredAnchorState>({
      key: "",
      xByEventId: {},
    });
  const measuredXByEventId =
    measuredAnchors.key === measurementKey
      ? measuredAnchors.xByEventId
      : {};
  const fontSet =
    typeof globalThis.document === "undefined"
      ? null
      : globalThis.document.fonts;

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    let active = true;
    const measure = () => {
      if (!active) return;
      const xByEventId = measuredAnchorXs(svg, score, variant);
      if (Object.keys(xByEventId).length === 0) return;
      setMeasuredAnchors((current) =>
        current.key === measurementKey &&
        sameAnchorXs(current.xByEventId, xByEventId)
          ? current
          : { key: measurementKey, xByEventId },
      );
    };

    measure();
    void fontSet?.ready.then(measure);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(svg);

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [fontSet, measurementKey, score, variant]);

  const baseLayout = buildScoreReflowLayout(variant, visibility);
  const teaching = projectTeachingData(
    buildTeachingData(
      score,
      arrangement,
      variant.canonical_slide,
    ),
    measuredXByEventId,
  );
  const chordTracks = buildChordTracks(
    visibility.chords ? teaching.chords : [],
    baseLayout,
    variant.page.width,
  );
  const layout = appendChordTracks(
    baseLayout,
    chordTracks.map((track) => track.height),
  );
  const viewBox = [
    variant.page.view_box[0],
    variant.page.view_box[1],
    variant.page.view_box[2],
    layout.contentHeight,
  ];

  return (
    <svg
      ref={svgRef}
      className={className}
      data-hymn-key={document.hymn_key}
      data-render-variant={variant.index}
      viewBox={viewBox.join(" ")}
      width="100%"
      role="img"
      aria-label={`第 ${document.hymn_key} 首《${document.title}》PPT 原版简谱（第一段）`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x={0}
        y={0}
        width={variant.page.width}
        height={layout.contentHeight}
        fill="#fffef9"
      />
      {layout.rows.map((row) => {
        const rowItems = [
          ...row.textShapes.map((shape) => ({
            kind: "text" as const,
            order: shape.order,
            shape,
          })),
          ...row.mediaShapes.map((shape) => ({
            kind: "media" as const,
            order: shape.order,
            shape,
          })),
        ].sort(
          (left, right) =>
            left.order - right.order ||
            left.shape.id.localeCompare(right.shape.id),
        );
        return (
          <g
            key={`score-row-${row.index}`}
            data-score-row={row.index}
            data-position-y={row.positionY}
            data-fingering-y={row.fingeringY}
            data-score-y={row.scoreY}
            data-score-bottom={row.scoreBottom}
            data-note-name-y={row.noteNameY}
            data-note-name-bottom={row.noteNameBottom}
            data-lyric-y={row.lyricY}
            data-lyric-bottom={row.lyricBottom}
            data-chord-y={row.chordY}
            data-chord-bottom={row.chordBottom}
          >
            {rowItems.map((item) => {
              const bbox = {
                ...item.shape.bbox,
                y:
                  row.scoreY +
                  (item.shape.bbox.y - row.baseY),
              };
              return item.kind === "text"
                ? textShape(item.shape, {
                    bbox,
                    key: `row-${row.index}-${item.shape.id}`,
                  })
                : mediaShape(item.shape, bbox);
            })}
            {row.lyricLine &&
              textShape(row.lyricLine.shape, {
                key: `row-${row.index}-${row.lyricLine.paragraph.id}`,
                bbox: {
                  ...row.lyricLine.shape.bbox,
                  y: row.lyricY,
                  height: row.lyricBottom - row.lyricY,
                },
                paragraphs: [row.lyricLine.paragraph],
                nowrap: true,
              })}
          </g>
        );
      })}
      {layout.fallbackLyrics.map(({ shape, bbox }) =>
        textShape(shape, {
          key: `fallback-lyrics-${shape.id}`,
          bbox,
        }),
      )}
      <TeachingLayers
        data={teaching}
        layout={layout}
        chordTracks={chordTracks}
        pageWidth={variant.page.width}
        visibility={visibility}
      />
    </svg>
  );
}
