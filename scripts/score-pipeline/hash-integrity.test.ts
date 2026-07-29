import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  PianoArrangementDocument,
  PianoScoreDocument,
} from "../../src/features/score/contracts";
import type { HymnRenderDocument } from "../../src/features/score/render-contracts";
import type {
  GeneratedHymnCatalogEntry,
  ImportReport,
} from "./import-corpus";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "content_hash")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function expectedContentHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T;
}

describe("生成资产哈希完整性", () => {
  it("[defect-probing] 全部 Score、Arrangement、Render 与 Report 哈希覆盖最终写出内容", async () => {
    const catalog = await readJson<GeneratedHymnCatalogEntry[]>(
      "public/materials/hymns/catalog.json",
    );
    const report = await readJson<ImportReport>(
      "public/materials/hymns/import-report.json",
    );
    const summaries = new Map(
      report.hymns.map((summary) => [summary.hymn_key, summary]),
    );
    const structured = catalog.filter(
      (entry) => entry.score_source === "pptx",
    );

    expect(structured).toHaveLength(report.counts.structured_scores);
    expect(structured).toHaveLength(report.counts.arrangements);
    expect(structured).toHaveLength(report.counts.renders);
    for (const entry of structured) {
      expect(entry.score_asset_url).not.toBeNull();
      expect(entry.arrangement_asset_url).not.toBeNull();
      expect(entry.render_asset_url).not.toBeNull();
      const score = await readJson<PianoScoreDocument>(
        `public${entry.score_asset_url}`,
      );
      const arrangement = await readJson<PianoArrangementDocument>(
        `public${entry.arrangement_asset_url}`,
      );
      const render = await readJson<HymnRenderDocument>(
        `public${entry.render_asset_url}`,
      );
      const summary = summaries.get(entry.hymn_key);

      expect(score.content_hash).toBe(expectedContentHash(score));
      expect(arrangement.score_hash).toBe(score.content_hash);
      expect(arrangement.content_hash).toBe(expectedContentHash(arrangement));
      expect(render.content_hash).toBe(expectedContentHash(render));
      expect(summary?.score_hash).toBe(score.content_hash);
      expect(summary?.arrangement_hash).toBe(arrangement.content_hash);
      expect(summary?.render_hash).toBe(render.content_hash);
      expect(summary?.render_variant_count).toBe(render.variants.length);
    }
    expect(report.content_hash).toBe(expectedContentHash(report));
  }, 120_000);
});
