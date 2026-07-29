import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BASE_UNKNOWN_GLYPH_ALLOWLIST,
  OBSERVED_ACCENT_CHARACTERS,
  OBSERVED_BASE_CODE_POINTS,
  SUPPORTED_BUT_UNOBSERVED_BASE_CODE_POINTS,
  classifyAccentCharacter,
  classifyBaseGlyph,
  lookupNoteGlyph,
} from "./simpmusic-map";
import {
  formatUnknownCorpusSummary,
  scanSimpMusicCorpus,
  type SimpMusicCorpusInventory,
} from "./simpmusic-inventory";

describe("SimpMusic 全语料 inventory", () => {
  let inventory: SimpMusicCorpusInventory;

  beforeAll(async () => {
    inventory = await scanSimpMusicCorpus(resolve("712首-文字"), 12);
  }, 30_000);

  it("固定 712 份 PPTX 的字体使用与字符基线", () => {
    expect(inventory).toMatchObject({
      schema: "shiqin-simpmusic-inventory/v1",
      allowlist_version: "simpmusic-base-unknown/v2",
      pptx_count: 712,
      pptx_with_base: 709,
      pptx_with_accent: 173,
      base_run_count: 121_613,
      accent_run_count: 1_310,
    });
    expect(inventory.base).toHaveLength(94);
    expect(inventory.accent).toHaveLength(6);
  });

  it("实际 codepoint 与版本化 observed 清单完全一致", () => {
    expect(inventory.base.map((item) => item.code_point)).toEqual([
      ...OBSERVED_BASE_CODE_POINTS,
    ]);
    expect(inventory.accent.map((item) => item.raw)).toEqual(
      [...OBSERVED_ACCENT_CHARACTERS].sort(),
    );
  });

  it("每个 observed Base 字形都明确分类且没有未审计 unknown", () => {
    for (const item of inventory.base) {
      expect(classifyBaseGlyph(item.raw).kind).not.toBe(
        "unknown_unallowlisted",
      );
      expect(Object.keys(item.classifications)).toHaveLength(1);
    }
    expect(inventory.unknown.unexpected_base).toEqual([]);
    expect(inventory.unknown.unexpected_base_run_count).toBe(0);
  });

  it("每个 observed Accent 字符和实际组合都明确分类", () => {
    for (const item of inventory.accent) {
      expect(classifyAccentCharacter(item.raw).kind).not.toBe(
        "unknown_unallowlisted",
      );
    }
    expect(inventory.unknown.unexpected_accent_runs).toEqual([]);
    expect(inventory.unknown.unexpected_accent_run_count).toBe(0);
    expect(inventory.accent_runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw: "-",
          count: 1_274,
          token_kinds: { arc: 1_274 },
        }),
        expect.objectContaining({
          raw: "zc3cZ",
          count: 21,
          token_kinds: { triplet: 21 },
        }),
        expect.objectContaining({
          raw: "zcc3ccZ",
          count: 12,
          token_kinds: { triplet: 12 },
        }),
        expect.objectContaining({
          raw: "zcccccccccccccccccccccccccccccccZ",
          count: 1,
          token_kinds: { bracket: 1 },
        }),
        expect.objectContaining({
          raw: "v",
          count: 2,
          token_kinds: { final_barline_candidate: 2 },
        }),
      ]),
    );
  });

  it("只将有证据的字形解码为明确音乐语义", () => {
    for (const raw of "DEFGHJKIRSTUWY") {
      expect(classifyBaseGlyph(raw).kind).toBe("note");
    }
    expect(classifyBaseGlyph("L")).toMatchObject({
      kind: "accidental",
      accidental: "sharp",
    });
    expect(classifyBaseGlyph("\uf04c")).toMatchObject({
      kind: "accidental",
      accidental: "sharp",
    });
    expect(classifyBaseGlyph('"')).toMatchObject({
      kind: "accidental",
      accidental: "natural",
    });
    expect(classifyBaseGlyph(":")).toMatchObject({
      kind: "accidental",
      accidental: "flat",
    });
    expect(classifyBaseGlyph("[")).toMatchObject({
      kind: "repeat",
      direction: "start",
    });
    expect(classifyBaseGlyph("]")).toMatchObject({
      kind: "repeat",
      direction: "end",
    });
    expect(classifyBaseGlyph("\\")).toEqual({ kind: "final_barline" });
    expect(classifyBaseGlyph("–")).toMatchObject({
      kind: "note",
      degree: 2,
      octave: 2,
    });
  });

  it("F09B 是受支持但本批语料未使用的低音十六分 2", () => {
    expect(SUPPORTED_BUT_UNOBSERVED_BASE_CODE_POINTS).toContain(0xf09b);
    expect(inventory.base.some((item) => item.code_point === 0xf09b)).toBe(
      false,
    );
    expect(lookupNoteGlyph("\uf09b")).toMatchObject({
      degree: 2,
      octave: -1,
      duration: 0.25,
      beams: 2,
    });
  });

  it("已确认字形移出 allowlist，语料不伪造装饰音", () => {
    expect(inventory.unknown.allowlisted_base).toEqual([]);
    expect(inventory.unknown.allowlisted_base_run_count).toBe(0);
    expect(BASE_UNKNOWN_GLYPH_ALLOWLIST).toHaveLength(0);
    expect(
      inventory.base.some((item) => item.classifications.ornament),
    ).toBe(false);
    const summary = formatUnknownCorpusSummary(inventory);
    expect(summary).toContain("allowlisted Base unknown");
    expect(summary).toContain("unexpected Base unknown: 无");
    expect(summary).toContain("unexpected Accent unknown: 无");
  });
});
