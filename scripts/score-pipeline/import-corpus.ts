import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  ARRANGEMENT_SCHEMA,
  SCORE_SCHEMA,
  assertArrangementDocument,
  assertScoreDocument,
  assertSourceDocument,
  type PianoArrangementDocument,
  type PianoScoreDocument,
  type PptxSourceDocument,
} from "../../src/features/score/contracts";
import {
  RENDER_SCHEMA,
  assertRenderDocument,
  type HymnRenderDocument,
} from "../../src/features/score/render-contracts";
import {
  buildPianoArrangement,
  loadManualArrangement,
  type ManualArrangementOverrides,
} from "./arrangement-builder";
import {
  CORPUS_BASELINE,
  STRUCTURED_SCORE_FALLBACKS,
  validateCorpusObservation,
} from "./corpus-manifest";
import { dedupeScorePages } from "./dedupe";
import { readPptxSource } from "./pptx-reader";
import { buildPianoScore } from "./score-builder";
import { buildRenderDocument } from "./render-builder";
import { loadOcrMetadata, type OcrMetadataRecord } from "./ocr-metadata";
import {
  inspectSimpMusicSourceDocuments,
  type SimpMusicCorpusInventory,
} from "./simpmusic-inventory";
import { withDocumentContentHash } from "./content-hash";

export const SCORE_ASSET_GENERATOR_VERSION = "score-assets/v1";
export const IMPORT_REPORT_SCHEMA = "shiqin-import-report/v1";

export interface PptxCorpusFile {
  key: string;
  number: number;
  title: string;
  filename: string;
  path: string;
}

export interface ImageCorpusFile {
  key: string;
  number: number;
  variant: string;
  title: string;
  filename: string;
  path: string;
}

export interface CorpusFiles {
  pptx: PptxCorpusFile[];
  images: ImageCorpusFile[];
}

export interface GeneratedHymnCatalogEntry {
  hymn_key: string;
  key: string;
  number: number;
  variant: string;
  title: string;
  filename: string;
  image_url: string;
  is_alternate_tune: boolean;
  score_source: "pptx" | "image";
  score_schema: typeof SCORE_SCHEMA | null;
  arrangement_schema: typeof ARRANGEMENT_SCHEMA | null;
  render_schema: typeof RENDER_SCHEMA | null;
  score_asset_url: string | null;
  arrangement_asset_url: string | null;
  render_asset_url: string | null;
  render_variant: number | null;
  fallback_reason: string | null;
}

export interface HymnImportSummary {
  hymn_key: string;
  pptx_filename: string;
  slide_count: number;
  score_source: "pptx" | "image";
  unique_score_pages: number;
  deduplicated_slides: number;
  warning_count: number;
  error_count: number;
  score_hash: string | null;
  arrangement_hash: string | null;
  render_hash: string | null;
  render_variant_count: number;
  fallback_reason: string | null;
}

export interface ImportReport {
  schema: typeof IMPORT_REPORT_SCHEMA;
  generator_version: typeof SCORE_ASSET_GENERATOR_VERSION;
  content_hash: string;
  counts: {
    pptx: number;
    slides: number;
    pptx_with_base: number;
    pptx_with_accent: number;
    structured_scores: number;
    arrangements: number;
    renders: number;
    render_variants: number;
    key_signatures: number;
    meters: number;
    fallback_pptx: number;
    jpg_versions: number;
    alternate_tunes: number;
  };
  slide_outcomes: {
    imported: number;
    deduplicated: number;
    fallback: number;
    total: number;
  };
  dedupe: {
    original_pages: number;
    unique_pages: number;
    duplicate_pages: number;
  };
  unknown: {
    allowlist_version: string;
    allowlisted_glyph_count: number;
    allowlisted_run_count: number;
    unexpected_base_glyph_count: number;
    unexpected_base_run_count: number;
    unexpected_accent_run_count: number;
  };
  title_diagnostics: Array<{
    hymn_key: string;
    pptx_title: string;
    image_title: string;
  }>;
  hymns: HymnImportSummary[];
}

export interface CorpusImportResult {
  sources: Map<string, PptxSourceDocument>;
  scores: Map<string, PianoScoreDocument>;
  arrangements: Map<string, PianoArrangementDocument>;
  renders: Map<string, HymnRenderDocument>;
  catalog: GeneratedHymnCatalogEntry[];
  report: ImportReport;
  inventory: SimpMusicCorpusInventory;
}

function parsePptxFilename(filename: string, directory: string): PptxCorpusFile {
  const match = filename.match(/^(\d+)\s+(.+)\.pptx$/iu);
  if (!match) throw new Error(`无法解析 PPTX 文件名：${filename}`);
  const number = Number(match[1]);
  return {
    key: String(number),
    number,
    title: match[2].trim(),
    filename,
    path: join(directory, filename),
  };
}

function parseImageFilename(
  filename: string,
  directory: string,
): ImageCorpusFile {
  const match = filename.match(/^(\d+)([a-z]?)\s+(.+)\.jpg$/iu);
  if (!match) throw new Error(`无法解析 JPG 文件名：${filename}`);
  const number = Number(match[1]);
  const variant = match[2].toLowerCase();
  return {
    key: `${number}${variant}`,
    number,
    variant,
    title: match[3].trim().replace(/\(第二调\)$/u, ""),
    filename,
    path: join(directory, filename),
  };
}

function compareCorpusFiles(
  left: { number: number; key: string },
  right: { number: number; key: string },
): number {
  return left.number - right.number || left.key.localeCompare(right.key);
}

export async function discoverCorpusFiles(options: {
  pptxDirectory: string;
  imageDirectory: string;
}): Promise<CorpusFiles> {
  const pptx = (await readdir(options.pptxDirectory))
    .filter((filename) => filename.toLowerCase().endsWith(".pptx"))
    .map((filename) => parsePptxFilename(filename, options.pptxDirectory))
    .sort(compareCorpusFiles);
  const images = (await readdir(options.imageDirectory))
    .filter((filename) => filename.toLowerCase().endsWith(".jpg"))
    .map((filename) => parseImageFilename(filename, options.imageDirectory))
    .sort(compareCorpusFiles);
  return { pptx, images };
}

function hasFont(document: PptxSourceDocument, family: string): boolean {
  return document.slides.some((slide) =>
    slide.shapes.some(
      (shape) =>
        shape.kind === "text" &&
        shape.paragraphs.some((paragraph) =>
          paragraph.runs.some((run) => run.font_family === family),
        ),
    ),
  );
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .replace(/\(第二调\)$/u, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "")
    .toLocaleLowerCase("zh-CN");
}

export function buildCatalog(
  files: CorpusFiles,
  structuredKeys: ReadonlySet<string>,
  arrangementKeys: ReadonlySet<string> = new Set(),
  renderVariantCounts: ReadonlyMap<string, number> = new Map(),
): {
  catalog: GeneratedHymnCatalogEntry[];
  titleDiagnostics: ImportReport["title_diagnostics"];
} {
  const pptxByNumber = new Map(
    files.pptx.map((item) => [item.number, item]),
  );
  const titleDiagnostics: ImportReport["title_diagnostics"] = [];
  const catalog = files.images.map((image): GeneratedHymnCatalogEntry => {
    const pptx = pptxByNumber.get(image.number);
    const baseKey = String(image.number);
    const renderVariantCount = renderVariantCounts.get(baseKey) ?? 0;
    const renderAssetUrl =
      renderVariantCount > 0
        ? `/materials/hymns/${baseKey}/render.json`
        : null;
    if (
      image.variant === "" &&
      pptx &&
      normalizeTitle(image.title) !== normalizeTitle(pptx.title)
    ) {
      titleDiagnostics.push({
        hymn_key: image.key,
        pptx_title: pptx.title,
        image_title: image.title,
      });
    }

    if (image.variant !== "") {
      const renderVariant = renderVariantCount >= 2 ? 1 : null;
      return {
        hymn_key: image.key,
        key: image.key,
        number: image.number,
        variant: image.variant,
        title: image.title,
        filename: image.filename,
        image_url: `/歌谱/${encodeURIComponent(image.filename)}`,
        is_alternate_tune: true,
        score_source: "image",
        score_schema: null,
        arrangement_schema: null,
        render_schema: renderVariant === null ? null : RENDER_SCHEMA,
        score_asset_url: null,
        arrangement_asset_url: null,
        render_asset_url:
          renderVariant === null ? null : renderAssetUrl,
        render_variant: renderVariant,
        fallback_reason: "第二调暂无独立 SimpMusic PPTX，使用本版本图片谱。",
      };
    }

    const fallback =
      STRUCTURED_SCORE_FALLBACKS[
        image.key as keyof typeof STRUCTURED_SCORE_FALLBACKS
      ];
    if (!structuredKeys.has(image.key)) {
      return {
        hymn_key: image.key,
        key: image.key,
        number: image.number,
        variant: "",
        title: image.title,
        filename: image.filename,
        image_url: `/歌谱/${encodeURIComponent(image.filename)}`,
        is_alternate_tune: false,
        score_source: "image",
        score_schema: null,
        arrangement_schema: null,
        render_schema: null,
        score_asset_url: null,
        arrangement_asset_url: null,
        render_asset_url: null,
        render_variant: null,
        fallback_reason:
          fallback?.reason ?? "PPTX 无可用的结构化 SimpMusic 谱面。",
      };
    }

    return {
      hymn_key: image.key,
      key: image.key,
      number: image.number,
      variant: "",
      title: image.title,
      filename: image.filename,
      image_url: `/歌谱/${encodeURIComponent(image.filename)}`,
      is_alternate_tune: false,
      score_source: "pptx",
      score_schema: SCORE_SCHEMA,
      arrangement_schema: arrangementKeys.has(image.key)
        ? ARRANGEMENT_SCHEMA
        : null,
      render_schema:
        renderVariantCount > 0 ? RENDER_SCHEMA : null,
      score_asset_url: `/materials/hymns/${image.key}/score.json`,
      arrangement_asset_url: arrangementKeys.has(image.key)
        ? `/materials/hymns/${image.key}/arrangement.json`
        : null,
      render_asset_url: renderAssetUrl,
      render_variant: renderVariantCount > 0 ? 0 : null,
      fallback_reason: null,
    };
  });
  return {
    catalog: catalog.sort(compareCorpusFiles),
    titleDiagnostics: titleDiagnostics.sort(
      (left, right) => Number(left.hymn_key) - Number(right.hymn_key),
    ),
  };
}

async function readSources(
  files: readonly PptxCorpusFile[],
  concurrency: number,
): Promise<PptxSourceDocument[]> {
  const documents = new Array<PptxSourceDocument>(files.length);
  let cursor = 0;
  async function worker() {
    while (cursor < files.length) {
      const index = cursor;
      cursor += 1;
      documents[index] = await readPptxSource(files[index].path, {
        sourceFile: `712首-文字/${files[index].filename}`,
      });
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, files.length || 1)) },
      () => worker(),
    ),
  );
  return documents;
}

function sumGlyphCount(
  items: SimpMusicCorpusInventory["unknown"]["allowlisted_base"],
): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}

export async function importCorpus(options: {
  pptxDirectory: string;
  imageDirectory: string;
  ocrMetadataPath?: string;
  manualArrangementDirectory?: string;
  concurrency?: number;
}): Promise<CorpusImportResult> {
  const files = await discoverCorpusFiles(options);
  const documents = await readSources(files.pptx, options.concurrency ?? 8);
  const inventory = inspectSimpMusicSourceDocuments(documents);
  const baseDocuments = documents.filter((document) =>
    hasFont(document, "SimpMusic Base"),
  );
  const noBaseFilenames = documents
    .filter((document) => !hasFont(document, "SimpMusic Base"))
    .map((document) => basename(document.source_file))
    .sort();
  const mismatches = validateCorpusObservation({
    pptx_count: files.pptx.length,
    slide_count: documents.reduce(
      (sum, document) => sum + document.slides.length,
      0,
    ),
    simpmusic_base_pptx_count: inventory.pptx_with_base,
    simpmusic_accent_pptx_count: inventory.pptx_with_accent,
    jpg_count: files.images.length,
    alternate_tune_count: files.images.filter(
      (image) => image.variant !== "",
    ).length,
    base_hymn_numbers: files.pptx.map((file) => file.number),
    no_base_pptx_filenames: noBaseFilenames,
  });
  if (mismatches.length > 0) {
    throw new Error(
      `语料基线不匹配：${mismatches
        .map(
          (item) => `${item.field} 期望 ${item.expected}，实际 ${item.actual}`,
        )
        .join("；")}`,
    );
  }
  if (
    inventory.unknown.unexpected_base.length > 0 ||
    inventory.unknown.unexpected_accent_runs.length > 0
  ) {
    throw new Error("存在未登记的 SimpMusic Base 或 Accent 字形");
  }

  const sources = new Map<string, PptxSourceDocument>();
  const scores = new Map<string, PianoScoreDocument>();
  const arrangements = new Map<string, PianoArrangementDocument>();
  const renders = new Map<string, HymnRenderDocument>();
  const ocrMetadata = options.ocrMetadataPath
    ? await loadOcrMetadata(options.ocrMetadataPath)
    : new Map<string, OcrMetadataRecord>();
  const manualCache = new Map<string, ManualArrangementOverrides | null>();
  const manualFor = async (
    hymnKey: string,
  ): Promise<ManualArrangementOverrides | undefined> => {
    if (!options.manualArrangementDirectory) return undefined;
    if (!manualCache.has(hymnKey)) {
      try {
        manualCache.set(
          hymnKey,
          await loadManualArrangement(
            join(options.manualArrangementDirectory, `${hymnKey}.json`),
          ),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        manualCache.set(hymnKey, null);
      }
    }
    return manualCache.get(hymnKey) ?? undefined;
  };
  const summaries: HymnImportSummary[] = [];
  let originalPages = 0;
  let uniquePages = 0;
  let duplicatePages = 0;
  let fallbackSlides = 0;

  for (const document of documents) {
    const fallback =
      STRUCTURED_SCORE_FALLBACKS[
        document.hymn_key as keyof typeof STRUCTURED_SCORE_FALLBACKS
      ];
    if (!baseDocuments.includes(document)) {
      fallbackSlides += document.slides.length;
      summaries.push({
        hymn_key: document.hymn_key,
        pptx_filename: basename(document.source_file),
        slide_count: document.slides.length,
        score_source: "image",
        unique_score_pages: 0,
        deduplicated_slides: 0,
        warning_count: document.diagnostics.filter(
          (item) => item.severity === "warning",
        ).length,
        error_count: document.diagnostics.filter(
          (item) => item.severity === "error",
        ).length,
        score_hash: null,
        arrangement_hash: null,
        render_hash: null,
        render_variant_count: 0,
        fallback_reason:
          fallback?.reason ?? "PPTX 无可用的结构化 SimpMusic 谱面。",
      });
      continue;
    }

    assertSourceDocument(document);
    const render = buildRenderDocument(document);
    assertRenderDocument(render);
    const result = dedupeScorePages(
      document,
      buildPianoScore(document, {
        metadataFallback: ocrMetadata.get(document.hymn_key),
      }),
    );
    assertScoreDocument(result.score);
    const arrangement = buildPianoArrangement(
      result.score,
      await manualFor(document.hymn_key),
    );
    assertArrangementDocument(result.score, arrangement);
    sources.set(document.hymn_key, document);
    scores.set(document.hymn_key, result.score);
    arrangements.set(document.hymn_key, arrangement);
    renders.set(document.hymn_key, render);
    originalPages += result.original_page_count;
    uniquePages += result.unique_page_count;
    duplicatePages += result.duplicate_page_count;
    const diagnostics = [
      ...document.diagnostics,
      ...result.score.diagnostics,
    ];
    summaries.push({
      hymn_key: document.hymn_key,
      pptx_filename: basename(document.source_file),
      slide_count: document.slides.length,
      score_source: "pptx",
      unique_score_pages: result.unique_page_count,
      deduplicated_slides: result.duplicate_page_count,
      warning_count: diagnostics.filter(
        (item) => item.severity === "warning",
      ).length,
      error_count: diagnostics.filter(
        (item) => item.severity === "error",
      ).length,
      score_hash: result.score.content_hash,
      arrangement_hash: arrangement.content_hash,
      render_hash: render.content_hash,
      render_variant_count: render.variants.length,
      fallback_reason: null,
    });
  }

  const builtCatalog = buildCatalog(
    files,
    new Set(scores.keys()),
    new Set(arrangements.keys()),
    new Map(
      [...renders].map(([hymnKey, render]) => [
        hymnKey,
        render.variants.length,
      ]),
    ),
  );
  const slides = documents.reduce(
    (sum, document) => sum + document.slides.length,
    0,
  );
  const withoutHash: Omit<ImportReport, "content_hash"> = {
    schema: IMPORT_REPORT_SCHEMA,
    generator_version: SCORE_ASSET_GENERATOR_VERSION,
    counts: {
      pptx: files.pptx.length,
      slides,
      pptx_with_base: inventory.pptx_with_base,
      pptx_with_accent: inventory.pptx_with_accent,
      structured_scores: scores.size,
      arrangements: arrangements.size,
      renders: renders.size,
      render_variants: [...renders.values()].reduce(
        (sum, render) => sum + render.variants.length,
        0,
      ),
      key_signatures: [...scores.values()].filter(
        (score) => score.key_signature !== null,
      ).length,
      meters: [...scores.values()].filter((score) => score.meter !== null)
        .length,
      fallback_pptx: files.pptx.length - scores.size,
      jpg_versions: files.images.length,
      alternate_tunes: files.images.filter(
        (image) => image.variant !== "",
      ).length,
    },
    slide_outcomes: {
      imported: uniquePages,
      deduplicated: duplicatePages,
      fallback: fallbackSlides,
      total: uniquePages + duplicatePages + fallbackSlides,
    },
    dedupe: {
      original_pages: originalPages,
      unique_pages: uniquePages,
      duplicate_pages: duplicatePages,
    },
    unknown: {
      allowlist_version: inventory.allowlist_version,
      allowlisted_glyph_count: sumGlyphCount(
        inventory.unknown.allowlisted_base,
      ),
      allowlisted_run_count:
        inventory.unknown.allowlisted_base_run_count,
      unexpected_base_glyph_count: sumGlyphCount(
        inventory.unknown.unexpected_base,
      ),
      unexpected_base_run_count:
        inventory.unknown.unexpected_base_run_count,
      unexpected_accent_run_count:
        inventory.unknown.unexpected_accent_run_count,
    },
    title_diagnostics: builtCatalog.titleDiagnostics,
    hymns: summaries.sort(
      (left, right) => Number(left.hymn_key) - Number(right.hymn_key),
    ),
  };
  const report = withDocumentContentHash(withoutHash);

  if (
    report.counts.pptx !== CORPUS_BASELINE.pptx_count ||
    report.slide_outcomes.total !== CORPUS_BASELINE.slide_count ||
    report.counts.structured_scores !==
      CORPUS_BASELINE.simpmusic_base_pptx_count
  ) {
    throw new Error("生成结果未满足已确认的语料基线");
  }

  return {
    sources,
    scores,
    arrangements,
    renders,
    catalog: builtCatalog.catalog,
    report,
    inventory,
  };
}
