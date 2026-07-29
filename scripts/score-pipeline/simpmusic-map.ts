export const SIMPMUSIC_DECODER_VERSION = "simpmusic-decoder/v3";
export const SIMPMUSIC_BASE_UNKNOWN_ALLOWLIST_VERSION =
  "simpmusic-base-unknown/v2";
export const SIMPMUSIC_INVENTORY_SCHEMA = "shiqin-simpmusic-inventory/v1";

export type SimpMusicDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface NoteGlyphMapping {
  degree: SimpMusicDegree;
  octave: number;
  duration: number;
  beams: number;
  confidence: "confirmed" | "conservative";
}

function noteRow(
  glyphs: string,
  octave: number,
  duration: number,
  beams: number,
): Record<string, NoteGlyphMapping> {
  return Object.fromEntries(
    Array.from(glyphs, (glyph, index) => [
      glyph,
      {
        degree: (index + 1) as SimpMusicDegree,
        octave,
        duration,
        beams,
        confidence: "confirmed" as const,
      },
    ]),
  );
}

function noteSequence(
  glyphs: string,
  degrees: readonly SimpMusicDegree[],
  octave: number,
  duration: number,
  beams: number,
): Record<string, NoteGlyphMapping> {
  return Object.fromEntries(
    Array.from(glyphs, (glyph, index) => [
      glyph,
      {
        degree: degrees[index],
        octave,
        duration,
        beams,
        confidence: "confirmed" as const,
      },
    ]),
  );
}

const LOW_FIVE_TO_ONE = [5, 6, 7, 1] as const;

export const BASE_NOTE_GLYPHS: Readonly<Record<string, NoteGlyphMapping>> = {
  ...noteRow("1234567", 0, 1, 0),
  ...noteRow("qwertyu", 0, 0.5, 1),
  ...noteRow("asdfghj", 0, 0.25, 2),
  ...noteRow("zxcvbnm", 0, 0.125, 3),
  ...noteRow("!@#$", 1, 1, 0),
  ...noteSequence("%^&*", LOW_FIVE_TO_ONE, -1, 1, 0),
  ...noteRow("QWER", 1, 0.5, 1),
  ...noteSequence("TYUI", LOW_FIVE_TO_ONE, -1, 0.5, 1),
  ...noteRow("ASDF", 1, 0.25, 2),
  ...noteSequence("GHJK", LOW_FIVE_TO_ONE, -1, 0.25, 2),
  ...noteRow("ZXCV", 1, 0.125, 3),
  ...noteSequence("BNM<", LOW_FIVE_TO_ONE, -1, 0.125, 3),
};

const EXTENDED_PUA_NOTE_GLYPHS: Readonly<
  Record<number, NoteGlyphMapping>
> = {
  0xf086: {
    degree: 1,
    octave: -1,
    duration: 1,
    beams: 0,
    confidence: "confirmed",
  },
  0xf087: {
    degree: 2,
    octave: -1,
    duration: 1,
    beams: 0,
    confidence: "confirmed",
  },
  0xf088: {
    degree: 3,
    octave: -1,
    duration: 1,
    beams: 0,
    confidence: "confirmed",
  },
  0xf090: {
    degree: 1,
    octave: -1,
    duration: 0.5,
    beams: 1,
    confidence: "confirmed",
  },
  0xf091: {
    degree: 2,
    octave: -1,
    duration: 0.5,
    beams: 1,
    confidence: "confirmed",
  },
  0xf092: {
    degree: 3,
    octave: -1,
    duration: 0.5,
    beams: 1,
    confidence: "confirmed",
  },
  0xf09a: {
    degree: 1,
    octave: -1,
    duration: 0.25,
    beams: 2,
    confidence: "confirmed",
  },
  0xf09b: {
    degree: 2,
    octave: -1,
    duration: 0.25,
    beams: 2,
    confidence: "confirmed",
  },
  0xf09c: {
    degree: 3,
    octave: -1,
    duration: 0.25,
    beams: 2,
    confidence: "confirmed",
  },
  0xf0a7: {
    degree: 5,
    octave: 1,
    duration: 1,
    beams: 0,
    confidence: "conservative",
  },
  0xf0a8: {
    degree: 6,
    octave: 1,
    duration: 1,
    beams: 0,
    confidence: "conservative",
  },
  0xf0b1: {
    degree: 5,
    octave: 1,
    duration: 0.5,
    beams: 1,
    confidence: "conservative",
  },
  0xf0bb: {
    degree: 5,
    octave: 1,
    duration: 0.25,
    beams: 2,
    confidence: "conservative",
  },
};

const CONFIRMED_CODE_POINT_NOTE_GLYPHS: Readonly<
  Record<number, NoteGlyphMapping>
> = {
  0x2013: {
    degree: 2,
    octave: 2,
    duration: 1,
    beams: 0,
    confidence: "confirmed",
  },
};

export const OBSERVED_BASE_CODE_POINTS = [
  0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x2a, 0x2d, 0x30, 0x31,
  0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x40, 0x41,
  0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x51, 0x52,
  0x53, 0x54, 0x55, 0x57, 0x59, 0x5b, 0x5c, 0x5d, 0x5e, 0x61, 0x64,
  0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6f, 0x70, 0x71, 0x72,
  0x73, 0x74, 0x75, 0x77, 0x79, 0x7c, 0x2013, 0xf021, 0xf023,
  0xf024, 0xf02a, 0xf02d, 0xf035, 0xf036, 0xf037, 0xf039, 0xf040,
  0xf044, 0xf049, 0xf04b, 0xf04c, 0xf051, 0xf057, 0xf065, 0xf06b,
  0xf06f, 0xf07c, 0xf086, 0xf087, 0xf088, 0xf090, 0xf091, 0xf092,
  0xf09a, 0xf09c, 0xf0a7, 0xf0a8, 0xf0b1, 0xf0bb,
] as const;

export const OBSERVED_ACCENT_CHARACTERS = ["-", "3", "Z", "c", "v", "z"];

export const SUPPORTED_BUT_UNOBSERVED_BASE_CODE_POINTS = [0xf09b] as const;

export interface AllowlistedUnknownGlyph {
  code_point: number;
  raw: string;
  reason: string;
}

export const BASE_UNKNOWN_GLYPH_ALLOWLIST: readonly AllowlistedUnknownGlyph[] =
  [];

export type BaseGlyphClassification =
  | ({ kind: "note" } & NoteGlyphMapping)
  | { kind: "rest"; duration: number; beams: number }
  | { kind: "augmentation_dot"; beams: number }
  | { kind: "beam_connector"; beams: number }
  | { kind: "sustain" }
  | { kind: "barline" }
  | { kind: "final_barline" }
  | { kind: "repeat"; direction: "start" | "end" }
  | {
      kind: "accidental";
      accidental: "flat" | "natural" | "sharp";
    }
  | { kind: "spacing"; reason: string }
  | {
      kind: "unknown_allowlisted";
      reason: string;
      allowlist_version: typeof SIMPMUSIC_BASE_UNKNOWN_ALLOWLIST_VERSION;
    }
  | { kind: "unknown_unallowlisted"; reason: string };

export type AccentCharacterClassification =
  | { kind: "arc" }
  | { kind: "triplet_or_bracket_component" }
  | { kind: "final_barline_candidate" }
  | { kind: "unknown_unallowlisted"; reason: string };

export function normalizeSymbolCodePoint(codePoint: number): number {
  if (codePoint >= 0xf020 && codePoint <= 0xf07e) {
    return codePoint - 0xf000;
  }
  return codePoint;
}

export function lookupNoteGlyph(
  rawCharacter: string,
): NoteGlyphMapping | undefined {
  const codePoint = rawCharacter.codePointAt(0);
  if (codePoint === undefined) return undefined;
  const confirmed = CONFIRMED_CODE_POINT_NOTE_GLYPHS[codePoint];
  if (confirmed) return confirmed;
  const extended = EXTENDED_PUA_NOTE_GLYPHS[codePoint];
  if (extended) return extended;
  return BASE_NOTE_GLYPHS[
    String.fromCodePoint(normalizeSymbolCodePoint(codePoint))
  ];
}

export function normalizedGlyph(rawCharacter: string): string {
  const codePoint = rawCharacter.codePointAt(0);
  return codePoint === undefined
    ? ""
    : String.fromCodePoint(normalizeSymbolCodePoint(codePoint));
}

export function findAllowlistedUnknownBaseGlyph(
  rawCharacter: string,
): AllowlistedUnknownGlyph | undefined {
  const codePoint = rawCharacter.codePointAt(0);
  return codePoint === undefined
    ? undefined
    : BASE_UNKNOWN_GLYPH_ALLOWLIST.find(
        (entry) => entry.code_point === codePoint && entry.raw === rawCharacter,
      );
}

export function classifyBaseGlyph(
  rawCharacter: string,
): BaseGlyphClassification {
  const note = lookupNoteGlyph(rawCharacter);
  if (note) return { kind: "note", ...note };

  const normalized = normalizedGlyph(rawCharacter);
  if (normalized === "0") {
    return { kind: "rest", duration: 1, beams: 0 };
  }
  if (normalized === "p") {
    return { kind: "rest", duration: 0.5, beams: 1 };
  }
  if (normalized === "L") {
    return { kind: "accidental", accidental: "sharp" };
  }
  if (normalized === '"') {
    return { kind: "accidental", accidental: "natural" };
  }
  if (normalized === ":") {
    return { kind: "accidental", accidental: "flat" };
  }
  if (normalized === "[") return { kind: "repeat", direction: "start" };
  if (normalized === "]") return { kind: "repeat", direction: "end" };
  if (normalized === "\\") return { kind: "final_barline" };
  if (normalized === "-") return { kind: "sustain" };
  if (normalized === "|") return { kind: "barline" };
  if (normalized === "i" || normalized === "k") {
    return {
      kind: "beam_connector",
      beams: normalized === "i" ? 1 : 2,
    };
  }
  if (normalized === "o" || normalized === "l" || normalized === "9") {
    return {
      kind: "augmentation_dot",
      beams: normalized === "o" ? 1 : normalized === "l" ? 2 : 0,
    };
  }
  if (normalized === "8") {
    return {
      kind: "spacing",
      reason: "字体 glyph 无轮廓，仅保留字符 advance 作为视觉间距。",
    };
  }
  if (/\s/u.test(normalized)) {
    return { kind: "spacing", reason: "空白字符只影响源谱布局。" };
  }

  const allowlisted = findAllowlistedUnknownBaseGlyph(rawCharacter);
  if (allowlisted) {
    return {
      kind: "unknown_allowlisted",
      reason: allowlisted.reason,
      allowlist_version: SIMPMUSIC_BASE_UNKNOWN_ALLOWLIST_VERSION,
    };
  }
  const codePoint = rawCharacter.codePointAt(0);
  return {
    kind: "unknown_unallowlisted",
    reason: `未映射的 SimpMusic Base 字形 U+${codePoint
      ?.toString(16)
      .toUpperCase()}`,
  };
}

export function classifyAccentCharacter(
  rawCharacter: string,
): AccentCharacterClassification {
  if (rawCharacter === "-") return { kind: "arc" };
  if (rawCharacter === "v") return { kind: "final_barline_candidate" };
  if (["z", "c", "3", "Z"].includes(rawCharacter)) {
    return { kind: "triplet_or_bracket_component" };
  }
  const codePoint = rawCharacter.codePointAt(0);
  return {
    kind: "unknown_unallowlisted",
    reason: `未映射的 SimpMusic Accent 字形 U+${codePoint
      ?.toString(16)
      .toUpperCase()}`,
  };
}

export function isConservativePua(rawCharacter: string): boolean {
  return lookupNoteGlyph(rawCharacter)?.confidence === "conservative";
}
