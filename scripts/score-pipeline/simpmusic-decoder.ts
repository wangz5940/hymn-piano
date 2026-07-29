import type {
  ContractDiagnostic,
  SourceReference,
} from "../../src/features/score/contracts";
import {
  classifyBaseGlyph,
  normalizedGlyph,
  type SimpMusicDegree,
} from "./simpmusic-map";

interface GlyphTokenBase {
  raw: string;
  normalized: string;
  start: number;
  end: number;
  sources: SourceReference[];
}

export interface NoteGlyphToken extends GlyphTokenBase {
  kind: "note";
  degree: SimpMusicDegree;
  octave: number;
  duration: number;
  beams: number;
}

export interface RestGlyphToken extends GlyphTokenBase {
  kind: "rest";
  duration: number;
  beams: number;
}

export interface AccidentalGlyphToken extends GlyphTokenBase {
  kind: "accidental";
  accidental: "flat" | "natural" | "sharp";
}

export interface BarlineGlyphToken extends GlyphTokenBase {
  kind: "barline";
  style: "single" | "final";
}

export interface RepeatGlyphToken extends GlyphTokenBase {
  kind: "repeat";
  direction: "start" | "end";
}

export interface ModifierGlyphToken extends GlyphTokenBase {
  kind:
    | "augmentation_dot"
    | "beam_connector"
    | "sustain"
    | "spacing"
    | "unknown";
  beams?: number;
  reason?: string;
  allowlisted?: boolean;
}

export type GlyphToken =
  | NoteGlyphToken
  | RestGlyphToken
  | AccidentalGlyphToken
  | BarlineGlyphToken
  | RepeatGlyphToken
  | ModifierGlyphToken;

interface DecodedBaseEvent {
  raw_glyphs: string;
  start: number;
  end: number;
  duration: number;
  sources: SourceReference[];
}

export interface DecodedNoteEvent extends DecodedBaseEvent {
  kind: "note";
  degree: SimpMusicDegree;
  accidental: "flat" | "natural" | "sharp" | null;
  octave: number;
  beams: number;
  augmentation_dots: number;
}

export interface DecodedRestEvent extends DecodedBaseEvent {
  kind: "rest";
  beams: number;
  augmentation_dots: number;
}

export interface DecodedBarlineEvent extends DecodedBaseEvent {
  kind: "barline";
  style: "single" | "final";
}

export interface DecodedRepeatEvent extends DecodedBaseEvent {
  kind: "repeat";
  direction: "start" | "end";
}

export interface DecodedUnknownEvent extends DecodedBaseEvent {
  kind: "unknown";
  reason: string;
}

export type DecodedSimpMusicEvent =
  | DecodedNoteEvent
  | DecodedRestEvent
  | DecodedBarlineEvent
  | DecodedRepeatEvent
  | DecodedUnknownEvent;

export interface DecodedSimpMusicLine {
  tokens: GlyphToken[];
  events: DecodedSimpMusicEvent[];
  diagnostics: ContractDiagnostic[];
}

export type AccentToken =
  | {
      kind: "arc";
      raw: string;
      sources: SourceReference[];
      confidence: "context_required";
    }
  | {
      kind: "triplet";
      raw: string;
      sources: SourceReference[];
      count: 3;
    }
  | {
      kind: "bracket";
      raw: string;
      sources: SourceReference[];
      confidence: "context_required";
      reason: string;
    }
  | {
      kind: "final_barline_candidate";
      raw: string;
      sources: SourceReference[];
      confidence: "low";
    }
  | {
      kind: "unknown";
      raw: string;
      sources: SourceReference[];
      reason: string;
    };

function diagnostic(
  code: string,
  severity: ContractDiagnostic["severity"],
  message: string,
  source: SourceReference,
): ContractDiagnostic {
  return { code, severity, message, sources: [source] };
}

function sourceList(source: SourceReference): SourceReference[] {
  return [source];
}

export function lexSimpMusicBase(
  text: string,
  source: SourceReference,
): { tokens: GlyphToken[]; diagnostics: ContractDiagnostic[] } {
  const tokens: GlyphToken[] = [];
  const diagnostics: ContractDiagnostic[] = [];
  let offset = 0;

  for (const raw of text) {
    const start = offset;
    offset += raw.length;
    const normalized = normalizedGlyph(raw);
    const common = {
      raw,
      normalized,
      start,
      end: offset,
      sources: sourceList(source),
    };
    const classification = classifyBaseGlyph(raw);
    if (classification.kind === "note") {
      tokens.push({
        kind: "note",
        ...common,
        degree: classification.degree,
        octave: classification.octave,
        duration: classification.duration,
        beams: classification.beams,
      });
      if (classification.confidence === "conservative") {
        diagnostics.push(
          diagnostic(
            "conservative_pua_mapping",
            "warning",
            `私用区字形 U+${raw.codePointAt(0)?.toString(16).toUpperCase()} 使用保守音符映射`,
            source,
          ),
        );
      }
      continue;
    }

    if (classification.kind === "rest") {
      tokens.push({
        kind: "rest",
        ...common,
        duration: classification.duration,
        beams: classification.beams,
      });
    } else if (classification.kind === "sustain") {
      tokens.push({ kind: "sustain", ...common });
    } else if (classification.kind === "barline") {
      tokens.push({ kind: "barline", style: "single", ...common });
    } else if (classification.kind === "final_barline") {
      tokens.push({ kind: "barline", style: "final", ...common });
    } else if (classification.kind === "repeat") {
      tokens.push({
        kind: "repeat",
        direction: classification.direction,
        ...common,
      });
    } else if (classification.kind === "accidental") {
      tokens.push({
        kind: "accidental",
        accidental: classification.accidental,
        ...common,
      });
    } else if (classification.kind === "beam_connector") {
      tokens.push({
        kind: "beam_connector",
        ...common,
        beams: classification.beams,
      });
    } else if (classification.kind === "augmentation_dot") {
      tokens.push({
        kind: "augmentation_dot",
        ...common,
        beams: classification.beams,
      });
    } else if (classification.kind === "spacing") {
      tokens.push({ kind: "spacing", ...common });
    } else {
      const allowlisted = classification.kind === "unknown_allowlisted";
      tokens.push({
        kind: "unknown",
        ...common,
        reason: classification.reason,
        allowlisted,
      });
      diagnostics.push(
        diagnostic(
          allowlisted
            ? "allowlisted_unknown_base_glyph"
            : "unknown_base_glyph",
          allowlisted ? "warning" : "error",
          classification.reason,
          source,
        ),
      );
    }
  }

  return { tokens, diagnostics };
}

function previousTimedEvent(
  events: DecodedSimpMusicEvent[],
): DecodedNoteEvent | DecodedRestEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.kind === "note" || event.kind === "rest") return event;
  }
  return undefined;
}

function mergeSourceLists(
  left: SourceReference[],
  right: SourceReference[],
): SourceReference[] {
  const unique = new Map<string, SourceReference>();
  for (const source of [...left, ...right]) {
    unique.set(
      `${source.asset}:${source.slide}:${source.shape_id}:${source.paragraph ?? ""}:${source.run ?? ""}`,
      source,
    );
  }
  return [...unique.values()];
}

export function reduceGlyphTokens(
  tokens: GlyphToken[],
): {
  events: DecodedSimpMusicEvent[];
  diagnostics: ContractDiagnostic[];
} {
  const events: DecodedSimpMusicEvent[] = [];
  const diagnostics: ContractDiagnostic[] = [];
  let pendingAccidental: AccidentalGlyphToken | null = null;

  for (const token of tokens) {
    if (token.kind === "accidental") {
      if (pendingAccidental) {
        diagnostics.push(
          diagnostic(
            "overridden_accidental",
            "warning",
            "连续变音记号中仅最后一个作用于下一音符。",
            pendingAccidental.sources[0],
          ),
        );
      }
      pendingAccidental = token;
      continue;
    }
    if (token.kind === "note") {
      const accidental = pendingAccidental;
      events.push({
        kind: "note",
        degree: token.degree,
        accidental: accidental?.accidental ?? null,
        octave: token.octave,
        duration: token.duration,
        beams: token.beams,
        augmentation_dots: 0,
        raw_glyphs: `${accidental?.raw ?? ""}${token.raw}`,
        start: accidental?.start ?? token.start,
        end: token.end,
        sources: accidental
          ? mergeSourceLists(accidental.sources, token.sources)
          : token.sources,
      });
      pendingAccidental = null;
      continue;
    }
    if (
      pendingAccidental &&
      token.kind !== "spacing" &&
      token.kind !== "beam_connector"
    ) {
      diagnostics.push(
        diagnostic(
          "orphan_accidental",
          "warning",
          "变音记号后没有可修饰的音符。",
          pendingAccidental.sources[0],
        ),
      );
      pendingAccidental = null;
    }
    if (token.kind === "rest") {
      events.push({
        kind: "rest",
        duration: token.duration,
        beams: token.beams,
        augmentation_dots: 0,
        raw_glyphs: token.raw,
        start: token.start,
        end: token.end,
        sources: token.sources,
      });
      continue;
    }
    if (token.kind === "barline") {
      events.push({
        kind: "barline",
        style: token.style,
        duration: 0,
        raw_glyphs: token.raw,
        start: token.start,
        end: token.end,
        sources: token.sources,
      });
      continue;
    }
    if (token.kind === "repeat") {
      events.push({
        kind: "repeat",
        direction: token.direction,
        duration: 0,
        raw_glyphs: token.raw,
        start: token.start,
        end: token.end,
        sources: token.sources,
      });
      continue;
    }
    if (token.kind === "unknown") {
      events.push({
        kind: "unknown",
        reason: token.reason ?? "未知 SimpMusic 字形",
        duration: 0,
        raw_glyphs: token.raw,
        start: token.start,
        end: token.end,
        sources: token.sources,
      });
      continue;
    }
    if (token.kind === "spacing" || token.kind === "beam_connector") {
      continue;
    }

    const target = previousTimedEvent(events);
    if (!target) {
      diagnostics.push(
        diagnostic(
          token.kind === "sustain"
            ? "orphan_sustain"
            : "orphan_augmentation_dot",
          "warning",
          token.kind === "sustain"
            ? "增时线前没有可延长的音符或休止"
            : "附点前没有可修饰的音符或休止",
          token.sources[0],
        ),
      );
      continue;
    }
    target.raw_glyphs += token.raw;
    target.end = token.end;
    target.sources = mergeSourceLists(target.sources, token.sources);
    if (token.kind === "sustain") {
      target.duration += 1;
      continue;
    }
    const baseDuration = 1 / 2 ** target.beams;
    target.augmentation_dots += 1;
    target.duration += baseDuration / 2 ** target.augmentation_dots;
  }

  if (pendingAccidental) {
    diagnostics.push(
      diagnostic(
        "orphan_accidental",
        "warning",
        "谱行末尾的变音记号没有可修饰的音符。",
        pendingAccidental.sources[0],
      ),
    );
  }

  return { events, diagnostics };
}

export function decodeSimpMusicBase(
  text: string,
  source: SourceReference,
): DecodedSimpMusicLine {
  const lexed = lexSimpMusicBase(text, source);
  const reduced = reduceGlyphTokens(lexed.tokens);
  return {
    tokens: lexed.tokens,
    events: reduced.events,
    diagnostics: [...lexed.diagnostics, ...reduced.diagnostics],
  };
}

export function decodeSimpMusicAccent(
  text: string,
  source: SourceReference,
): { tokens: AccentToken[]; diagnostics: ContractDiagnostic[] } {
  const compact = text.replace(/\s+/gu, "");
  if (/^zc+3c+Z$/u.test(compact)) {
    return {
      tokens: [
        { kind: "triplet", raw: text, count: 3, sources: sourceList(source) },
      ],
      diagnostics: [],
    };
  }
  if (/^zc+Z$/u.test(compact)) {
    return {
      tokens: [
        {
          kind: "bracket",
          raw: text,
          sources: sourceList(source),
          confidence: "context_required",
          reason: "Accent 括号未包含可确认的连音数值，需结合覆盖范围解释。",
        },
      ],
      diagnostics: [],
    };
  }

  const tokens: AccentToken[] = [];
  const diagnostics: ContractDiagnostic[] = [];
  for (const raw of compact) {
    if (raw === "-") {
      tokens.push({
        kind: "arc",
        raw,
        sources: sourceList(source),
        confidence: "context_required",
      });
    } else if (raw === "v") {
      tokens.push({
        kind: "final_barline_candidate",
        raw,
        sources: sourceList(source),
        confidence: "low",
      });
      diagnostics.push(
        diagnostic(
          "low_confidence_final_barline",
          "warning",
          "Accent v 仅标记为低可信终止线候选",
          source,
        ),
      );
    } else {
      const reason = `未解析的 SimpMusic Accent 组合：${text}`;
      tokens.push({ kind: "unknown", raw, sources: sourceList(source), reason });
      diagnostics.push(diagnostic("unknown_accent_glyph", "warning", reason, source));
    }
  }
  return { tokens, diagnostics };
}
