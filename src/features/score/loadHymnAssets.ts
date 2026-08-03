import type { HymnCatalogItem } from "@/features/hymns/types";
import type {
  PianoArrangementDocument,
  PianoScoreDocument,
} from "./contracts";
import { assertArrangementDocument, assertScoreDocument } from "./contracts";
import type {
  FontFaceSetLike,
  FontMetricsMeasurer,
} from "./fontAvailability";
import { decideScoreRenderMode } from "./fontAvailability";
import type { HymnRenderDocument } from "./render-contracts";
import { assertRenderDocument } from "./render-contracts";

export type HymnAssets =
  | { status: "loading" }
  | {
      status: "structured";
      score: PianoScoreDocument;
      arrangement: PianoArrangementDocument;
      render?: HymnRenderDocument;
      renderVariant?: number;
    }
  | {
      status: "faithful";
      render: HymnRenderDocument;
      renderVariant: number;
      score: PianoScoreDocument;
      arrangement: PianoArrangementDocument;
      reason: string | null;
    }
  | {
      status: "image";
      reason: string;
      score?: PianoScoreDocument;
      arrangement?: PianoArrangementDocument;
    }
  | { status: "error"; message: string };

export class HymnAssetError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "HymnAssetError";
    if (options && "cause" in options) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export interface LoadHymnAssetsOptions {
  fetch?: typeof fetch;
  fontSet?: FontFaceSetLike | null;
  measureText?: FontMetricsMeasurer | null;
  hashDocument?: (document: unknown) => Promise<string | null> | string | null;
  signal?: AbortSignal;
}

function imageReason(hymn: HymnCatalogItem): string {
  return hymn.fallback_reason ?? "该曲目仅提供图片谱。";
}

function hasRenderAsset(hymn: HymnCatalogItem): boolean {
  return Boolean(
    hymn.render_schema === "shiqin-render/v1" &&
      hymn.render_asset_url &&
      Number.isInteger(hymn.render_variant) &&
      Number(hymn.render_variant) >= 0,
  );
}

function siblingAssetUrl(assetUrl: string, filename: string): string {
  const absolutePattern = /^[a-z][a-z\d+.-]*:/iu;
  const parsed = new URL(assetUrl, "http://local.shigin");
  const segments = parsed.pathname.split("/");
  segments[segments.length - 1] = filename;
  parsed.pathname = segments.join("/");
  return absolutePattern.test(assetUrl)
    ? parsed.href
    : `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function initialHymnAssets(
  hymn: HymnCatalogItem | undefined,
): HymnAssets {
  if (!hymn) return { status: "loading" };
  if (hymn.score_source !== "pptx" && !hasRenderAsset(hymn)) {
    return { status: "image", reason: imageReason(hymn) };
  }
  return { status: "loading" };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function canonicalize(value: unknown, isRoot: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item, false));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !(isRoot && key === "content_hash"))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested, false)]),
    );
  }
  return value;
}

function validateRender(
  raw: unknown,
  hymn: HymnCatalogItem,
): HymnRenderDocument {
  try {
    assertRenderDocument(raw);
  } catch (cause) {
    throw new HymnAssetError(
      `第 ${hymn.key} 首忠实渲染数据不符合规范。`,
      { cause },
    );
  }
  const render = raw as HymnRenderDocument;
  const expectedKey = String(hymn.number);
  if (render.hymn_key !== expectedKey) {
    throw new HymnAssetError(
      `渲染归属校验失败：期望第 ${expectedKey} 首，实际为第 ${render.hymn_key} 首。`,
    );
  }
  const variant = Number(hymn.render_variant);
  if (!render.variants[variant]) {
    throw new HymnAssetError(
      `第 ${hymn.key} 首缺少渲染变体 ${variant}。`,
    );
  }
  return render;
}

// 标记 crypto.subtle 不可用的降级警告是否已输出，避免重复刷屏
let insecureContextWarned = false;

async function hashCanonicalContent(
  document: unknown,
): Promise<string | null> {
  // crypto.subtle 仅在安全上下文（HTTPS 或 localhost）下可用。
  // 通过局域网 IP（http://192.168.x.x）访问时为 undefined，此时跳过哈希校验。
  // 数据由构建过程预生成、同源加载、TCP 保证传输完整性，降级可接受。
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    if (!insecureContextWarned) {
      insecureContextWarned = true;
      console.warn(
        "[hymn] crypto.subtle 不可用（非安全上下文），已跳过谱面内容哈希校验。使用 HTTPS 或 localhost 访问可恢复校验。",
      );
    }
    return null;
  }
  const bytes = new TextEncoder().encode(
    JSON.stringify(canonicalize(document, true)),
  );
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchDocument(
  url: string,
  label: string,
  hymnKey: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    throw new HymnAssetError(
      `加载第 ${hymnKey} 首${label}失败：网络请求错误。`,
      { cause },
    );
  }
  if (!response.ok) {
    throw new HymnAssetError(
      `加载第 ${hymnKey} 首${label}失败：HTTP ${response.status}。`,
    );
  }
  try {
    return await response.json();
  } catch (cause) {
    throw new HymnAssetError(`解析第 ${hymnKey} 首${label} JSON 失败。`, {
      cause,
    });
  }
}

export async function loadHymnAssets(
  hymn: HymnCatalogItem,
  options: LoadHymnAssetsOptions = {},
): Promise<HymnAssets> {
  if (hymn.score_source !== "pptx" && !hasRenderAsset(hymn)) {
    return { status: "image", reason: imageReason(hymn) };
  }

  const fetchImpl = options.fetch ?? globalThis.fetch;
  const hashDocument = options.hashDocument ?? hashCanonicalContent;
  const renderAssetUrl = hymn.render_asset_url;
  const renderVariant = Number(hymn.render_variant);
  if (!renderAssetUrl || !hasRenderAsset(hymn)) {
    throw new HymnAssetError(
      `第 ${hymn.key} 首缺少忠实渲染资产地址或变体。`,
    );
  }

  if (hymn.score_source !== "pptx") {
    const scoreAssetUrl = siblingAssetUrl(renderAssetUrl, "score.json");
    const arrangementAssetUrl = siblingAssetUrl(
      renderAssetUrl,
      "arrangement.json",
    );
    const [scoreRaw, arrangementRaw, renderRaw] = await Promise.all([
      fetchDocument(
        scoreAssetUrl,
        "谱面",
        hymn.key,
        fetchImpl,
        options.signal,
      ),
      fetchDocument(
        arrangementAssetUrl,
        "编配",
        hymn.key,
        fetchImpl,
        options.signal,
      ),
      fetchDocument(
        renderAssetUrl,
        "忠实渲染",
        hymn.key,
        fetchImpl,
        options.signal,
      ),
    ]);
    try {
      assertScoreDocument(scoreRaw);
    } catch (cause) {
      throw new HymnAssetError(`第 ${hymn.key} 首谱面数据不符合规范。`, {
        cause,
      });
    }
    const score = scoreRaw as PianoScoreDocument;
    const expectedKey = String(hymn.number);
    if (score.hymn_key !== expectedKey) {
      throw new HymnAssetError(
        `谱面归属校验失败：期望第 ${expectedKey} 首，实际为第 ${score.hymn_key} 首。`,
      );
    }
    try {
      assertArrangementDocument(score, arrangementRaw);
    } catch (cause) {
      throw new HymnAssetError(`第 ${hymn.key} 首编配数据不符合规范。`, {
        cause,
      });
    }
    const arrangement = arrangementRaw as PianoArrangementDocument;
    const render = validateRender(renderRaw, hymn);
    const scoreHash = await hashDocument(score);
    if (scoreHash !== null && scoreHash !== score.content_hash) {
      throw new HymnAssetError(
        `第 ${hymn.key} 首谱面内容哈希校验失败。`,
      );
    }
    const arrangementHash = await hashDocument(arrangement);
    if (
      arrangementHash !== null &&
      arrangementHash !== arrangement.content_hash
    ) {
      throw new HymnAssetError(
        `第 ${hymn.key} 首编配内容哈希校验失败。`,
      );
    }
    const renderHash = await hashDocument(render);
    if (renderHash !== null && renderHash !== render.content_hash) {
      throw new HymnAssetError(
        `第 ${hymn.key} 首渲染内容哈希校验失败。`,
      );
    }
    const decision = await decideScoreRenderMode({
      scoreSource: "pptx",
      fallbackReason: hymn.fallback_reason,
      fontSet: options.fontSet,
      measureText: options.measureText,
    });
    if (decision.mode === "image") {
      return { status: "image", reason: decision.reason };
    }
    return {
      status: "faithful",
      render,
      renderVariant,
      score,
      arrangement,
      reason: hymn.fallback_reason ?? null,
    };
  }

  if (!hymn.score_asset_url || !hymn.arrangement_asset_url) {
    throw new HymnAssetError(
      `第 ${hymn.key} 首缺少结构化谱面或编配资产地址。`,
    );
  }

  const [scoreRaw, arrangementRaw, renderRaw] = await Promise.all([
    fetchDocument(
      hymn.score_asset_url,
      "谱面",
      hymn.key,
      fetchImpl,
      options.signal,
    ),
    fetchDocument(
      hymn.arrangement_asset_url,
      "编配",
      hymn.key,
      fetchImpl,
      options.signal,
    ),
    fetchDocument(
      renderAssetUrl,
      "忠实渲染",
      hymn.key,
      fetchImpl,
      options.signal,
    ),
  ]);

  try {
    assertScoreDocument(scoreRaw);
  } catch (cause) {
    throw new HymnAssetError(`第 ${hymn.key} 首谱面数据不符合规范。`, {
      cause,
    });
  }
  const score = scoreRaw as PianoScoreDocument;

  if (score.hymn_key !== hymn.key) {
    throw new HymnAssetError(
      `谱面归属校验失败：期望第 ${hymn.key} 首，实际为第 ${score.hymn_key} 首。`,
    );
  }

  try {
    assertArrangementDocument(score, arrangementRaw);
  } catch (cause) {
    throw new HymnAssetError(`第 ${hymn.key} 首编配数据不符合规范。`, {
      cause,
    });
  }
  const arrangement = arrangementRaw as PianoArrangementDocument;
  const render = validateRender(renderRaw, hymn);

  const scoreHash = await hashDocument(score);
  if (scoreHash !== null && scoreHash !== score.content_hash) {
    throw new HymnAssetError(`第 ${hymn.key} 首谱面内容哈希校验失败。`);
  }
  const arrangementHash = await hashDocument(arrangement);
  if (
    arrangementHash !== null &&
    arrangementHash !== arrangement.content_hash
  ) {
    throw new HymnAssetError(`第 ${hymn.key} 首编配内容哈希校验失败。`);
  }
  const renderHash = await hashDocument(render);
  if (renderHash !== null && renderHash !== render.content_hash) {
    throw new HymnAssetError(`第 ${hymn.key} 首渲染内容哈希校验失败。`);
  }

  const decision = await decideScoreRenderMode({
    scoreSource: "pptx",
    fallbackReason: hymn.fallback_reason,
    fontSet: options.fontSet,
    measureText: options.measureText,
  });
  if (decision.mode === "structured") {
    return {
      status: "structured",
      score,
      arrangement,
      render,
      renderVariant,
    };
  }
  return { status: "image", reason: decision.reason, score, arrangement };
}
