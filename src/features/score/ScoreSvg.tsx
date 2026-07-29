import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  PianoArrangementDocument,
  PianoScoreDocument,
  ScoreBarlineEvent,
  ScoreNoteEvent,
  ScoreRepeatEvent,
} from "./contracts";
import { layoutScore } from "./layout";
import type {
  EventLayout,
  MeasureLayout,
  RelationLayout,
  ScoreLayout,
} from "./layout";

interface ScoreSvgProps {
  score: PianoScoreDocument;
  arrangement?: PianoArrangementDocument;
  className?: string;
}

const glyphStyle: CSSProperties = {
  fontFamily: '"SimpMusic Base"',
  fontSize: 27,
  fontWeight: 400,
};

const fingerCircles = {
  1: "①",
  2: "②",
  3: "③",
  4: "④",
  5: "⑤",
} as const;

const palette = {
  paper: "#fbf8f0",
  ink: "#18231f",
  muted: "#67736d",
  line: "#d8d1c3",
  cedar: "#1f5548",
  cedarLight: "#dbe8e1",
  amber: "#a85e24",
  amberLight: "#f6e7d6",
};

function accidentalLabel(accidental: ScoreNoteEvent["accidental"]): string {
  if (accidental === "flat") return "♭";
  if (accidental === "sharp") return "♯";
  if (accidental === "natural") return "♮";
  return "";
}

function relationPath(relation: RelationLayout): string {
  const isSlur = relation.event.kind === "slur";
  const yOffset = isSlur ? -19 : 18;
  const startX = relation.from.x + 3;
  const endX = relation.to.x - 3;
  const startY = relation.from.y + yOffset;
  const endY = relation.to.y + yOffset;
  const controlX = (startX + endX) / 2;
  const controlY =
    Math.min(startY, endY) + (isSlur ? -14 : 12);
  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

function renderOctaveDots(layout: EventLayout & { event: ScoreNoteEvent }) {
  const count = Math.abs(layout.event.octave);
  if (count === 0) return null;
  const above = layout.event.octave > 0;
  return Array.from({ length: count }, (_, index) => (
    <circle
      key={`${layout.event.id}-octave-${index}`}
      data-event-id={layout.event.id}
      cx={layout.x}
      cy={layout.y + (above ? -19 - index * 6 : 15 + index * 6)}
      r={1.8}
      fill={palette.ink}
    />
  ));
}

function renderDuration(layout: EventLayout) {
  if (layout.event.kind !== "note" && layout.event.kind !== "rest") return null;
  const beams = Math.max(0, layout.event.beams);
  const durationWidth = Math.max(10, Math.min(38, layout.event.duration * 15));
  return (
    <>
      {Array.from({ length: beams }, (_, index) => (
        <line
          key={`${layout.event.id}-beam-${index}`}
          data-event-id={layout.event.id}
          x1={layout.x - durationWidth / 2}
          x2={layout.x + durationWidth / 2}
          y1={layout.y + 17 + index * 5}
          y2={layout.y + 17 + index * 5}
          stroke={palette.ink}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      ))}
      {Array.from(
        { length: Math.max(0, layout.event.augmentation_dots) },
        (_, index) => (
          <circle
            key={`${layout.event.id}-augmentation-${index}`}
            data-event-id={layout.event.id}
            cx={layout.x + 13 + index * 6}
            cy={layout.y - 1}
            r={1.8}
            fill={palette.ink}
          />
        ),
      )}
    </>
  );
}

function renderBarline(
  layout: EventLayout & { event: ScoreBarlineEvent },
): ReactNode {
  const top = layout.y - 27;
  const bottom = layout.y + 25;
  if (layout.event.style === "double") {
    return (
      <>
        <line x1={layout.x - 3} x2={layout.x - 3} y1={top} y2={bottom} />
        <line x1={layout.x + 3} x2={layout.x + 3} y1={top} y2={bottom} />
      </>
    );
  }
  if (layout.event.style === "final") {
    return (
      <>
        <line x1={layout.x - 4} x2={layout.x - 4} y1={top} y2={bottom} />
        <line
          x1={layout.x + 3}
          x2={layout.x + 3}
          y1={top}
          y2={bottom}
          strokeWidth={4}
        />
      </>
    );
  }
  return <line x1={layout.x} x2={layout.x} y1={top} y2={bottom} />;
}

function renderRepeat(
  layout: EventLayout & { event: ScoreRepeatEvent },
): ReactNode {
  const direction = layout.event.direction === "start" ? 1 : -1;
  return (
    <>
      <line
        x1={layout.x}
        x2={layout.x}
        y1={layout.y - 27}
        y2={layout.y + 25}
        strokeWidth={3}
      />
      <circle cx={layout.x + direction * 8} cy={layout.y - 7} r={2.2} />
      <circle cx={layout.x + direction * 8} cy={layout.y + 7} r={2.2} />
    </>
  );
}

function measureGuide(measure: MeasureLayout) {
  return (
    <g key={`${measure.id}-guide`} data-measure-id={measure.id}>
      <line
        x1={measure.x}
        x2={measure.x + measure.width}
        y1={measure.y + 104}
        y2={measure.y + 104}
        stroke={palette.line}
        strokeWidth={0.8}
        strokeDasharray="2 8"
      />
      <text
        x={measure.x + 2}
        y={measure.y + 73}
        fill={palette.muted}
        fontSize={9}
      >
        {measure.number}
      </text>
    </g>
  );
}

function NotationLayers({ layout }: { layout: ScoreLayout }) {
  const notes = layout.events.filter(
    (event): event is EventLayout & { event: ScoreNoteEvent } =>
      event.event.kind === "note",
  );
  const rests = layout.events.filter(
    (event) => event.event.kind === "rest",
  );
  const barlines = layout.events.filter(
    (
      event,
    ): event is EventLayout & { event: ScoreBarlineEvent } =>
      event.event.kind === "barline",
  );
  const repeats = layout.events.filter(
    (
      event,
    ): event is EventLayout & { event: ScoreRepeatEvent } =>
      event.event.kind === "repeat",
  );
  const unknown = layout.events.filter(
    (event) => event.event.kind === "unknown",
  );

  return (
    <g data-layer="notation">
      <g data-layer="measure-guides">
        {layout.measures.map(measureGuide)}
      </g>
      <g data-layer="notes" fill={palette.ink}>
        {notes.map((event) => (
          <g key={event.event.id} data-event-id={event.event.id}>
            {event.event.accidental && (
              <text
                x={event.x - 14}
                y={event.y + 7}
                fill={palette.ink}
                fontSize={16}
                textAnchor="middle"
              >
                {accidentalLabel(event.event.accidental)}
              </text>
            )}
            <text
              className="score-svg__glyph"
              x={event.x}
              y={event.y + 8}
              fill={palette.ink}
              style={glyphStyle}
              textAnchor="middle"
            >
              {event.event.degree}
            </text>
          </g>
        ))}
      </g>
      <g data-layer="rests" fill={palette.ink}>
        {rests.map((event) => (
          <text
            key={event.event.id}
            className="score-svg__glyph"
            data-event-id={event.event.id}
            x={event.x}
            y={event.y + 8}
            style={glyphStyle}
            textAnchor="middle"
          >
            0
          </text>
        ))}
      </g>
      <g data-layer="octave">
        {notes.map((event) => renderOctaveDots(event))}
      </g>
      <g data-layer="duration">
        {layout.events.map((event) => (
          <g key={`${event.event.id}-duration`}>
            {renderDuration(event)}
          </g>
        ))}
      </g>
      <g
        data-layer="barlines"
        fill={palette.ink}
        stroke={palette.ink}
        strokeWidth={1.3}
      >
        {barlines.map((event) => (
          <g key={event.event.id} data-event-id={event.event.id}>
            {renderBarline(event)}
          </g>
        ))}
      </g>
      <g
        data-layer="repeats"
        fill={palette.ink}
        stroke={palette.ink}
      >
        {repeats.map((event) => (
          <g key={event.event.id} data-event-id={event.event.id}>
            {renderRepeat(event)}
          </g>
        ))}
      </g>
      <g data-layer="unknown" fill={palette.muted}>
        {unknown.map((event) => (
          <text
            key={event.event.id}
            className="score-svg__glyph"
            data-event-id={event.event.id}
            x={event.x}
            y={event.y + 7}
            style={glyphStyle}
            textAnchor="middle"
          >
            {event.event.raw_glyphs || "?"}
          </text>
        ))}
      </g>
    </g>
  );
}

function TeachingLayers({ layout }: { layout: ScoreLayout }) {
  return (
    <g data-layer="teaching">
      <g data-layer="positions">
        {layout.positions.map((position) => (
          <g
            key={position.segment.id}
            data-position-id={position.segment.id}
            data-lane={position.lane}
          >
            <rect
              x={position.x}
              y={position.y}
              width={position.width}
              height={position.height}
              rx={5}
              fill={palette.cedarLight}
              stroke={palette.cedar}
              strokeOpacity={0.32}
            />
            <text
              x={position.x + 7}
              y={position.y + 13}
              fill={palette.cedar}
              fontSize={10}
              fontWeight={700}
            >
              {position.segment.label}
            </text>
          </g>
        ))}
      </g>
      <g data-layer="moves">
        {layout.moves.map((move) => (
          <g
            key={move.move.id}
            data-move-id={move.move.id}
            data-event-id={move.move.trigger_event_id}
          >
            <path
              d={`M ${move.x} ${move.y + 4} l 6 -6 l 6 6`}
              fill="none"
              stroke={palette.amber}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x={move.x + 16}
              y={move.y + 3}
              fill={palette.amber}
              fontSize={10}
              fontWeight={700}
            >
              {move.move.instruction}
            </text>
          </g>
        ))}
      </g>
      <g data-layer="fingerings">
        {layout.fingers.map((finger) => (
          <text
            key={`${finger.assignment.event_id}-finger`}
            data-event-id={finger.assignment.event_id}
            x={finger.x}
            y={finger.y}
            fill={
              finger.assignment.status === "manual_confirmed"
                ? palette.cedar
                : palette.amber
            }
            fontSize={17}
            fontWeight={700}
            textAnchor="middle"
          >
            {fingerCircles[finger.assignment.finger]}
          </text>
        ))}
      </g>
      <g data-layer="chords">
        {layout.chords.map((chord) => (
          <g
            key={chord.chord.id}
            data-chord-id={chord.chord.id}
            data-measure-id={chord.chord.measure_id}
            data-lane={chord.lane}
          >
            <rect
              x={chord.x - 42}
              y={chord.y - 16}
              width={84}
              height={27}
              rx={6}
              fill={palette.amberLight}
              stroke={palette.amber}
              strokeOpacity={0.35}
            />
            <text
              x={chord.x}
              y={chord.y - 3}
              fill={palette.amber}
              fontSize={12}
              fontWeight={800}
              textAnchor="middle"
            >
              {chord.chord.symbol} · {chord.chord.function}
            </text>
            <text
              x={chord.x}
              y={chord.y + 23}
              fill={palette.muted}
              fontSize={9}
              textAnchor="middle"
            >
              {chord.chord.tones
                .map((tone) => `${tone.note}${fingerCircles[tone.finger]}`)
                .join(" · ")}
            </text>
          </g>
        ))}
      </g>
    </g>
  );
}

function RelationLayers({ layout }: { layout: ScoreLayout }) {
  const ties = layout.relations.filter(
    (relation) => relation.event.kind === "tie",
  );
  const slurs = layout.relations.filter(
    (relation) => relation.event.kind === "slur",
  );
  const render = (relation: RelationLayout) => (
    <path
      key={relation.event.id}
      data-event-id={relation.event.id}
      d={relationPath(relation)}
      fill="none"
      stroke={palette.ink}
      strokeWidth={relation.event.kind === "tie" ? 1.7 : 1.2}
      strokeLinecap="round"
    />
  );
  return (
    <>
      <g data-layer="ties">{ties.map(render)}</g>
      <g data-layer="slurs">{slurs.map(render)}</g>
    </>
  );
}

function LyricsLayer({ layout }: { layout: ScoreLayout }) {
  return (
    <g data-layer="lyrics" fill={palette.ink}>
      {layout.pages.flatMap((page) =>
        page.systems.flatMap((system) =>
          system.lyrics.map((lyric) => (
            <text
              key={lyric.lyric.id}
              data-lyric-id={lyric.lyric.id}
              x={lyric.x}
              y={lyric.y}
              fontSize={14}
              letterSpacing={1.4}
              textAnchor="middle"
            >
              {lyric.lyric.text}
            </text>
          )),
        ),
      )}
    </g>
  );
}

export function ScoreSvg({
  score,
  arrangement,
  className,
}: ScoreSvgProps) {
  const layout = layoutScore(score, arrangement);
  const reactId = useId().split(":").join("");
  const titleId = `score-title-${reactId}`;
  const descriptionId = `score-description-${reactId}`;
  const keySignature = score.key_signature?.value ?? "调号未标明";
  const meter = score.meter?.value ?? "拍号未标明";

  return (
    <svg
      className={className}
      data-hymn-key={score.hymn_key}
      viewBox={layout.viewBox}
      width="100%"
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id={titleId}>
        第 {score.hymn_key} 首《{score.title}》简谱
      </title>
      <desc id={descriptionId}>
        {keySignature}，{meter}，共 {layout.pages.length} 页。谱面含音符、
        歌词、右手指法、手位和左手和弦教学标记。
      </desc>

      <g data-layer="pages">
        {layout.pages.map((page) => (
          <g key={page.id} data-page-id={page.id}>
            <rect
              x={0.5}
              y={page.y + 0.5}
              width={page.width - 1}
              height={page.height - 1}
              rx={8}
              fill={palette.paper}
              stroke={palette.line}
            />
            <text
              x={56}
              y={page.y + 35}
              fill={palette.ink}
              fontSize={18}
              fontWeight={800}
            >
              {page.index === 0
                ? `第 ${score.hymn_key} 首 · ${score.title}`
                : `${score.title} · 第 ${page.index + 1} 页`}
            </text>
            <text
              x={904}
              y={page.y + 35}
              fill={palette.muted}
              fontSize={11}
              textAnchor="end"
            >
              {keySignature} · {meter}
            </text>
          </g>
        ))}
      </g>

      <TeachingLayers layout={layout} />
      <NotationLayers layout={layout} />
      <RelationLayers layout={layout} />
      <LyricsLayer layout={layout} />
    </svg>
  );
}
