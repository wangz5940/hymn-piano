import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unzipSync } from "fflate";
import {
  importCorpus,
  type GeneratedHymnCatalogEntry,
} from "./score-pipeline/import-corpus";
import type { PptxSourceDocument } from "../src/features/score/contracts";
import type { HymnRenderDocument } from "../src/features/score/render-contracts";

interface GenerationStats {
  written: number;
  unchanged: number;
  removed: number;
  source_bytes: number;
  score_bytes: number;
  arrangement_bytes: number;
  render_bytes: number;
  render_media_bytes: number;
}

interface CorpusDirectories {
  pptxDirectory: string;
  pptxSourceFileDirectory: string;
  imageDirectory: string;
}

function emptyStats(): GenerationStats {
  return {
    written: 0,
    unchanged: 0,
    removed: 0,
    source_bytes: 0,
    score_bytes: 0,
    arrangement_bytes: 0,
    render_bytes: 0,
    render_media_bytes: 0,
  };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function generatedAssetsExist(projectRoot: string): Promise<boolean> {
  return (
    (await isDirectory(join(projectRoot, "public", "materials", "hymns"))) &&
    (await isDirectory(join(projectRoot, "data", "generated", "hymn-sources")))
  );
}

export async function resolveCorpusDirectories(
  projectRoot: string,
): Promise<CorpusDirectories | null> {
  const candidates: CorpusDirectories[] = [
    {
      pptxDirectory: join(projectRoot, "712首-文字"),
      pptxSourceFileDirectory: "712首-文字",
      imageDirectory: join(projectRoot, "选本诗歌712", "歌谱"),
    },
    {
      pptxDirectory: join(projectRoot, "resource", "712首-文字"),
      pptxSourceFileDirectory: "712首-文字",
      imageDirectory: join(projectRoot, "resource", "歌谱"),
    },
  ];
  for (const candidate of candidates) {
    if (
      (await isDirectory(candidate.pptxDirectory)) &&
      (await isDirectory(candidate.imageDirectory))
    ) {
      return candidate;
    }
  }
  return null;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function stablePrettyJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

async function writeIfChanged(
  path: string,
  content: string,
  stats: GenerationStats,
): Promise<void> {
  let current: string | null = null;
  try {
    current = await readFile(path, "utf8");
  } catch {
    current = null;
  }
  if (current === content) {
    stats.unchanged += 1;
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  stats.written += 1;
}

async function writeBinaryIfChanged(
  path: string,
  content: Uint8Array,
  stats: GenerationStats,
): Promise<void> {
  let current: Buffer | null = null;
  try {
    current = await readFile(path);
  } catch {
    current = null;
  }
  const next = Buffer.from(content);
  if (current?.equals(next)) {
    stats.unchanged += 1;
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next);
  stats.written += 1;
}

async function removeGeneratedFile(
  path: string,
  stats: GenerationStats,
): Promise<void> {
  try {
    await rm(path);
    stats.removed += 1;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function writeRenderMediaAssets(
  publicRoot: string,
  source: PptxSourceDocument,
  render: HymnRenderDocument,
  stats: GenerationStats,
  pptxDirectory: string,
): Promise<void> {
  const mediaPaths = new Set(
    render.variants
      .flatMap((variant) => variant.media_shapes)
      .map((shape) => shape.media_path)
      .filter((path) => !/^[a-z][a-z\d+.-]*:/iu.test(path)),
  );
  const mediaRoot = join(publicRoot, source.hymn_key, "media");
  const expectedFilenames = new Set(
    [...mediaPaths].map((mediaPath) => basename(mediaPath)),
  );
  let existingFilenames: string[] = [];
  try {
    existingFilenames = await readdir(mediaRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const filename of existingFilenames) {
    if (expectedFilenames.has(filename)) continue;
    await removeGeneratedFile(join(mediaRoot, filename), stats);
  }
  if (mediaPaths.size === 0) return;

  const packageParts = unzipSync(
    new Uint8Array(
      await readFile(join(pptxDirectory, basename(source.source_file))),
    ),
  );
  for (const mediaPath of [...mediaPaths].sort()) {
    const bytes = packageParts[mediaPath];
    if (!bytes) {
      throw new Error(
        `第 ${source.hymn_key} 首缺少渲染媒体文件：${mediaPath}`,
      );
    }
    stats.render_media_bytes += bytes.byteLength;
    await writeBinaryIfChanged(
      join(mediaRoot, basename(mediaPath)),
      bytes,
      stats,
    );
  }
}

function generatedCatalogSource(
  catalog: GeneratedHymnCatalogEntry[],
): string {
  const runtimeCatalog = catalog.map((item) => ({
    key: item.key,
    number: item.number,
    variant: item.variant,
    title: item.title,
    filename: item.filename,
    image_url: item.image_url,
    is_alternate_tune: item.is_alternate_tune,
    score_source: item.score_source,
    score_schema: item.score_schema,
    arrangement_schema: item.arrangement_schema,
    render_schema: item.render_schema,
    score_asset_url: item.score_asset_url,
    arrangement_asset_url: item.arrangement_asset_url,
    render_asset_url: item.render_asset_url,
    render_variant: item.render_variant,
    fallback_reason: item.fallback_reason,
    key_signature: item.key_signature,
    meter: item.meter,
    position_change_count: item.position_change_count,
  }));
  return [
    "// 此文件由诗琴结构化曲库生成脚本生成，请勿手工修改。",
    'import type { HymnCatalogItem } from "@/features/hymns/types";',
    "",
    `export const hymnCatalog: readonly HymnCatalogItem[] = ${JSON.stringify(
      runtimeCatalog,
      null,
      2,
    )};`,
    "",
  ].join("\n");
}

export async function generateScoreAssets(
  projectRoot: string,
): Promise<GenerationStats> {
  const corpusDirectories = await resolveCorpusDirectories(projectRoot);
  if (!corpusDirectories) {
    if (await generatedAssetsExist(projectRoot)) {
      console.log(
        "未找到原始 PPTX/歌谱资源目录，已跳过重生成，继续使用已提交的生成资产。",
      );
      return emptyStats();
    }
    throw new Error(
      [
        "未找到原始 PPTX/歌谱资源目录。",
        "请放置以下任一组目录：",
        "1. 712首-文字 与 选本诗歌712/歌谱",
        "2. resource/712首-文字 与 resource/歌谱",
      ].join("\n"),
    );
  }
  const result = await importCorpus({
    pptxDirectory: corpusDirectories.pptxDirectory,
    pptxSourceFileDirectory: corpusDirectories.pptxSourceFileDirectory,
    imageDirectory: corpusDirectories.imageDirectory,
    ocrMetadataPath: join(projectRoot, "data", "hymn-ocr.jsonl"),
    manualArrangementDirectory: join(
      projectRoot,
      "data",
      "arrangements",
      "manual",
    ),
    concurrency: 8,
  });
  const stats: GenerationStats = {
    written: 0,
    unchanged: 0,
    removed: 0,
    source_bytes: 0,
    score_bytes: 0,
    arrangement_bytes: 0,
    render_bytes: 0,
    render_media_bytes: 0,
  };
  const sourceRoot = join(projectRoot, "data", "generated", "hymn-sources");
  const publicRoot = join(projectRoot, "public", "materials", "hymns");

  for (const [hymnKey, source] of [...result.sources].sort(
    ([left], [right]) => Number(left) - Number(right),
  )) {
    const content = stablePrettyJson(source);
    stats.source_bytes += Buffer.byteLength(content);
    await writeIfChanged(
      join(sourceRoot, `${hymnKey}.json`),
      content,
      stats,
    );
  }
  for (const [hymnKey, score] of [...result.scores].sort(
    ([left], [right]) => Number(left) - Number(right),
  )) {
    const content = stablePrettyJson(score);
    stats.score_bytes += Buffer.byteLength(content);
    await writeIfChanged(
      join(publicRoot, hymnKey, "score.json"),
      content,
      stats,
    );
  }
  for (const [hymnKey, arrangement] of [...result.arrangements].sort(
    ([left], [right]) => Number(left) - Number(right),
  )) {
    const content = stablePrettyJson(arrangement);
    stats.arrangement_bytes += Buffer.byteLength(content);
    await writeIfChanged(
      join(publicRoot, hymnKey, "arrangement.json"),
      content,
      stats,
    );
  }
  for (const [hymnKey, render] of [...result.renders].sort(
    ([left], [right]) => Number(left) - Number(right),
  )) {
    const content = stablePrettyJson(render);
    stats.render_bytes += Buffer.byteLength(content);
    await writeIfChanged(
      join(publicRoot, hymnKey, "render.json"),
      content,
      stats,
    );
    const source = result.sources.get(hymnKey);
    if (!source) {
      throw new Error(`第 ${hymnKey} 首缺少 Render 对应的 Source AST`);
    }
    await writeRenderMediaAssets(
      publicRoot,
      source,
      render,
      stats,
      corpusDirectories.pptxDirectory,
    );
  }

  for (const fallbackKey of ["60", "63", "444"]) {
    await removeGeneratedFile(
      join(sourceRoot, `${fallbackKey}.json`),
      stats,
    );
    await removeGeneratedFile(
      join(publicRoot, fallbackKey, "score.json"),
      stats,
    );
    await removeGeneratedFile(
      join(publicRoot, fallbackKey, "arrangement.json"),
      stats,
    );
    await removeGeneratedFile(
      join(publicRoot, fallbackKey, "render.json"),
      stats,
    );
    await rm(join(publicRoot, fallbackKey, "media"), {
      recursive: true,
      force: true,
    });
  }

  await writeIfChanged(
    join(publicRoot, "catalog.json"),
    stablePrettyJson(result.catalog),
    stats,
  );
  await writeIfChanged(
    join(publicRoot, "import-report.json"),
    stablePrettyJson(result.report),
    stats,
  );
  await writeIfChanged(
    join(projectRoot, "src", "data", "hymns.generated.ts"),
    generatedCatalogSource(result.catalog),
    stats,
  );

  console.log(
    [
      `结构化谱面 ${result.report.counts.structured_scores} 首`,
      `教学编配 ${result.report.counts.arrangements} 首`,
      `忠实渲染 ${result.report.counts.renders} 首/${
        result.report.counts.render_variants
      } 个变体`,
      `调号 ${result.report.counts.key_signatures} 首`,
      `拍号 ${result.report.counts.meters} 首`,
      `图片回退 PPTX ${result.report.counts.fallback_pptx} 首`,
      `第二调 ${result.report.counts.alternate_tunes} 个`,
      `slide ${result.report.counts.slides} 张`,
      `去重 ${result.report.dedupe.duplicate_pages} 张`,
      `allowlist unknown ${result.report.unknown.allowlisted_glyph_count} 个`,
      `unexpected unknown ${
        result.report.unknown.unexpected_base_glyph_count +
        result.report.unknown.unexpected_accent_run_count
      } 个`,
      `渲染媒体 ${stats.render_media_bytes} 字节`,
      `写入 ${stats.written}，未变化 ${stats.unchanged}，移除 ${stats.removed}`,
    ].join("；"),
  );
  return stats;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedFile && pathToFileURL(invokedFile).href === pathToFileURL(currentFile).href) {
  await generateScoreAssets(resolve(dirname(currentFile), ".."));
}
