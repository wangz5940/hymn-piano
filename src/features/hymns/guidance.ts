import type { HymnCatalogItem } from "./types";
import type { HymnAssets } from "@/features/score/loadHymnAssets";
import type {
  ChordAssignment,
  PianoArrangementDocument,
  PianoScoreDocument,
  PositionMove,
  PositionSegment,
  ScoreNoteEvent,
  TeachingSourceStatus,
} from "@/features/score/contracts";

export type HymnGuidanceStatus = TeachingSourceStatus;

export interface MelodyRange {
  lowest: string;
  highest: string;
  summary: string;
}

export interface PositionRef {
  id: string;
  label: string;
  status: TeachingSourceStatus;
}

export interface MoveRef {
  id: string;
  instruction: string;
}

export interface ChordRef {
  symbol: string;
  function: string;
  status: TeachingSourceStatus;
}

export interface HymnGuidanceStats {
  note_count: number;
  fingering_count: number;
  position_count: number;
  move_count: number;
  chord_count: number;
}

export interface HymnGuidance {
  hymn_key: string;
  status: HymnGuidanceStatus;
  available: boolean;
  fallback_reason: string | null;
  key_signature: string | null;
  meter: string | null;
  melody_range: MelodyRange | null;
  stats: HymnGuidanceStats;
  positions: PositionRef[];
  moves: MoveRef[];
  chords: ChordRef[];
}

const EMPTY_STATS: HymnGuidanceStats = {
  note_count: 0,
  fingering_count: 0,
  position_count: 0,
  move_count: 0,
  chord_count: 0,
};

function unavailableGuidance(
  hymnKey: string,
  reason: string,
): HymnGuidance {
  return {
    hymn_key: hymnKey,
    status: "unavailable",
    available: false,
    fallback_reason: reason,
    key_signature: null,
    meter: null,
    melody_range: null,
    stats: EMPTY_STATS,
    positions: [],
    moves: [],
    chords: [],
  };
}

function extractDocuments(
  assets: HymnAssets,
): {
  score: PianoScoreDocument;
  arrangement: PianoArrangementDocument;
} | null {
  if (assets.status === "structured") {
    return { score: assets.score, arrangement: assets.arrangement };
  }
  if (assets.status === "image" && assets.score && assets.arrangement) {
    return { score: assets.score, arrangement: assets.arrangement };
  }
  return null;
}

function assetsFallbackReason(assets: HymnAssets): string {
  switch (assets.status) {
    case "loading":
      return "谱面数据仍在加载，暂无结构化预备方案。";
    case "error":
      return `谱面数据加载失败：${assets.message}`;
    case "image":
      return assets.reason;
    default:
      return "暂无结构化谱面数据。";
  }
}

function noteEvents(score: PianoScoreDocument): ScoreNoteEvent[] {
  const notes: ScoreNoteEvent[] = [];
  for (const page of score.pages) {
    for (const system of page.systems) {
      for (const measure of system.measures) {
        for (const event of measure.events) {
          if (event.kind === "note") notes.push(event);
        }
      }
    }
  }
  return notes;
}

const DEGREE_LABELS: Record<number, string> = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
};

function octaveSuffix(octave: number): string {
  if (octave > 0) return "̇".repeat(octave);
  if (octave < 0) return "̣".repeat(-octave);
  return "";
}

function noteLabel(note: ScoreNoteEvent): string {
  const accidental =
    note.accidental === "sharp"
      ? "♯"
      : note.accidental === "flat"
        ? "♭"
        : "";
  return `${accidental}${DEGREE_LABELS[note.degree] ?? note.degree}${octaveSuffix(note.octave)}`;
}

function noteRank(note: ScoreNoteEvent): number {
  return note.octave * 7 + note.degree;
}

function computeMelodyRange(notes: ScoreNoteEvent[]): MelodyRange | null {
  if (notes.length === 0) return null;
  let lowest = notes[0];
  let highest = notes[0];
  for (const note of notes) {
    if (noteRank(note) < noteRank(lowest)) lowest = note;
    if (noteRank(note) > noteRank(highest)) highest = note;
  }
  const lowestLabel = noteLabel(lowest);
  const highestLabel = noteLabel(highest);
  return {
    lowest: lowestLabel,
    highest: highestLabel,
    summary:
      lowestLabel === highestLabel
        ? `旋律稳定在 ${lowestLabel} 附近。`
        : `旋律自 ${lowestLabel} 到 ${highestLabel}。`,
  };
}

const STATUS_TIER: Record<TeachingSourceStatus, number> = {
  source_confirmed: 3,
  manual_confirmed: 2,
  auto_candidate: 1,
  unavailable: 0,
};

const TIER_STATUS: TeachingSourceStatus[] = [
  "unavailable",
  "auto_candidate",
  "manual_confirmed",
  "source_confirmed",
];

function summarizeStatus(
  arrangement: PianoArrangementDocument,
): HymnGuidanceStatus {
  const statuses: TeachingSourceStatus[] = [
    ...arrangement.fingerings.map((item) => item.status),
    ...arrangement.positions.map((item) => item.status),
    ...arrangement.chords.map((item) => item.status),
    arrangement.accompaniment.status,
    arrangement.intro.status,
    arrangement.interlude.status,
    arrangement.ending.status,
  ];
  if (statuses.length === 0) return "unavailable";
  const minTier = statuses.reduce(
    (tier, status) => Math.min(tier, STATUS_TIER[status]),
    STATUS_TIER.source_confirmed,
  );
  return TIER_STATUS[minTier];
}

function toPositionRef(position: PositionSegment): PositionRef {
  return {
    id: position.id,
    label: position.label,
    status: position.status,
  };
}

function toMoveRef(move: PositionMove): MoveRef {
  return { id: move.id, instruction: move.instruction };
}

function toChordRef(chord: ChordAssignment): ChordRef {
  return {
    symbol: chord.symbol,
    function: chord.function,
    status: chord.status,
  };
}

export function createHymnGuidance(
  hymn: HymnCatalogItem,
  assets: HymnAssets,
): HymnGuidance {
  if (hymn.is_alternate_tune) {
    return unavailableGuidance(
      hymn.key,
      "第二调不复用原调结构化数据，请参考图片谱。",
    );
  }

  const documents = extractDocuments(assets);
  if (!documents) {
    return unavailableGuidance(hymn.key, assetsFallbackReason(assets));
  }

  const { score, arrangement } = documents;
  const notes = noteEvents(score);

  return {
    hymn_key: hymn.key,
    status: summarizeStatus(arrangement),
    available: true,
    fallback_reason: assets.status === "image" ? assets.reason : null,
    key_signature: score.key_signature?.value ?? null,
    meter: score.meter?.value ?? null,
    melody_range: computeMelodyRange(notes),
    stats: {
      note_count: notes.length,
      fingering_count: arrangement.fingerings.length,
      position_count: arrangement.positions.length,
      move_count: arrangement.moves.length,
      chord_count: arrangement.chords.length,
    },
    positions: arrangement.positions.map(toPositionRef),
    moves: arrangement.moves.map(toMoveRef),
    chords: arrangement.chords.map(toChordRef),
  };
}
