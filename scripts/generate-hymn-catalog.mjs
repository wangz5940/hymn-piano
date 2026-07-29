import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scoreDirectory = join(projectRoot, "选本诗歌712", "歌谱");
const outputFile = join(projectRoot, "src", "data", "hymns.generated.ts");
const publicCatalogFile = join(
  projectRoot,
  "public",
  "materials",
  "hymns",
  "catalog.json",
);
const filenamePattern = /^(\d+)([a-z]?)\s+(.+)\.jpg$/i;
const fallbackReasons = new Map([
  ["60", "PPTX 不含 SimpMusic Base 结构化谱面"],
  ["63", "PPTX 不含 SimpMusic Base 结构化谱面"],
  ["444", "PPTX 不含 SimpMusic Base 结构化谱面"],
]);

const generatedMetadata = new Map();
if (existsSync(publicCatalogFile)) {
  const catalog = JSON.parse(readFileSync(publicCatalogFile, "utf8"));
  for (const item of catalog) generatedMetadata.set(item.key, item);
}

const filenames = readdirSync(scoreDirectory)
  .filter((filename) => filename.toLowerCase().endsWith(".jpg"))
  .sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));

const invalidFilenames = [];
const items = [];

for (const filename of filenames) {
  const match = filename.match(filenamePattern);
  if (!match) {
    invalidFilenames.push(filename);
    continue;
  }

  const number = Number(match[1]);
  const variant = match[2].toLowerCase();
  const rawTitle = match[3].trim();
  const title = rawTitle.replace(/\(第二调\)$/, "");

  const key = `${number}${variant}`;
  const generated = generatedMetadata.get(key);
  const isAlternateTune = variant.length > 0;
  const fallbackReason = isAlternateTune
    ? "第二调暂无独立 SimpMusic PPTX，使用本版本图片谱。"
    : fallbackReasons.get(key) ?? null;
  const scoreSource = fallbackReason ? "image" : "pptx";

  items.push({
    key: `${number}${variant}`,
    number,
    variant,
    title,
    filename,
    image_url: `/歌谱/${encodeURIComponent(filename)}`,
    is_alternate_tune: isAlternateTune,
    score_source: generated?.score_source ?? scoreSource,
    score_schema:
      generated?.score_schema ??
      (scoreSource === "pptx" ? "shiqin-score/v1" : null),
    arrangement_schema: generated?.arrangement_schema ?? null,
    render_schema: generated?.render_schema ?? null,
    score_asset_url:
      generated?.score_asset_url ??
      (scoreSource === "pptx"
        ? `/materials/hymns/${key}/score.json`
        : null),
    arrangement_asset_url: generated?.arrangement_asset_url ?? null,
    render_asset_url: generated?.render_asset_url ?? null,
    render_variant: generated?.render_variant ?? null,
    fallback_reason: generated?.fallback_reason ?? fallbackReason,
  });
}

items.sort((left, right) => {
  if (left.number !== right.number) return left.number - right.number;
  return left.variant.localeCompare(right.variant);
});

const keys = new Set(items.map((item) => item.key));
const baseNumbers = new Set(
  items.filter((item) => item.variant === "").map((item) => item.number),
);
const missingNumbers = Array.from(
  { length: 712 },
  (_, index) => index + 1,
).filter((number) => !baseNumbers.has(number));
const alternateCount = items.filter((item) => item.is_alternate_tune).length;
const errors = [];

if (invalidFilenames.length > 0) {
  errors.push(`无法解析的文件：${invalidFilenames.join("、")}`);
}
if (items.length !== 747) {
  errors.push(`歌谱图片应为 747 张，实际为 ${items.length} 张`);
}
if (baseNumbers.size !== 712 || missingNumbers.length > 0) {
  errors.push(`基础编号应覆盖 1—712，缺少：${missingNumbers.join("、") || "无"}`);
}
if (alternateCount !== 35) {
  errors.push(`第二调版本应为 35 个，实际为 ${alternateCount} 个`);
}
if (keys.size !== items.length) {
  errors.push("曲库中存在重复的编号与变体键");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const serialized = JSON.stringify(items, null, 2);
const source = `// 此文件由诗琴结构化曲库生成脚本生成，请勿手工修改。
import type { HymnCatalogItem } from "@/features/hymns/types";

export const hymnCatalog: readonly HymnCatalogItem[] = ${serialized};
`;

if (!existsSync(outputFile) || readFileSync(outputFile, "utf8") !== source) {
  writeFileSync(outputFile, source, "utf8");
}
console.log(
  `已生成 ${relative(projectRoot, outputFile)}：${items.length} 个版本，${baseNumbers.size} 个编号，${alternateCount} 个第二调。`,
);
