import type {
  BBox,
  ContentHash,
  SourceReference,
} from "./contracts";

export const RENDER_SCHEMA = "shiqin-render/v1" as const;

export type RenderShapeRole = "score" | "accent" | "lyric";

export interface RenderTextRun {
  id: string;
  text: string;
  font_family: string | null;
  font_size: number | null;
  character_spacing?: number | null;
  bold: boolean;
  italic: boolean;
  color: string | null;
  source: SourceReference;
}

export interface RenderParagraph {
  id: string;
  order: number;
  runs: RenderTextRun[];
}

export interface RenderTextShape {
  id: string;
  role: RenderShapeRole;
  name: string;
  order: number;
  bbox_emu: BBox;
  bbox: BBox;
  rotation: number;
  source: SourceReference;
  paragraphs: RenderParagraph[];
}

export interface RenderMediaShape {
  id: string;
  name: string;
  order: number;
  bbox_emu: BBox;
  bbox: BBox;
  rotation: number;
  source: SourceReference;
  media_path: string;
  asset_url: string;
}

export interface RenderLyricVersion {
  id: string;
  source_slide: number;
  shapes: RenderTextShape[];
}

export interface RenderVariant {
  id: string;
  index: number;
  fingerprint: string;
  canonical_slide: number;
  source_slides: number[];
  page: {
    width: number;
    height: number;
    view_box: [number, number, number, number];
  };
  score_shapes: RenderTextShape[];
  media_shapes: RenderMediaShape[];
  lyric_versions: RenderLyricVersion[];
}

export interface HymnRenderDocument {
  schema: typeof RENDER_SCHEMA;
  hymn_key: string;
  title: string;
  source_hash: ContentHash;
  generator_version: string;
  content_hash: ContentHash;
  variants: RenderVariant[];
}

export interface RenderContractIssue {
  path: string;
  code: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function issue(
  path: string,
  code: string,
  message: string,
): RenderContractIssue {
  return { path, code, message };
}

export function validateRenderDocument(
  value: unknown,
): RenderContractIssue[] {
  if (!isRecord(value)) {
    return [issue("$", "invalid_document", "Render 文档必须是对象")];
  }

  const issues: RenderContractIssue[] = [];
  if (value.schema !== RENDER_SCHEMA) {
    issues.push(
      issue("$.schema", "invalid_schema", `schema 必须为 ${RENDER_SCHEMA}`),
    );
  }
  if (typeof value.hymn_key !== "string" || value.hymn_key.length === 0) {
    issues.push(issue("$.hymn_key", "invalid_hymn_key", "曲目键不能为空"));
  }
  if (!isHash(value.source_hash)) {
    issues.push(issue("$.source_hash", "invalid_hash", "source_hash 必须是 SHA-256"));
  }
  if (!isHash(value.content_hash)) {
    issues.push(
      issue("$.content_hash", "invalid_hash", "content_hash 必须是 SHA-256"),
    );
  }
  if (!Array.isArray(value.variants) || value.variants.length === 0) {
    issues.push(issue("$.variants", "missing_variants", "至少需要一个渲染变体"));
    return issues;
  }

  const variantIds = new Set<string>();
  value.variants.forEach((variantValue, variantIndex) => {
    const path = `$.variants[${variantIndex}]`;
    if (!isRecord(variantValue)) {
      issues.push(issue(path, "invalid_variant", "渲染变体必须是对象"));
      return;
    }
    if (
      typeof variantValue.id !== "string" ||
      variantIds.has(variantValue.id)
    ) {
      issues.push(issue(`${path}.id`, "invalid_id", "渲染变体 ID 必须唯一"));
    } else {
      variantIds.add(variantValue.id);
    }
    if (
      variantValue.index !== variantIndex ||
      !Number.isInteger(variantValue.index)
    ) {
      issues.push(
        issue(`${path}.index`, "invalid_index", "渲染变体索引必须连续"),
      );
    }
    if (
      !Array.isArray(variantValue.source_slides) ||
      variantValue.source_slides.length === 0
    ) {
      issues.push(
        issue(`${path}.source_slides`, "missing_slides", "变体必须保留来源 slide"),
      );
    }
    if (
      !Array.isArray(variantValue.score_shapes) ||
      variantValue.score_shapes.length === 0
    ) {
      issues.push(
        issue(`${path}.score_shapes`, "missing_score", "变体必须保留谱面 shape"),
      );
    }
    if (
      !Array.isArray(variantValue.lyric_versions) ||
      variantValue.lyric_versions.length !== 1
    ) {
      issues.push(
        issue(
          `${path}.lyric_versions`,
          "invalid_lyrics",
          "每个变体必须且只能保留第一段歌词",
        ),
      );
    }
    if (!Array.isArray(variantValue.media_shapes)) {
      issues.push(
        issue(
          `${path}.media_shapes`,
          "invalid_media",
          "媒体谱面元素必须是数组",
        ),
      );
    }
  });

  return issues;
}

export function assertRenderDocument(
  value: unknown,
): asserts value is HymnRenderDocument {
  const issues = validateRenderDocument(value);
  if (issues.length === 0) return;
  throw new Error(
    `Render 文档校验失败：${issues
      .map((item) => `${item.path}: ${item.message}`)
      .join("; ")}`,
  );
}
