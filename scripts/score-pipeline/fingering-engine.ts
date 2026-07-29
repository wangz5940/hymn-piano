import type {
  FingerAssignment,
  FingerNumber,
  PianoScoreDocument,
  PositionMove,
  PositionSegment,
  ScoreNoteEvent,
} from "../../src/features/score/contracts";

const SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
const FINGER_OFFSETS = [0, 2, 4, 5, 7] as const;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const NOTE_NAMES_SHARP = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;
const NOTE_NAMES_FLAT = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
] as const;
const NATURAL_PITCH_CLASSES = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} as const;
const MIN_STABLE_POSITION_NOTES = 4;
const MICRO_POSITION_DISTANCE = 2;

interface FingeringState {
  finger: FingerNumber;
  position: number;
  cost: number;
  previous: number;
}

interface PlannedNote {
  event: ScoreNoteEvent;
  pitch: number;
  finger: FingerNumber;
  position: number;
  systemId: string;
  totalCost: number;
  middleFingerAlternative: {
    finger: 2 | 3 | 4;
    position: number;
    totalCost: number;
    costDelta: number;
  } | null;
}

interface PlannedPositionRun {
  systemId: string;
  position: number;
  notes: PlannedNote[];
}

export interface FingeringPlan {
  fingerings: FingerAssignment[];
  positions: PositionSegment[];
  moves: PositionMove[];
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function tonicPitchClass(keySignature: string | null): number {
  if (!keySignature) return 0;
  const match = keySignature.match(/^([A-G])([♯♭]?)/u);
  if (!match) return 0;
  const natural =
    NATURAL_PITCH_CLASSES[
      match[1] as keyof typeof NATURAL_PITCH_CLASSES
    ];
  return mod(
    natural + (match[2] === "♯" ? 1 : match[2] === "♭" ? -1 : 0),
    12,
  );
}

export function scoreNotePitch(
  note: ScoreNoteEvent,
  keySignature: string | null,
): number {
  const tonic = tonicPitchClass(keySignature);
  const accidental =
    note.accidental === "sharp" ? 1 : note.accidental === "flat" ? -1 : 0;
  return (
    60 +
    tonic +
    SCALE_INTERVALS[note.degree - 1] +
    note.octave * 12 +
    accidental
  );
}

export function isBlackKeyPitch(pitch: number): boolean {
  return BLACK_PITCH_CLASSES.has(mod(pitch, 12));
}

function noteName(pitch: number, preferFlats: boolean): string {
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return names[mod(pitch, 12)];
}

function prefersFlats(keySignature: string | null): boolean {
  return Boolean(
    keySignature &&
      (keySignature.includes("♭") || keySignature === "F"),
  );
}

function initialCost(
  pitch: number,
  finger: FingerNumber,
  position: number,
): number {
  let cost = Math.abs(finger - 3) * 0.25 + Math.abs(position - 60) * 0.01;
  if (isBlackKeyPitch(pitch)) {
    cost += finger === 1 || finger === 5 ? 6 : -1.5;
  }
  return cost;
}

function transitionCost(
  previous: PlannedNote | FingeringState & { pitch: number },
  pitch: number,
  finger: FingerNumber,
  position: number,
): number {
  const previousPitch = previous.pitch;
  const pitchDelta = pitch - previousPitch;
  const fingerDelta = finger - previous.finger;
  const positionDelta = position - previous.position;
  let cost = 0;

  if (positionDelta === 0) {
    const expectedDelta =
      FINGER_OFFSETS[finger - 1] - FINGER_OFFSETS[previous.finger - 1];
    cost += Math.abs(expectedDelta - pitchDelta) * 0.8;
  } else {
    cost += 9 + Math.abs(positionDelta) * 0.75;
  }
  if (
    positionDelta === 0 &&
    ((pitchDelta > 0 && fingerDelta < 0) ||
      (pitchDelta < 0 && fingerDelta > 0))
  ) {
    cost += 8;
  }
  if (pitchDelta === 0 && fingerDelta !== 0) cost += 4;
  if (Math.abs(pitchDelta) > 9 && positionDelta === 0) cost += 12;
  if (isBlackKeyPitch(pitch)) {
    cost += finger === 1 || finger === 5 ? 7 : -1.25;
  }
  return cost;
}

function planSystem(
  notes: ScoreNoteEvent[],
  systemId: string,
  keySignature: string | null,
): PlannedNote[] {
  if (notes.length === 0) return [];
  const pitches = notes.map((note) => scoreNotePitch(note, keySignature));
  const layers: FingeringState[][] = [];

  notes.forEach((_, noteIndex) => {
    const pitch = pitches[noteIndex];
    const states = ([1, 2, 3, 4, 5] as FingerNumber[]).map((finger) => {
      const position = pitch - FINGER_OFFSETS[finger - 1];
      if (noteIndex === 0) {
        return {
          finger,
          position,
          cost: initialCost(pitch, finger, position),
          previous: -1,
        };
      }
      let bestCost = Number.POSITIVE_INFINITY;
      let bestPrevious = -1;
      layers[noteIndex - 1].forEach((previous, previousIndex) => {
        const candidate =
          previous.cost +
          transitionCost(
            { ...previous, pitch: pitches[noteIndex - 1] },
            pitch,
            finger,
            position,
          );
        if (candidate < bestCost) {
          bestCost = candidate;
          bestPrevious = previousIndex;
        }
      });
      return {
        finger,
        position,
        cost: bestCost,
        previous: bestPrevious,
      };
    });
    layers.push(states);
  });

  const suffixCosts = layers.map((states) => states.map(() => 0));
  for (let noteIndex = notes.length - 2; noteIndex >= 0; noteIndex -= 1) {
    layers[noteIndex].forEach((state, stateIndex) => {
      suffixCosts[noteIndex][stateIndex] = Math.min(
        ...layers[noteIndex + 1].map(
          (nextState, nextStateIndex) =>
            transitionCost(
              { ...state, pitch: pitches[noteIndex] },
              pitches[noteIndex + 1],
              nextState.finger,
              nextState.position,
            ) + suffixCosts[noteIndex + 1][nextStateIndex],
        ),
      );
    });
  }

  let stateIndex = layers.at(-1)!.reduce(
    (best, state, index, states) =>
      state.cost < states[best].cost ? index : best,
    0,
  );
  const selectedStateIndexes = new Array<number>(notes.length);
  for (let noteIndex = notes.length - 1; noteIndex >= 0; noteIndex -= 1) {
    selectedStateIndexes[noteIndex] = stateIndex;
    stateIndex = layers[noteIndex][stateIndex].previous;
  }

  const result = new Array<PlannedNote>(notes.length);
  for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
    const selectedStateIndex = selectedStateIndexes[noteIndex];
    const state = layers[noteIndex][selectedStateIndex];
    const totalCost =
      state.cost + suffixCosts[noteIndex][selectedStateIndex];
    const middleFingerAlternative = layers[noteIndex]
      .map((candidate, candidateIndex) => ({
        finger: candidate.finger,
        position: candidate.position,
        totalCost:
          candidate.cost + suffixCosts[noteIndex][candidateIndex],
      }))
      .filter(
        (
          candidate,
        ): candidate is {
          finger: 2 | 3 | 4;
          position: number;
          totalCost: number;
        } =>
          candidate.finger === 2 ||
          candidate.finger === 3 ||
          candidate.finger === 4,
      )
      .reduce((best, candidate) =>
        candidate.totalCost < best.totalCost ? candidate : best,
      );
    result[noteIndex] = {
      event: notes[noteIndex],
      pitch: pitches[noteIndex],
      finger: state.finger,
      position: state.position,
      systemId,
      totalCost,
      middleFingerAlternative:
        state.finger === 1 || state.finger === 5
          ? {
              ...middleFingerAlternative,
              costDelta: Math.max(
                0,
                middleFingerAlternative.totalCost - totalCost,
              ),
            }
          : null,
    };
  }
  return result;
}

function blackKeyExceptionContext(
  planned: PlannedNote[],
  index: number,
  alternativePosition: number,
): string {
  const current = planned[index];
  const previous = planned[index - 1];
  const next = planned[index + 1];
  const preservesPreviousPosition =
    previous?.systemId === current.systemId &&
    previous.position === current.position &&
    previous.position !== alternativePosition;
  const preservesNextPosition =
    next?.systemId === current.systemId &&
    next.position === current.position &&
    next.position !== alternativePosition;

  if (preservesPreviousPosition && preservesNextPosition) {
    return "保持前后音的固定手位，替代中间指会造成额外换位";
  }
  if (preservesPreviousPosition) {
    return "保持前一音延续的固定手位，替代中间指会造成额外换位";
  }
  if (preservesNextPosition) {
    return "衔接后续音的固定手位，替代中间指会造成额外换位";
  }
  return "全句规划已计入衔接前后音、额外换位与反向交叉";
}

function blackKeyReason(
  planned: PlannedNote[],
  index: number,
  preferFlats: boolean,
): string {
  const item = planned[index];
  const name = noteName(item.pitch, preferFlats);
  const alternative = item.middleFingerAlternative;
  if (!alternative) {
    return `${name} 是黑键，优先使用 ${item.finger} 指，避免拇指或小指触黑键。`;
  }

  const context = blackKeyExceptionContext(
    planned,
    index,
    alternative.position,
  );
  return `${name} 是黑键，通常优先使用 2、3、4 指；本处使用 ${item.finger} 指，是为了${context}。未采用 ${alternative.finger} 指：当前方案全句总成本比该替代方案低 ${alternative.costDelta.toFixed(2)}（${item.totalCost.toFixed(2)} 对 ${alternative.totalCost.toFixed(2)}）。`;
}

function positionFingerNotes(
  position: number,
  preferFlats: boolean,
): Partial<Record<FingerNumber, string>> {
  return Object.fromEntries(
    FINGER_OFFSETS.map((offset, index) => [
      (index + 1) as FingerNumber,
      noteName(position + offset, preferFlats),
    ]),
  );
}

function positionReason(
  planned: PlannedNote[],
  keyKnown: boolean,
): string {
  const hasBlackKey = planned.some((item) => isBlackKeyPitch(item.pitch));
  const details = hasBlackKey
    ? "黑键优先交给 2、3、4 指，减少拇指或小指扭转。"
    : "此区段优先保持固定手位，减少看手和临时伸指。";
  return `${details}${keyKnown ? "" : " 调号未确认，音名按 C 调相对位置显示，指序仍依据旋律走向。"}`
}

function representativePosition(notes: PlannedNote[]): number {
  const counts = new Map<number, number>();
  for (const note of notes) {
    counts.set(note.position, (counts.get(note.position) ?? 0) + 1);
  }
  const median = [...notes]
    .map((note) => note.position)
    .sort((left, right) => left - right)[Math.floor((notes.length - 1) / 2)];
  return [...counts.entries()].reduce(
    (best, candidate) =>
      candidate[1] > best[1] ||
      (candidate[1] === best[1] &&
        Math.abs(candidate[0] - median) < Math.abs(best[0] - median))
        ? candidate
        : best,
  )[0];
}

function mergePositionRuns(
  left: PlannedPositionRun,
  right: PlannedPositionRun,
): PlannedPositionRun {
  const notes = [...left.notes, ...right.notes];
  return {
    systemId: left.systemId,
    position: representativePosition(notes),
    notes,
  };
}

function shortRunMergeTarget(
  runs: PlannedPositionRun[],
  index: number,
): number {
  if (index === 0) return 1;
  if (index === runs.length - 1) return index - 1;
  const current = runs[index];
  const left = runs[index - 1];
  const right = runs[index + 1];
  const leftDistance = Math.abs(current.position - left.position);
  const rightDistance = Math.abs(current.position - right.position);
  if (leftDistance !== rightDistance) {
    return leftDistance < rightDistance ? index - 1 : index + 1;
  }
  return left.notes.length >= right.notes.length ? index - 1 : index + 1;
}

function stablePositionRuns(notes: PlannedNote[]): PlannedPositionRun[] {
  if (notes.length === 0) return [];
  const runs: PlannedPositionRun[] = [];
  for (const note of notes) {
    const current = runs.at(-1);
    if (
      current &&
      current.systemId === note.systemId &&
      current.position === note.position
    ) {
      current.notes.push(note);
    } else {
      runs.push({
        systemId: note.systemId,
        position: note.position,
        notes: [note],
      });
    }
  }

  while (runs.length > 1) {
    const shortIndex = runs.reduce(
      (selected, run, index) =>
        run.notes.length < MIN_STABLE_POSITION_NOTES &&
        (selected === -1 ||
          run.notes.length < runs[selected].notes.length)
          ? index
          : selected,
      -1,
    );
    if (shortIndex === -1) break;
    const targetIndex = shortRunMergeTarget(runs, shortIndex);
    const leftIndex = Math.min(shortIndex, targetIndex);
    runs.splice(
      leftIndex,
      2,
      mergePositionRuns(runs[leftIndex], runs[leftIndex + 1]),
    );
  }

  let index = 0;
  while (index < runs.length - 1) {
    if (
      Math.abs(runs[index].position - runs[index + 1].position) <=
      MICRO_POSITION_DISTANCE
    ) {
      runs.splice(
        index,
        2,
        mergePositionRuns(runs[index], runs[index + 1]),
      );
      if (index > 0) index -= 1;
    } else {
      index += 1;
    }
  }
  return runs;
}

export function generateFingeringPlan(
  score: PianoScoreDocument,
): FingeringPlan {
  const keySignature = score.key_signature?.value ?? null;
  const preferFlats = prefersFlats(keySignature);
  const planned: PlannedNote[] = [];
  for (const page of score.pages) {
    for (const system of page.systems) {
      const notes = system.measures.flatMap((measure) =>
        measure.events.filter(
          (event): event is ScoreNoteEvent => event.kind === "note",
        ),
      );
      planned.push(...planSystem(notes, system.id, keySignature));
    }
  }

  const fingerings: FingerAssignment[] = planned.map((item, index) => {
    const previous = planned[index - 1];
    const moved =
      previous?.systemId === item.systemId &&
      previous.position !== item.position;
    const blackKey = isBlackKeyPitch(item.pitch);
    return {
      event_id: item.event.id,
      finger: item.finger,
      hand: "right",
      status: "auto_candidate",
      confidence: keySignature ? 0.82 : 0.68,
      reason: blackKey
        ? blackKeyReason(planned, index, preferFlats)
        : moved
          ? `为后续音域整体移动手位，本音用 ${item.finger} 指落位。`
          : `保持当前手位并顺着旋律方向使用 ${item.finger} 指。`,
    };
  });

  const positions: PositionSegment[] = [];
  let systemStart = 0;
  while (systemStart < planned.length) {
    const systemId = planned[systemStart].systemId;
    let systemEnd = systemStart + 1;
    while (
      systemEnd < planned.length &&
      planned[systemEnd].systemId === systemId
    ) {
      systemEnd += 1;
    }
    for (const run of stablePositionRuns(
      planned.slice(systemStart, systemEnd),
    )) {
      positions.push({
        id: `${systemId}-position-${positions.length + 1}`,
        start_event_id: run.notes[0].event.id,
        end_event_id: run.notes.at(-1)!.event.id,
        label: `${noteName(run.position, preferFlats)} Position`,
        finger_notes: positionFingerNotes(run.position, preferFlats),
        status: "auto_candidate",
        confidence: keySignature ? 0.82 : 0.68,
        reason: positionReason(run.notes, Boolean(keySignature)),
      });
    }
    systemStart = systemEnd;
  }

  const moves: PositionMove[] = [];
  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1];
    const current = positions[index];
    const previousNote = planned.find(
      (item) => item.event.id === previous.end_event_id,
    );
    const currentNote = planned.find(
      (item) => item.event.id === current.start_event_id,
    );
    if (
      !previousNote ||
      !currentNote ||
      previousNote.systemId !== currentNote.systemId
    ) {
      continue;
    }
    moves.push({
      id: `${current.id}-move`,
      trigger_event_id: current.start_event_id,
      from_position_id: previous.id,
      to_position_id: current.id,
      instruction: `Move to ${current.label}`,
      reason: "旋律超出原手位或需要为后续音符预留手指，在此音前整体移动手掌。",
    });
  }

  return { fingerings, positions, moves };
}
