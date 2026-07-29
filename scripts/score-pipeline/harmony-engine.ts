import type {
  ArrangementRecommendation,
  ChordAssignment,
  ChordTone,
  FingerNumber,
  PianoScoreDocument,
  ScoreMeasure,
  ScoreNoteEvent,
} from "../../src/features/score/contracts";

const SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
const SHARP_NAMES = [
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
const FLAT_NAMES = [
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

interface ChordDefinition {
  function: "I" | "ii" | "IV" | "V" | "V7" | "vi";
  rootDegree: 1 | 2 | 4 | 5 | 6;
  degrees: readonly number[];
  quality: "" | "m" | "7";
}

interface MeasureContext {
  measure: ScoreMeasure;
  notes: ScoreNoteEvent[];
  globalIndex: number;
  systemIndex: number;
  indexInSystem: number;
  systemMeasureCount: number;
}

interface Voicing {
  inversion: number;
  pitches: number[];
  names: string[];
}

export interface HarmonyPlan {
  chords: ChordAssignment[];
  accompaniment: ArrangementRecommendation;
  intro: ArrangementRecommendation;
  interlude: ArrangementRecommendation;
  ending: ArrangementRecommendation;
}

const CHORDS: readonly ChordDefinition[] = [
  { function: "I", rootDegree: 1, degrees: [1, 3, 5], quality: "" },
  { function: "ii", rootDegree: 2, degrees: [2, 4, 6], quality: "m" },
  { function: "IV", rootDegree: 4, degrees: [4, 6, 1], quality: "" },
  { function: "V", rootDegree: 5, degrees: [5, 7, 2], quality: "" },
  { function: "V7", rootDegree: 5, degrees: [5, 7, 2, 4], quality: "7" },
  { function: "vi", rootDegree: 6, degrees: [6, 1, 3], quality: "m" },
];

const NATURAL_PITCH_CLASSES = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} as const;

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function tonicPitchClass(keySignature: string): number | null {
  const match = keySignature.match(/^([A-G])([♯♭]?)/u);
  if (!match) return null;
  const natural =
    NATURAL_PITCH_CLASSES[match[1] as keyof typeof NATURAL_PITCH_CLASSES];
  return mod(
    natural + (match[2] === "♯" ? 1 : match[2] === "♭" ? -1 : 0),
    12,
  );
}

function degreePitchClass(tonic: number, degree: number): number {
  return mod(tonic + SCALE_INTERVALS[mod(degree - 1, 7)], 12);
}

function noteName(pitchClass: number, preferFlats: boolean): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(pitchClass, 12)];
}

function prefersFlats(keySignature: string): boolean {
  return keySignature.includes("♭") || keySignature === "F";
}

function contexts(score: PianoScoreDocument): MeasureContext[] {
  const result: MeasureContext[] = [];
  let globalIndex = 0;
  score.pages.forEach((page) =>
    page.systems.forEach((system, systemIndex) =>
      system.measures.forEach((measure, indexInSystem) => {
        result.push({
          measure,
          notes: measure.events.filter(
            (event): event is ScoreNoteEvent => event.kind === "note",
          ),
          globalIndex,
          systemIndex,
          indexInSystem,
          systemMeasureCount: system.measures.length,
        });
        globalIndex += 1;
      }),
    ),
  );
  return result;
}

function scoreChord(
  definition: ChordDefinition,
  context: MeasureContext,
): { score: number; evidence: string[] } {
  const chordDegrees = new Set(definition.degrees);
  let score = 0;
  const evidence: string[] = [];
  for (const note of context.notes) {
    if (!chordDegrees.has(note.degree)) continue;
    const weight = note.beat === 0 ? 3 : Number.isInteger(note.beat) ? 1.5 : 1;
    score += weight;
    if (note.beat === 0) {
      evidence.push(`强拍旋律 ${note.degree} 属于 ${definition.function}`);
    }
  }
  if (context.indexInSystem === 0 && definition.function === "I") {
    score += 2.5;
    evidence.push("乐句起点优先建立主调");
  }
  if (
    context.indexInSystem === context.systemMeasureCount - 1 &&
    definition.function === "I"
  ) {
    score += 4;
    evidence.push("系统末小节优先落在主和弦");
  }
  if (
    context.indexInSystem === context.systemMeasureCount - 2 &&
    (definition.function === "V" || definition.function === "V7")
  ) {
    score += 2.5;
    evidence.push("终止前小节优先采用属功能");
  }
  const last = context.notes.at(-1);
  if (last?.degree === 1 && definition.function === "I") score += 2;
  if (
    last?.degree === 7 &&
    (definition.function === "V" || definition.function === "V7")
  ) {
    score += 2;
  }
  if (last?.degree === 4 && definition.function === "V7") score += 1.5;
  return { score, evidence };
}

function inversionNames(inversion: number): string {
  return ["root", "first", "second", "third"][inversion] ?? "root";
}

function candidateVoicings(
  definition: ChordDefinition,
  tonic: number,
  preferFlats: boolean,
): Voicing[] {
  const pitchClasses = definition.degrees.map((degree) =>
    degreePitchClass(tonic, degree),
  );
  return pitchClasses.map((_, inversion) => {
    const rotated = [
      ...pitchClasses.slice(inversion),
      ...pitchClasses.slice(0, inversion),
    ];
    const pitches: number[] = [];
    for (const pitchClass of rotated) {
      let pitch = 48 + pitchClass;
      while (pitches.length > 0 && pitch <= pitches.at(-1)!) pitch += 12;
      while (pitches.length === 0 && pitch < 45) pitch += 12;
      pitches.push(pitch);
    }
    while (pitches.at(-1)! > 67) {
      for (let index = 0; index < pitches.length; index += 1) {
        pitches[index] -= 12;
      }
    }
    return {
      inversion,
      pitches,
      names: rotated.map((pitchClass) => noteName(pitchClass, preferFlats)),
    };
  });
}

function voiceDistance(previous: number[] | null, current: number[]): number {
  if (!previous) {
    return current.reduce((sum, pitch) => sum + Math.abs(pitch - 55), 0);
  }
  return current.reduce((sum, pitch) => {
    return sum + Math.min(...previous.map((prior) => Math.abs(prior - pitch)));
  }, 0);
}

function chooseVoicing(
  definition: ChordDefinition,
  tonic: number,
  preferFlats: boolean,
  previous: number[] | null,
): Voicing {
  return candidateVoicings(definition, tonic, preferFlats).reduce(
    (best, candidate) =>
      voiceDistance(previous, candidate.pitches) <
      voiceDistance(previous, best.pitches)
        ? candidate
        : best,
  );
}

function leftHandFingers(voicing: Voicing): FingerNumber[] {
  if (voicing.pitches.length === 4) {
    return voicing.inversion % 2 === 1 ? [5, 4, 2, 1] : [5, 3, 2, 1];
  }
  const lowerSpan = voicing.pitches[1] - voicing.pitches[0];
  if (voicing.inversion === 1 || lowerSpan <= 3) return [5, 2, 1];
  return [5, 3, 1];
}

function chordSymbol(
  definition: ChordDefinition,
  tonic: number,
  preferFlats: boolean,
): string {
  return `${noteName(
    degreePitchClass(tonic, definition.rootDegree),
    preferFlats,
  )}${definition.quality}`;
}

function recommendation(
  status: ArrangementRecommendation["status"],
  text: string,
  reason: string,
): ArrangementRecommendation {
  return { status, text, reason };
}

function unavailableRecommendations(): Omit<HarmonyPlan, "chords"> {
  const unavailable = recommendation(
    "unavailable",
    "调号未确认，暂不生成和声与伴奏结论。",
    "没有可靠调号时写出实际和弦音名会造成错误教学。",
  );
  return {
    accompaniment: unavailable,
    intro: unavailable,
    interlude: unavailable,
    ending: unavailable,
  };
}

function accompanimentForMeter(
  meter: string | null,
): ArrangementRecommendation {
  if (meter === "3/4") {
    return recommendation(
      "auto_candidate",
      "低音｜和弦｜和弦",
      "三拍子第一拍建立低音，第二、三拍轻和弦以保持带唱重心。",
    );
  }
  if (meter === "6/8") {
    return recommendation(
      "auto_candidate",
      "第 1、4 个八分音符形成两大拍，其余音轻分解",
      "6/8 应听成两大拍，避免六拍平均用力。",
    );
  }
  if (meter === "2/4" || meter === "2/2") {
    return recommendation(
      "auto_candidate",
      "低音｜和弦",
      "二拍型先保证强弱和换和弦稳定。",
    );
  }
  return recommendation(
    "auto_candidate",
    "低音｜和弦｜经过低音｜和弦",
    "四拍型在第一、三拍提供方向，避免每拍同样沉重。",
  );
}

export function generateHarmonyPlan(score: PianoScoreDocument): HarmonyPlan {
  const keySignature = score.key_signature?.value ?? null;
  const tonic = keySignature ? tonicPitchClass(keySignature) : null;
  if (!keySignature || tonic === null) {
    return { chords: [], ...unavailableRecommendations() };
  }
  const preferFlats = prefersFlats(keySignature);
  const chords: ChordAssignment[] = [];
  let previousVoicing: number[] | null = null;

  for (const context of contexts(score)) {
    if (context.notes.length === 0) continue;
    const ranked = CHORDS.map((definition) => ({
      definition,
      ...scoreChord(definition, context),
    })).sort(
      (left, right) =>
        right.score - left.score ||
        CHORDS.indexOf(left.definition) - CHORDS.indexOf(right.definition),
    );
    const selected = ranked[0];
    const voicing = chooseVoicing(
      selected.definition,
      tonic,
      preferFlats,
      previousVoicing,
    );
    const fingers = leftHandFingers(voicing);
    const tones: ChordTone[] = voicing.names.map((note, index) => ({
      note,
      finger: fingers[index],
    }));
    const symbol = chordSymbol(selected.definition, tonic, preferFlats);
    chords.push({
      id: `${context.measure.id}-chord-1`,
      measure_id: context.measure.id,
      beat: 0,
      display_default: false,
      symbol,
      function: selected.definition.function,
      bass: voicing.names[0],
      inversion: inversionNames(voicing.inversion),
      tones,
      status: "auto_candidate",
      confidence: Math.min(0.92, 0.55 + selected.score * 0.04),
      evidence:
        selected.evidence.length > 0
          ? selected.evidence
          : ["根据本小节旋律和弦音覆盖率选择"],
      alternatives: ranked.slice(1, 3).map((item) => item.definition.function),
      reason: `${selected.definition.function} 覆盖本小节主要旋律音；采用 ${inversionNames(
        voicing.inversion,
      )} 转位以缩短与前一和弦的移动。`,
    });
    previousVoicing = voicing.pitches;
  }

  const meter = score.meter?.value ?? null;
  return {
    chords,
    accompaniment: accompanimentForMeter(meter),
    intro: recommendation(
      "auto_candidate",
      "取末句 2 至 4 小节，保留原拍号和主要终止",
      "末句已包含本曲调性与会众进入所需的旋律线索。",
    ),
    interlude: recommendation(
      "auto_candidate",
      "重复末句或副歌入口前 2 小节",
      "使用听过的材料可让段间衔接清楚，不额外增加陌生旋律。",
    ),
    ending: recommendation(
      "auto_candidate",
      "使用最后两个已生成和弦，并在主和弦上延长",
      "沿用实际终止进行，比统一套用固定 V7-I 更贴合本曲句法。",
    ),
  };
}
