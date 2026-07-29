import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PptxSourceDocument, SourceTextRun } from "../../src/features/score/contracts";
import {
  SIMPMUSIC_BASE_UNKNOWN_ALLOWLIST_VERSION,
  SIMPMUSIC_INVENTORY_SCHEMA,
  classifyAccentCharacter,
  findAllowlistedUnknownBaseGlyph,
} from "./simpmusic-map";
import {
  decodeSimpMusicAccent,
  lexSimpMusicBase,
  type GlyphToken,
} from "./simpmusic-decoder";
import { readPptxSource } from "./pptx-reader";

const BASE_FONT = "SimpMusic Base";
const ACCENT_FONT = "SimpMusic Accent";

export type InventoryClassification =
  | GlyphToken["kind"]
  | "unknown_allowlisted"
  | "unknown_unallowlisted"
  | ReturnType<typeof classifyAccentCharacter>["kind"];

export interface SimpMusicGlyphInventoryItem {
  code_point: number;
  code_point_label: string;
  raw: string;
  count: number;
  run_count: number;
  hymn_keys: string[];
  classifications: Record<string, number>;
  allowlist_reason?: string;
}

export interface AccentRunInventoryItem {
  raw: string;
  count: number;
  hymn_keys: string[];
  token_kinds: Record<string, number>;
}

export interface SimpMusicCorpusInventory {
  schema: typeof SIMPMUSIC_INVENTORY_SCHEMA;
  allowlist_version: typeof SIMPMUSIC_BASE_UNKNOWN_ALLOWLIST_VERSION;
  pptx_count: number;
  pptx_with_base: number;
  pptx_with_accent: number;
  base_run_count: number;
  accent_run_count: number;
  base: SimpMusicGlyphInventoryItem[];
  accent: SimpMusicGlyphInventoryItem[];
  accent_runs: AccentRunInventoryItem[];
  unknown: {
    allowlisted_base: SimpMusicGlyphInventoryItem[];
    unexpected_base: SimpMusicGlyphInventoryItem[];
    unexpected_accent_runs: AccentRunInventoryItem[];
    allowlisted_base_run_count: number;
    unexpected_base_run_count: number;
    unexpected_accent_run_count: number;
  };
}

interface MutableGlyphInventoryItem {
  code_point: number;
  raw: string;
  count: number;
  run_ids: Set<string>;
  hymn_keys: Set<string>;
  classifications: Map<string, number>;
  allowlist_reason?: string;
}

interface MutableAccentRunInventoryItem {
  raw: string;
  count: number;
  hymn_keys: Set<string>;
  token_kinds: Map<string, number>;
}

interface InventoryAccumulator {
  base: Map<number, MutableGlyphInventoryItem>;
  accent: Map<number, MutableGlyphInventoryItem>;
  accent_runs: Map<string, MutableAccentRunInventoryItem>;
  pptx_count: number;
  pptx_with_base: number;
  pptx_with_accent: number;
  base_run_count: number;
  accent_run_count: number;
  allowlisted_base_run_ids: Set<string>;
  unexpected_base_run_ids: Set<string>;
  unexpected_accent_run_ids: Set<string>;
}

function createAccumulator(): InventoryAccumulator {
  return {
    base: new Map(),
    accent: new Map(),
    accent_runs: new Map(),
    pptx_count: 0,
    pptx_with_base: 0,
    pptx_with_accent: 0,
    base_run_count: 0,
    accent_run_count: 0,
    allowlisted_base_run_ids: new Set(),
    unexpected_base_run_ids: new Set(),
    unexpected_accent_run_ids: new Set(),
  };
}

function sourceRunId(run: SourceTextRun): string {
  const source = run.source;
  return [
    source.asset,
    source.slide,
    source.shape_id,
    source.paragraph ?? "",
    source.run ?? "",
  ].join(":");
}

function addGlyph(
  target: Map<number, MutableGlyphInventoryItem>,
  raw: string,
  hymnKey: string,
  runId: string,
  classification: string,
  allowlistReason?: string,
) {
  const codePoint = raw.codePointAt(0);
  if (codePoint === undefined) return;
  const item = target.get(codePoint) ?? {
    code_point: codePoint,
    raw,
    count: 0,
    run_ids: new Set<string>(),
    hymn_keys: new Set<string>(),
    classifications: new Map<string, number>(),
  };
  item.count += 1;
  item.run_ids.add(runId);
  item.hymn_keys.add(hymnKey);
  item.classifications.set(
    classification,
    (item.classifications.get(classification) ?? 0) + 1,
  );
  if (allowlistReason) item.allowlist_reason = allowlistReason;
  target.set(codePoint, item);
}

function baseTokenClassification(token: GlyphToken): InventoryClassification {
  if (token.kind !== "unknown") return token.kind;
  return token.allowlisted
    ? "unknown_allowlisted"
    : "unknown_unallowlisted";
}

function inspectBaseRun(
  accumulator: InventoryAccumulator,
  hymnKey: string,
  run: SourceTextRun,
) {
  accumulator.base_run_count += 1;
  const runId = sourceRunId(run);
  const result = lexSimpMusicBase(run.text, run.source);
  for (const token of result.tokens) {
    const classification = baseTokenClassification(token);
    const allowlisted = findAllowlistedUnknownBaseGlyph(token.raw);
    addGlyph(
      accumulator.base,
      token.raw,
      hymnKey,
      runId,
      classification,
      allowlisted?.reason,
    );
    if (classification === "unknown_allowlisted") {
      accumulator.allowlisted_base_run_ids.add(runId);
    } else if (classification === "unknown_unallowlisted") {
      accumulator.unexpected_base_run_ids.add(runId);
    }
  }
}

function inspectAccentRun(
  accumulator: InventoryAccumulator,
  hymnKey: string,
  run: SourceTextRun,
) {
  accumulator.accent_run_count += 1;
  const runId = sourceRunId(run);
  const compact = run.text.replace(/\s+/gu, "");
  const decoded = decodeSimpMusicAccent(run.text, run.source);
  const runItem = accumulator.accent_runs.get(compact) ?? {
    raw: compact,
    count: 0,
    hymn_keys: new Set<string>(),
    token_kinds: new Map<string, number>(),
  };
  runItem.count += 1;
  runItem.hymn_keys.add(hymnKey);
  for (const token of decoded.tokens) {
    runItem.token_kinds.set(
      token.kind,
      (runItem.token_kinds.get(token.kind) ?? 0) + 1,
    );
  }
  accumulator.accent_runs.set(compact, runItem);

  if (decoded.tokens.some((token) => token.kind === "unknown")) {
    accumulator.unexpected_accent_run_ids.add(runId);
  }
  for (const raw of compact) {
    const classification = classifyAccentCharacter(raw);
    addGlyph(
      accumulator.accent,
      raw,
      hymnKey,
      runId,
      classification.kind,
    );
  }
}

export function inspectSimpMusicSourceDocuments(
  documents: readonly PptxSourceDocument[],
): SimpMusicCorpusInventory {
  const accumulator = createAccumulator();
  for (const document of documents) {
    accumulator.pptx_count += 1;
    let hasBase = false;
    let hasAccent = false;
    for (const slide of document.slides) {
      for (const shape of slide.shapes) {
        if (shape.kind !== "text") continue;
        for (const paragraph of shape.paragraphs) {
          for (const run of paragraph.runs) {
            if (run.font_family === BASE_FONT) {
              hasBase = true;
              inspectBaseRun(accumulator, document.hymn_key, run);
            } else if (run.font_family === ACCENT_FONT) {
              hasAccent = true;
              inspectAccentRun(accumulator, document.hymn_key, run);
            }
          }
        }
      }
    }
    if (hasBase) accumulator.pptx_with_base += 1;
    if (hasAccent) accumulator.pptx_with_accent += 1;
  }
  return finalizeInventory(accumulator);
}

export async function scanSimpMusicCorpus(
  directory: string,
  concurrency = 8,
): Promise<SimpMusicCorpusInventory> {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.toLowerCase().endsWith(".pptx"))
    .sort((left, right) =>
      left.localeCompare(right, "zh-CN", { numeric: true }),
    );
  const documents = new Array<PptxSourceDocument>(filenames.length);
  let cursor = 0;

  async function worker() {
    while (cursor < filenames.length) {
      const index = cursor;
      cursor += 1;
      documents[index] = await readPptxSource(
        join(directory, filenames[index]),
      );
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, filenames.length || 1)) },
      () => worker(),
    ),
  );
  return inspectSimpMusicSourceDocuments(documents);
}

function finalizeGlyphItems(
  values: Iterable<MutableGlyphInventoryItem>,
): SimpMusicGlyphInventoryItem[] {
  return [...values]
    .sort((left, right) => left.code_point - right.code_point)
    .map((item) => ({
      code_point: item.code_point,
      code_point_label: `U+${item.code_point
        .toString(16)
        .toUpperCase()
        .padStart(4, "0")}`,
      raw: item.raw,
      count: item.count,
      run_count: item.run_ids.size,
      hymn_keys: [...item.hymn_keys].sort(
        (left, right) => Number(left) - Number(right),
      ),
      classifications: Object.fromEntries(
        [...item.classifications].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      ...(item.allowlist_reason
        ? { allowlist_reason: item.allowlist_reason }
        : {}),
    }));
}

function finalizeAccentRuns(
  values: Iterable<MutableAccentRunInventoryItem>,
): AccentRunInventoryItem[] {
  return [...values]
    .sort(
      (left, right) =>
        right.count - left.count || left.raw.localeCompare(right.raw),
    )
    .map((item) => ({
      raw: item.raw,
      count: item.count,
      hymn_keys: [...item.hymn_keys].sort(
        (left, right) => Number(left) - Number(right),
      ),
      token_kinds: Object.fromEntries(
        [...item.token_kinds].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    }));
}

function finalizeInventory(
  accumulator: InventoryAccumulator,
): SimpMusicCorpusInventory {
  const base = finalizeGlyphItems(accumulator.base.values());
  const accent = finalizeGlyphItems(accumulator.accent.values());
  const accentRuns = finalizeAccentRuns(accumulator.accent_runs.values());
  return {
    schema: SIMPMUSIC_INVENTORY_SCHEMA,
    allowlist_version: SIMPMUSIC_BASE_UNKNOWN_ALLOWLIST_VERSION,
    pptx_count: accumulator.pptx_count,
    pptx_with_base: accumulator.pptx_with_base,
    pptx_with_accent: accumulator.pptx_with_accent,
    base_run_count: accumulator.base_run_count,
    accent_run_count: accumulator.accent_run_count,
    base,
    accent,
    accent_runs: accentRuns,
    unknown: {
      allowlisted_base: base.filter(
        (item) => item.classifications.unknown_allowlisted,
      ),
      unexpected_base: base.filter(
        (item) => item.classifications.unknown_unallowlisted,
      ),
      unexpected_accent_runs: accentRuns.filter(
        (item) => item.token_kinds.unknown,
      ),
      allowlisted_base_run_count: accumulator.allowlisted_base_run_ids.size,
      unexpected_base_run_count: accumulator.unexpected_base_run_ids.size,
      unexpected_accent_run_count:
        accumulator.unexpected_accent_run_ids.size,
    },
  };
}

export function formatUnknownCorpusSummary(
  inventory: SimpMusicCorpusInventory,
): string {
  const allowlisted = inventory.unknown.allowlisted_base
    .map(
      (item) =>
        `${item.code_point_label} ${JSON.stringify(item.raw)}: ${item.count} 次 / ${item.hymn_keys.length} 首`,
    )
    .join("\n");
  const unexpectedBase =
    inventory.unknown.unexpected_base
      .map((item) => `${item.code_point_label} ${JSON.stringify(item.raw)}`)
      .join("、") || "无";
  const unexpectedAccent =
    inventory.unknown.unexpected_accent_runs
      .map((item) => JSON.stringify(item.raw))
      .join("、") || "无";
  return [
    `allowlisted Base unknown (${inventory.allowlist_version}):`,
    allowlisted || "无",
    `unexpected Base unknown: ${unexpectedBase}`,
    `unexpected Accent unknown: ${unexpectedAccent}`,
  ].join("\n");
}
