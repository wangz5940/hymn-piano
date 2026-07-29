import type {
  ChordAssignment,
  FingerAssignment,
  PianoArrangementDocument,
  PianoScoreDocument,
  PositionMove,
  PositionSegment,
  ScoreEvent,
  ScoreLyric,
  ScoreMeasure,
} from "./contracts";

const PAGE_WIDTH = 960;
const PAGE_PADDING_X = 56;
const PAGE_HEADER_HEIGHT = 76;
const PAGE_PADDING_BOTTOM = 42;
const SYSTEM_HEIGHT = 214;
const SYSTEM_GAP = 28;
const SCORE_BASELINE_OFFSET = 104;
const MEASURE_GAP = 8;
const MEASURE_PADDING = 14;
const POSITION_TRACK_HEIGHT = 19;
const CHORD_TRACK_HEIGHT = 32;

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface EventLayout extends LayoutPoint {
  event: ScoreEvent;
  page_id: string;
  system_id: string;
  measure_id: string;
  measure_x: number;
  measure_width: number;
  baseline_y: number;
}

export interface MeasureLayout {
  id: string;
  number: number;
  page_id: string;
  system_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  beat_span: number;
  events: EventLayout[];
}

export interface LyricLayout extends LayoutPoint {
  lyric: ScoreLyric;
  page_id: string;
  system_id: string;
}

export interface SystemLayout {
  id: string;
  page_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  baseline_y: number;
  measures: MeasureLayout[];
  lyrics: LyricLayout[];
}

export interface PageLayout {
  id: string;
  index: number;
  y: number;
  width: number;
  height: number;
  systems: SystemLayout[];
}

export interface FingerLayout extends LayoutPoint {
  assignment: FingerAssignment;
  event: EventLayout;
}

export interface PositionLayout {
  segment: PositionSegment;
  page_id: string;
  system_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lane: number;
}

export interface MoveLayout extends LayoutPoint {
  move: PositionMove;
  page_id: string;
  system_id: string;
  lane: number;
}

export interface ChordLayout extends LayoutPoint {
  chord: ChordAssignment;
  page_id: string;
  system_id: string;
  lane: number;
}

export interface RelationLayout {
  event: ScoreEvent & { kind: "tie" | "slur" };
  from: LayoutPoint;
  to: LayoutPoint;
  page_id: string;
  system_id: string;
}

export interface ScoreLayout {
  width: number;
  height: number;
  viewBox: string;
  pages: PageLayout[];
  events: EventLayout[];
  event_index: Readonly<Record<string, EventLayout>>;
  measures: MeasureLayout[];
  measure_index: Readonly<Record<string, MeasureLayout>>;
  fingers: FingerLayout[];
  positions: PositionLayout[];
  moves: MoveLayout[];
  chords: ChordLayout[];
  relations: RelationLayout[];
}

interface Interval {
  id: string;
  start: number;
  end: number;
}

interface PointLabel {
  id: string;
  x: number;
  width: number;
}

function groupBy<T>(
  values: T[],
  keyFor: (value: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function rhythmicSpan(measure: ScoreMeasure): number {
  const end = measure.events.reduce((maximum, event) => {
    if (event.kind !== "note" && event.kind !== "rest") return maximum;
    return Math.max(maximum, event.beat + Math.max(event.duration, 0.125));
  }, 0);
  return Math.max(1, end);
}

function eventBeat(event: ScoreEvent, beatSpan: number): number {
  if (event.kind === "barline") return beatSpan;
  return Math.max(0, Math.min(event.beat, beatSpan));
}

function allocateLanes(intervals: Interval[]): Map<string, number> {
  const lanes: number[] = [];
  const result = new Map<string, number>();
  const sorted = [...intervals].sort(
    (left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.id.localeCompare(right.id),
  );

  for (const interval of sorted) {
    let lane = lanes.findIndex((lastEnd) => lastEnd < interval.start);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(interval.end);
    } else {
      lanes[lane] = interval.end;
    }
    result.set(interval.id, lane);
  }

  return result;
}

function allocatePointLanes(labels: PointLabel[]): Map<string, number> {
  return allocateLanes(
    labels.map((label) => ({
      id: label.id,
      start: label.x - label.width / 2,
      end: label.x + label.width / 2,
    })),
  );
}

function buildLyrics(
  lyrics: ScoreLyric[],
  eventIndex: Record<string, EventLayout>,
  pageId: string,
  systemId: string,
  baselineY: number,
): LyricLayout[] {
  return lyrics.flatMap((lyric, index) => {
    const anchors = lyric.event_ids
      .map((eventId) => eventIndex[eventId])
      .filter(
        (event): event is EventLayout =>
          Boolean(event) &&
          event.page_id === pageId &&
          event.system_id === systemId,
      );
    if (anchors.length === 0) return [];
    const x =
      anchors.reduce((sum, anchor) => sum + anchor.x, 0) / anchors.length;
    return [
      {
        lyric,
        page_id: pageId,
        system_id: systemId,
        x: round(x),
        y: round(baselineY + 38 + index * 22),
      },
    ];
  });
}

function positionLayouts(
  arrangement: PianoArrangementDocument | undefined,
  eventIndex: Record<string, EventLayout>,
): PositionLayout[] {
  if (!arrangement) return [];
  const candidates = arrangement.positions.flatMap((segment) => {
    const start = eventIndex[segment.start_event_id];
    const end = eventIndex[segment.end_event_id];
    if (
      !start ||
      !end ||
      start.page_id !== end.page_id ||
      start.system_id !== end.system_id
    ) {
      return [];
    }
    const left = Math.min(start.x, end.x) - 12;
    const right = Math.max(start.x, end.x) + 12;
    return [{ segment, start, end, left, right }];
  });

  const groups = groupBy(
    candidates,
    (candidate) => `${candidate.start.page_id}:${candidate.start.system_id}`,
  );
  const layouts: PositionLayout[] = [];

  for (const group of groups.values()) {
    const lanes = allocateLanes(
      group.map((candidate) => ({
        id: candidate.segment.id,
        start: candidate.left,
        end: candidate.right,
      })),
    );
    for (const candidate of group) {
      const lane = lanes.get(candidate.segment.id) ?? 0;
      layouts.push({
        segment: candidate.segment,
        page_id: candidate.start.page_id,
        system_id: candidate.start.system_id,
        x: round(candidate.left),
        y: round(
          candidate.start.baseline_y -
            79 -
            lane * (POSITION_TRACK_HEIGHT + 4),
        ),
        width: round(Math.max(24, candidate.right - candidate.left)),
        height: POSITION_TRACK_HEIGHT,
        lane,
      });
    }
  }

  return layouts.sort(
    (left, right) =>
      left.y - right.y ||
      left.x - right.x ||
      left.segment.id.localeCompare(right.segment.id),
  );
}

function moveLayouts(
  arrangement: PianoArrangementDocument | undefined,
  eventIndex: Record<string, EventLayout>,
  positions: PositionLayout[],
): MoveLayout[] {
  if (!arrangement) return [];
  const positionById = new Map(
    positions.map((position) => [position.segment.id, position]),
  );

  return arrangement.moves.flatMap((move) => {
    const event = eventIndex[move.trigger_event_id];
    if (!event) return [];
    const target = positionById.get(move.to_position_id);
    const lane = target?.lane ?? 0;
    return [
      {
        move,
        page_id: event.page_id,
        system_id: event.system_id,
        x: event.x,
        y: round(
          event.baseline_y -
            88 -
            (lane + 1) * (POSITION_TRACK_HEIGHT + 4),
        ),
        lane,
      },
    ];
  });
}

function chordLayouts(
  arrangement: PianoArrangementDocument | undefined,
  measureIndex: Record<string, MeasureLayout>,
): ChordLayout[] {
  if (!arrangement) return [];
  const candidates = arrangement.chords
    .filter((chord) => chord.display_default)
    .flatMap((chord) => {
      const measure = measureIndex[chord.measure_id];
      if (!measure) return [];
      const ratio = Math.max(
        0,
        Math.min(1, chord.beat / measure.beat_span),
      );
      const x =
        measure.x +
        MEASURE_PADDING +
        ratio * Math.max(1, measure.width - MEASURE_PADDING * 2);
      const labelWidth = Math.max(
        78,
        chord.symbol.length * 12 + chord.tones.length * 28,
      );
      return [{ chord, measure, x, labelWidth }];
    });
  const groups = groupBy(
    candidates,
    (candidate) =>
      `${candidate.measure.page_id}:${candidate.measure.system_id}`,
  );
  const layouts: ChordLayout[] = [];

  for (const group of groups.values()) {
    const lanes = allocatePointLanes(
      group.map((candidate) => ({
        id: candidate.chord.id,
        x: candidate.x,
        width: candidate.labelWidth,
      })),
    );
    for (const candidate of group) {
      const lane = lanes.get(candidate.chord.id) ?? 0;
      layouts.push({
        chord: candidate.chord,
        page_id: candidate.measure.page_id,
        system_id: candidate.measure.system_id,
        x: round(candidate.x),
        y: round(
          candidate.measure.y +
            SCORE_BASELINE_OFFSET +
            70 +
            lane * CHORD_TRACK_HEIGHT,
        ),
        lane,
      });
    }
  }

  return layouts.sort(
    (left, right) =>
      left.y - right.y ||
      left.x - right.x ||
      left.chord.id.localeCompare(right.chord.id),
  );
}

function relationLayouts(
  events: EventLayout[],
  eventIndex: Record<string, EventLayout>,
): RelationLayout[] {
  return events.flatMap((layout) => {
    const event = layout.event;
    if (event.kind !== "tie" && event.kind !== "slur") return [];
    const from = eventIndex[event.from_event_id];
    const to = eventIndex[event.to_event_id];
    if (
      !from ||
      !to ||
      from.page_id !== to.page_id ||
      from.system_id !== to.system_id
    ) {
      return [];
    }
    return [
      {
        event,
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        page_id: from.page_id,
        system_id: from.system_id,
      },
    ];
  });
}

export function layoutScore(
  score: PianoScoreDocument,
  arrangement?: PianoArrangementDocument,
): ScoreLayout {
  if (arrangement && arrangement.hymn_key !== score.hymn_key) {
    throw new Error(
      `编配曲目 ${arrangement.hymn_key} 与谱面曲目 ${score.hymn_key} 不一致`,
    );
  }

  const pages: PageLayout[] = [];
  const events: EventLayout[] = [];
  const measures: MeasureLayout[] = [];
  const eventIndex: Record<string, EventLayout> = {};
  const measureIndex: Record<string, MeasureLayout> = {};
  let pageY = 0;

  score.pages.forEach((page, pageIndex) => {
    const systemCount = Math.max(1, page.systems.length);
    const pageHeight =
      PAGE_HEADER_HEIGHT +
      systemCount * SYSTEM_HEIGHT +
      Math.max(0, systemCount - 1) * SYSTEM_GAP +
      PAGE_PADDING_BOTTOM;
    const pageLayout: PageLayout = {
      id: page.id,
      index: pageIndex,
      y: pageY,
      width: PAGE_WIDTH,
      height: pageHeight,
      systems: [],
    };

    page.systems.forEach((system, systemIndex) => {
      const systemX = PAGE_PADDING_X;
      const systemY =
        pageY + PAGE_HEADER_HEIGHT + systemIndex * (SYSTEM_HEIGHT + SYSTEM_GAP);
      const systemWidth = PAGE_WIDTH - PAGE_PADDING_X * 2;
      const baselineY = systemY + SCORE_BASELINE_OFFSET;
      const beatSpans = system.measures.map(rhythmicSpan);
      const totalWeight = beatSpans.reduce((sum, span) => sum + span, 0) || 1;
      const usableWidth =
        systemWidth - Math.max(0, system.measures.length - 1) * MEASURE_GAP;
      let cursorX = systemX;
      const systemMeasures: MeasureLayout[] = [];

      system.measures.forEach((measure, measureIndexInSystem) => {
        const beatSpan = beatSpans[measureIndexInSystem] ?? 1;
        const width =
          measureIndexInSystem === system.measures.length - 1
            ? systemX + systemWidth - cursorX
            : usableWidth * (beatSpan / totalWeight);
        const measureLayout: MeasureLayout = {
          id: measure.id,
          number: measure.number,
          page_id: page.id,
          system_id: system.id,
          x: round(cursorX),
          y: round(systemY),
          width: round(width),
          height: SYSTEM_HEIGHT,
          beat_span: beatSpan,
          events: [],
        };
        const innerWidth = Math.max(1, width - MEASURE_PADDING * 2);

        measure.events.forEach((event) => {
          const ratio = eventBeat(event, beatSpan) / beatSpan;
          const eventLayout: EventLayout = {
            event,
            page_id: page.id,
            system_id: system.id,
            measure_id: measure.id,
            measure_x: measureLayout.x,
            measure_width: measureLayout.width,
            baseline_y: round(baselineY),
            x: round(cursorX + MEASURE_PADDING + ratio * innerWidth),
            y: round(baselineY),
          };
          measureLayout.events.push(eventLayout);
          events.push(eventLayout);
          eventIndex[event.id] = eventLayout;
        });

        systemMeasures.push(measureLayout);
        measures.push(measureLayout);
        measureIndex[measure.id] = measureLayout;
        cursorX += width + MEASURE_GAP;
      });

      pageLayout.systems.push({
        id: system.id,
        page_id: page.id,
        x: systemX,
        y: round(systemY),
        width: systemWidth,
        height: SYSTEM_HEIGHT,
        baseline_y: round(baselineY),
        measures: systemMeasures,
        lyrics: [],
      });
    });

    pages.push(pageLayout);
    pageY += pageHeight + (pageIndex < score.pages.length - 1 ? 30 : 0);
  });

  score.pages.forEach((page) => {
    page.systems.forEach((system) => {
      const target = pages
        .find((pageLayout) => pageLayout.id === page.id)
        ?.systems.find((systemLayout) => systemLayout.id === system.id);
      if (target) {
        target.lyrics = buildLyrics(
          system.lyrics,
          eventIndex,
          page.id,
          system.id,
          target.baseline_y,
        );
      }
    });
  });

  const positions = positionLayouts(arrangement, eventIndex);
  const fingers =
    arrangement?.fingerings.flatMap((assignment) => {
      const event = eventIndex[assignment.event_id];
      if (!event) return [];
      return [
        {
          assignment,
          event,
          x: event.x,
          y: round(event.y - 34),
        },
      ];
    }) ?? [];
  const height = Math.max(
    1,
    pages.length > 0
      ? pages[pages.length - 1].y + pages[pages.length - 1].height
      : PAGE_HEADER_HEIGHT + SYSTEM_HEIGHT + PAGE_PADDING_BOTTOM,
  );

  return {
    width: PAGE_WIDTH,
    height: round(height),
    viewBox: `0 0 ${PAGE_WIDTH} ${round(height)}`,
    pages,
    events,
    event_index: eventIndex,
    measures,
    measure_index: measureIndex,
    fingers,
    positions,
    moves: moveLayouts(arrangement, eventIndex, positions),
    chords: chordLayouts(arrangement, measureIndex),
    relations: relationLayouts(events, eventIndex),
  };
}
