import type { ScoreNoteEvent } from "./contracts";

const SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
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

export function prefersFlatNoteNames(keySignature: string | null): boolean {
  return Boolean(
    keySignature &&
      (keySignature.includes("♭") || keySignature === "F"),
  );
}

export function pitchClassName(
  pitch: number,
  preferFlats: boolean,
): string {
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return names[mod(pitch, 12)];
}

export function midiPitchName(
  pitch: number,
  preferFlats: boolean,
): string {
  return `${pitchClassName(pitch, preferFlats)}${Math.floor(pitch / 12) - 1}`;
}

export function scoreNoteName(
  note: ScoreNoteEvent,
  keySignature: string | null,
): string {
  return midiPitchName(
    scoreNotePitch(note, keySignature),
    prefersFlatNoteNames(keySignature),
  );
}
