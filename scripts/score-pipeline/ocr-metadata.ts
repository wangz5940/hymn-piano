import { readFile } from "node:fs/promises";
import type {
  ContractDiagnostic,
  PianoScoreDocument,
  ScoreValueWithSource,
  SourceReference,
} from "../../src/features/score/contracts";
import { withDocumentContentHash } from "./content-hash";

export interface OcrMetadataRecord {
  filename: string;
  key_signature?: string;
  meter?: string;
}

export interface ScoreMetadataFallback {
  filename: string;
  key_signature?: string;
  meter?: string;
  blocks?: unknown;
}

export function hymnKeyFromImageFilename(filename: string): string | null {
  const match = filename.match(/^(\d+)([a-z]?)(?:\s|$)/iu);
  if (!match) return null;
  return `${Number(match[1])}${match[2].toLowerCase()}`;
}

export function normalizeKeySignature(raw: string | undefined): string | null {
  if (!raw) return null;
  const compact = raw
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .replace(/[調调週周]/gu, "")
    .replace(/♯/gu, "#")
    .replace(/♭/gu, "b");
  const chinese = compact.match(/([升降])([A-G])/iu);
  if (chinese) {
    return `${chinese[2].toUpperCase()}${chinese[1] === "升" ? "♯" : "♭"}`;
  }
  const western = compact.match(/([A-G])([#b]?)/iu);
  if (!western) return null;
  const accidental =
    western[2] === "#" ? "♯" : western[2].toLowerCase() === "b" ? "♭" : "";
  return `${western[1].toUpperCase()}${accidental}`;
}

export function normalizeMeter(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/(?<!\d)(\d+)\s*\/\s*(\d+)(?!\d)/u);
  return match ? `${Number(match[1])}/${Number(match[2])}` : null;
}

export async function loadOcrMetadata(
  jsonlPath: string,
): Promise<Map<string, OcrMetadataRecord>> {
  const content = await readFile(jsonlPath, "utf8");
  const records = new Map<string, OcrMetadataRecord>();
  for (const line of content.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as ScoreMetadataFallback;
    const hymnKey = hymnKeyFromImageFilename(parsed.filename);
    if (!hymnKey) continue;
    records.set(hymnKey, {
      filename: parsed.filename,
      ...(parsed.key_signature
        ? { key_signature: parsed.key_signature }
        : {}),
      ...(parsed.meter ? { meter: parsed.meter } : {}),
    });
  }
  return records;
}

function fallbackSource(filename: string): SourceReference {
  return {
    asset: "data/hymn-ocr.jsonl",
    slide: 1,
    shape_id: filename,
  };
}

function valueWithSource(
  value: string,
  source: SourceReference,
): ScoreValueWithSource<string> {
  return { value, sources: [source] };
}

export function applyOcrMetadataFallback(
  score: PianoScoreDocument,
  fallback: ScoreMetadataFallback | undefined,
): PianoScoreDocument {
  if (!fallback) return score;
  const source = fallbackSource(fallback.filename);
  const keySignature =
    score.key_signature ??
    (() => {
      const value = normalizeKeySignature(fallback.key_signature);
      return value ? valueWithSource(value, source) : null;
    })();
  const meter =
    score.meter ??
    (() => {
      const value = normalizeMeter(fallback.meter);
      return value ? valueWithSource(value, source) : null;
    })();
  const fields = [
    score.key_signature === null && keySignature ? "调号" : null,
    score.meter === null && meter ? "拍号" : null,
  ].filter((field): field is string => Boolean(field));
  if (fields.length === 0) return score;
  const diagnostic: ContractDiagnostic = {
    code: "metadata_fallback",
    severity: "info",
    message: `${fields.join("、")}来自图片 OCR 顶层元数据；音符仍只来自 PPTX。`,
    sources: [source],
  };
  return withDocumentContentHash({
    ...score,
    key_signature: keySignature,
    meter,
    diagnostics: [...score.diagnostics, diagnostic],
  });
}
