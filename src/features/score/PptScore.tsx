import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  BBox,
  ChordAssignment,
  FingerAssignment,
  PianoArrangementDocument,
  PianoScoreDocument,
  PositionSegment,
  ScoreEvent,
  ScoreSourceAnchor,
} from "./contracts";
import type {
  HymnRenderDocument,
  RenderMediaShape,
  RenderParagraph,
  RenderTextRun,
  RenderTextShape,
} from "./render-contracts";
import {
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
              <span key={run.id} style={runStyle(run, shape.role)}>
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

function buildTeachingData(
  score: PianoScoreDocument | undefined,
  arrangement: PianoArrangementDocument | undefined,
  canonicalSlide: number,
): TeachingData {
  if (!score || !arrangement) {
    return { fingers: [], positions: [], chords: [] };
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
  return {
    fingers: arrangement.fingerings.flatMap((assignment) => {
      const anchored = eventById.get(assignment.event_id);
      return anchored ? [{ assignment, anchored }] : [];
    }),
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
            left.anchor.x - right.anchor.x,
        )[0];
        return anchored ? [{ chord, anchored }] : [];
      }),
  };
}

function TeachingLayers({
  data,
  layout,
  pageWidth,
  pageHeight,
}: {
  data: TeachingData;
  layout: ScoreReflowLayout;
  pageWidth: number;
  pageHeight: number;
}) {
  const chordWidth = 150;
  const chordGap = 12;
  const columns = 5;
  const rowWidth = chordWidth * columns + chordGap * (columns - 1);
  const startX = (pageWidth - rowWidth) / 2;
  return (
    <g data-layer="teaching" pointerEvents="none">
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
      {data.chords.length > 0 && (
        <g data-layer="chords">
          <rect
            x={0}
            y={pageHeight}
            width={pageWidth}
            height={42 + Math.ceil(data.chords.length / columns) * 46}
            fill="#fbf8f0"
            stroke={teachingPalette.line}
          />
          <text
            x={pageWidth / 2}
            y={pageHeight + 22}
            fill={teachingPalette.muted}
            fontSize={12}
            fontWeight={700}
            textAnchor="middle"
          >
            左手和弦 · 按谱行顺序
          </text>
          {data.chords.map(({ chord, anchored }, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = startX + column * (chordWidth + chordGap);
            const y = pageHeight + 31 + row * 46;
            return (
              <g
                key={chord.id}
                data-chord-id={chord.id}
                data-measure-id={chord.measure_id}
                data-source-x={anchored.anchor.x}
                data-source-y={anchored.anchor.y}
              >
                <rect
                  x={x}
                  y={y}
                  width={chordWidth}
                  height={38}
                  rx={6}
                  fill={teachingPalette.amberLight}
                  stroke={teachingPalette.amber}
                  strokeOpacity={0.38}
                />
                <text
                  x={x + chordWidth / 2}
                  y={y + 15}
                  fill={teachingPalette.amber}
                  fontSize={11}
                  fontWeight={800}
                  textAnchor="middle"
                >
                  {chord.symbol} · {chord.function}
                </text>
                <text
                  x={x + chordWidth / 2}
                  y={y + 30}
                  fill={teachingPalette.muted}
                  fontSize={10}
                  textAnchor="middle"
                >
                  {chord.tones.map((tone) => tone.finger).join("-")}
                </text>
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
  className,
}: PptScoreProps) {
  const variant = document.variants[variantIndex] ?? document.variants[0];
  const layout = buildScoreReflowLayout(variant);
  const teaching = buildTeachingData(
    score,
    arrangement,
    variant.canonical_slide,
  );
  const chordRows = Math.ceil(teaching.chords.length / 5);
  const teachingHeight =
    teaching.chords.length > 0 ? 42 + chordRows * 46 : 0;
  const viewBox = [
    variant.page.view_box[0],
    variant.page.view_box[1],
    variant.page.view_box[2],
    layout.contentHeight + teachingHeight,
  ];

  return (
    <svg
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
            data-lyric-y={row.lyricY}
            data-lyric-bottom={row.lyricBottom}
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
        pageWidth={variant.page.width}
        pageHeight={layout.contentHeight}
      />
    </svg>
  );
}
