import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PianoScoreDocument } from "../../src/features/score/contracts";
import {
  applyOcrMetadataFallback,
  hymnKeyFromImageFilename,
  loadOcrMetadata,
  normalizeKeySignature,
  normalizeMeter,
} from "./ocr-metadata";

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

function scoreWithoutMetadata(): PianoScoreDocument {
  const score = {
    schema: "shiqin-score/v1",
    hymn_key: "1",
    title: "至大医生",
    source: {
      asset: "data/generated/hymn-sources/1.json",
      source_hash: "a".repeat(64),
      decoder_version: "test",
    },
    key_signature: null,
    meter: null,
    pages: [],
    diagnostics: [],
    content_hash: "",
  } satisfies PianoScoreDocument;
  score.content_hash = expectedContentHash(score);
  return score;
}

describe("OCR 顶层元数据", () => {
  it("规范化中西文调号和拍号", () => {
    expect(normalizeKeySignature("降E调")).toBe("E♭");
    expect(normalizeKeySignature("升F調")).toBe("F♯");
    expect(normalizeKeySignature("G週4/4")).toBe("G");
    expect(normalizeKeySignature("Bb")).toBe("B♭");
    expect(normalizeMeter(" 6 / 8 ")).toBe("6/8");
    expect(normalizeMeter("未识别")).toBeNull();
  });

  it("按基础与第二调版本键解析图片文件名", () => {
    expect(hymnKeyFromImageFilename("118 神的儿子亲爱救主.jpg")).toBe(
      "118",
    );
    expect(
      hymnKeyFromImageFilename("118b 神的儿子亲爱救主(第二调).jpg"),
    ).toBe("118b");
  });

  it("读取 JSONL 时只保留顶层元数据，不把 blocks 带入结果", async () => {
    const metadata = await loadOcrMetadata(
      join(process.cwd(), "data", "hymn-ocr.jsonl"),
    );
    expect(metadata.size).toBe(747);
    expect(metadata.get("1")).toEqual({
      filename: "1 至大医生现今可近.jpg",
      key_signature: "降E调",
      meter: "6/8",
    });
    expect(metadata.get("1")).not.toHaveProperty("blocks");
  });

  it("[defect-probing] 元数据回退修改 Score 后同步重算确定性哈希", () => {
    const initial = scoreWithoutMetadata();
    const fallback = {
      filename: "1 至大医生现今可近.jpg",
      key_signature: "降E调",
      meter: "6/8",
    };

    const first = applyOcrMetadataFallback(initial, fallback);
    const second = applyOcrMetadataFallback(initial, fallback);

    expect(first.content_hash).not.toBe(initial.content_hash);
    expect(first.content_hash).toBe(expectedContentHash(first));
    expect(second).toEqual(first);
  });
});
