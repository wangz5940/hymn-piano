import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ARRANGEMENT_SCHEMA,
  SCORE_SCHEMA,
  validateArrangementDocument,
  validateCatalogEntry,
  validateScoreDocument,
  type PianoArrangementDocument,
  type PianoScoreDocument,
} from "../../src/features/score/contracts";
import {
  RENDER_SCHEMA,
  validateRenderDocument,
  type HymnRenderDocument,
} from "../../src/features/score/render-contracts";
import {
  STRUCTURED_SCORE_FALLBACKS,
  validateCorpusObservation,
} from "./corpus-manifest";
import {
  buildCatalog,
  discoverCorpusFiles,
  type CorpusFiles,
} from "./import-corpus";
import { imageCorpusDirectory, pptxCorpusDirectory } from "./corpus-paths";

const pptxDirectory = pptxCorpusDirectory;
const imageDirectory = imageCorpusDirectory;
const generatedRoot = resolve("public/materials/hymns");

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function fixtureFiles(): CorpusFiles {
  return {
    pptx: [
      {
        key: "1",
        number: 1,
        title: "至大医生",
        filename: "001 至大医生.pptx",
        path: "/pptx/001 至大医生.pptx",
      },
      {
        key: "60",
        number: 60,
        title: "乐哉白白恩典",
        filename: "060 乐哉白白恩典.pptx",
        path: "/pptx/060 乐哉白白恩典.pptx",
      },
    ],
    images: [
      {
        key: "1",
        number: 1,
        variant: "",
        title: "至大医生现今可近",
        filename: "001 至大医生现今可近.jpg",
        path: "/images/001 至大医生现今可近.jpg",
      },
      {
        key: "1b",
        number: 1,
        variant: "b",
        title: "至大医生现今可近",
        filename: "001b 至大医生现今可近(第二调).jpg",
        path: "/images/001b 至大医生现今可近(第二调).jpg",
      },
      {
        key: "60",
        number: 60,
        variant: "",
        title: "乐哉白白恩典",
        filename: "060 乐哉白白恩典.jpg",
        path: "/images/060 乐哉白白恩典.jpg",
      },
    ],
  };
}

describe("曲库导入索引", () => {
  it("真实目录满足 712/747/35 与连续编号基线", async () => {
    const files = await discoverCorpusFiles({
      pptxDirectory,
      imageDirectory,
    });
    const alternateTuneCount = files.images.filter(
      (image) => image.variant !== "",
    ).length;
    expect(files.pptx).toHaveLength(712);
    expect(files.images).toHaveLength(747);
    expect(alternateTuneCount).toBe(35);
    expect(files.pptx.map((item) => item.number)).toEqual(
      Array.from({ length: 712 }, (_, index) => index + 1),
    );
    expect(
      validateCorpusObservation({
        pptx_count: 712,
        slide_count: 2658,
        simpmusic_base_pptx_count: 709,
        simpmusic_accent_pptx_count: 173,
        jpg_count: files.images.length,
        alternate_tune_count: alternateTuneCount,
        base_hymn_numbers: files.pptx.map((item) => item.number),
        no_base_pptx_filenames: Object.values(
          STRUCTURED_SCORE_FALLBACKS,
        ).map((item) => item.pptx_filename),
      }),
    ).toEqual([]);
  });

  it("结构化、无 Base 和第二调目录项严格隔离", () => {
    const first = buildCatalog(
      fixtureFiles(),
      new Set(["1"]),
      new Set(["1"]),
      new Map(),
      new Map([
        [
          "1",
          {
            key_signature: "C",
            meter: "4/4",
            position_change_count: 2,
          },
        ],
      ]),
    );
    const structured = first.catalog.find((item) => item.key === "1");
    const alternate = first.catalog.find((item) => item.key === "1b");
    const noBase = first.catalog.find((item) => item.key === "60");

    expect(structured).toMatchObject({
      score_source: "pptx",
      score_schema: SCORE_SCHEMA,
      score_asset_url: "/materials/hymns/1/score.json",
      arrangement_schema: ARRANGEMENT_SCHEMA,
      arrangement_asset_url: "/materials/hymns/1/arrangement.json",
      fallback_reason: null,
      key_signature: "C",
      meter: "4/4",
      position_change_count: 2,
    });
    expect(validateCatalogEntry(structured)).toEqual([]);
    expect(alternate).toMatchObject({
      score_source: "image",
      score_asset_url: null,
      arrangement_asset_url: null,
      fallback_reason: expect.stringContaining("第二调"),
      key_signature: null,
      meter: null,
      position_change_count: null,
    });
    expect(validateCatalogEntry(alternate)).toEqual([]);
    expect(noBase).toMatchObject({
      score_source: "image",
      score_asset_url: null,
      fallback_reason: expect.stringContaining("SimpMusic Base"),
      key_signature: null,
      meter: null,
      position_change_count: null,
    });
    expect(validateCatalogEntry(noBase)).toEqual([]);
  });

  it("标题差异只记录诊断且相同输入结果确定", () => {
    const files = fixtureFiles();
    const first = buildCatalog(files, new Set(["1"]));
    const second = buildCatalog(files, new Set(["1"]));

    expect(first).toEqual(second);
    expect(first.titleDiagnostics).toEqual([
      {
        hymn_key: "1",
        pptx_title: "至大医生",
        image_title: "至大医生现今可近",
      },
    ]);
    expect(first.catalog.find((item) => item.key === "1")?.score_source).toBe(
      "pptx",
    );
  });

  it("有第二谱面变体时只给第二调暴露 render variant 1", () => {
    const result = buildCatalog(
      fixtureFiles(),
      new Set(["1"]),
      new Set(["1"]),
      new Map([["1", 2]]),
    );
    const base = result.catalog.find((item) => item.key === "1");
    const alternate = result.catalog.find((item) => item.key === "1b");

    expect(base).toMatchObject({
      score_source: "pptx",
      render_schema: RENDER_SCHEMA,
      render_asset_url: "/materials/hymns/1/render.json",
      render_variant: 0,
    });
    expect(alternate).toMatchObject({
      score_source: "image",
      score_asset_url: null,
      arrangement_asset_url: null,
      render_schema: RENDER_SCHEMA,
      render_asset_url: "/materials/hymns/1/render.json",
      render_variant: 1,
    });
  });

  it("生成报告与 709 份结构化资产满足完整语料基线", async () => {
    const report = await readJson<{
      counts: Record<string, number>;
      slide_outcomes: Record<string, number>;
      unknown: Record<string, number | string>;
      hymns: Array<{
        hymn_key: string;
        error_count: number;
        fallback_reason: string | null;
      }>;
    }>(resolve(generatedRoot, "import-report.json"));
    const catalog = await readJson<
      Array<{
        hymn_key: string;
        score_source: "pptx" | "image";
        score_schema: string | null;
        arrangement_schema: string | null;
        score_asset_url: string | null;
        arrangement_asset_url: string | null;
        fallback_reason: string | null;
        key_signature: string | null;
        meter: string | null;
        position_change_count: number | null;
      }>
    >(resolve(generatedRoot, "catalog.json"));

    expect(report.counts).toMatchObject({
      pptx: 712,
      slides: 2658,
      pptx_with_base: 709,
      pptx_with_accent: 173,
      structured_scores: 709,
      arrangements: 709,
      renders: 709,
      fallback_pptx: 3,
      jpg_versions: 747,
      alternate_tunes: 35,
    });
    expect(report.slide_outcomes.total).toBe(2658);
    expect(report.unknown).toMatchObject({
      allowlisted_glyph_count: 0,
      allowlisted_run_count: 0,
      unexpected_base_glyph_count: 0,
      unexpected_base_run_count: 0,
      unexpected_accent_run_count: 0,
    });
    expect(
      report.hymns.reduce((sum, hymn) => sum + hymn.error_count, 0),
    ).toBe(0);

    const structured = catalog.filter(
      (entry) => entry.score_source === "pptx",
    );
    const imageFallbacks = catalog.filter(
      (entry) => entry.score_source === "image",
    );
    expect(
      structured.filter((entry) => entry.key_signature !== null),
    ).toHaveLength(666);
    expect(
      structured.filter((entry) => entry.meter !== null),
    ).toHaveLength(691);
    expect(
      structured.every(
        (entry) => entry.position_change_count !== null,
      ),
    ).toBe(true);
    expect(
      imageFallbacks.every(
        (entry) =>
          entry.key_signature === null &&
          entry.meter === null &&
          entry.position_change_count === null,
      ),
    ).toBe(true);
    let chordCount = 0;
    let autoChordCount = 0;
    let confirmedChordCount = 0;
    let arrangementsWithChords = 0;
    let relativeChordCount = 0;
    let relativeArrangements = 0;
    let renderVariantsWithChords = 0;
    expect(structured).toHaveLength(709);
    for (const entry of structured) {
      expect(entry).toMatchObject({
        score_schema: SCORE_SCHEMA,
        arrangement_schema: ARRANGEMENT_SCHEMA,
        fallback_reason: null,
      });
      const score = await readJson<PianoScoreDocument>(
        resolve(`public${entry.score_asset_url}`),
      );
      const arrangement = await readJson<PianoArrangementDocument>(
        resolve(`public${entry.arrangement_asset_url}`),
      );
      const render = await readJson<HymnRenderDocument>(
        resolve(`public/materials/hymns/${entry.hymn_key}/render.json`),
      );
      expect(validateScoreDocument(score)).toEqual([]);
      expect(validateArrangementDocument(score, arrangement)).toEqual([]);
      expect(validateRenderDocument(render)).toEqual([]);
      expect(arrangement.score_hash).toBe(score.content_hash);
      chordCount += arrangement.chords.length;
      if (arrangement.chords.length > 0) arrangementsWithChords += 1;
      let hasRelativeChords = false;
      for (const chord of arrangement.chords) {
        expect(chord.display_default).toBe(true);
        if (chord.status === "auto_candidate") autoChordCount += 1;
        if (
          chord.evidence.includes(
            "调号未标明，和弦音使用相对级数表达",
          )
        ) {
          relativeChordCount += 1;
          hasRelativeChords = true;
        }
        if (
          chord.status === "manual_confirmed" ||
          chord.status === "source_confirmed"
        ) {
          confirmedChordCount += 1;
        }
      }
      if (hasRelativeChords) relativeArrangements += 1;

      const events = score.pages.flatMap((page) =>
        page.systems.flatMap((system) =>
          system.measures.flatMap((measure) => measure.events),
        ),
      );
      for (const variant of render.variants) {
        const measureIds = new Set(
          events
            .filter(
              (event) =>
                event.source_anchor?.slide === variant.canonical_slide,
            )
            .map((event) => event.measure_id),
        );
        const visibleChords = arrangement.chords.filter(
          (chord) =>
            chord.display_default && measureIds.has(chord.measure_id),
        );
        expect(visibleChords.length).toBeGreaterThan(0);
        renderVariantsWithChords += 1;
      }
    }
    expect({
      arrangementsWithChords,
      chordCount,
      autoChordCount,
      confirmedChordCount,
      relativeArrangements,
      relativeChordCount,
      renderVariantsWithChords,
    }).toEqual({
      arrangementsWithChords: 709,
      chordCount: 24_784,
      autoChordCount: 24_779,
      confirmedChordCount: 5,
      relativeArrangements: 43,
      relativeChordCount: 1_620,
      renderVariantsWithChords: 1_319,
    });
  }, 120_000);

  it("关键曲目覆盖普通、异常、人工、第二调、Accent 与末号场景", async () => {
    const catalog = await readJson<
      Array<{
        hymn_key: string;
        score_source: "pptx" | "image";
        score_asset_url: string | null;
        arrangement_asset_url: string | null;
        fallback_reason: string | null;
      }>
    >(resolve(generatedRoot, "catalog.json"));
    const byKey = new Map(catalog.map((entry) => [entry.hymn_key, entry]));

    for (const key of ["60", "63", "444"]) {
      expect(byKey.get(key)).toMatchObject({
        score_source: "image",
        score_asset_url: null,
        arrangement_asset_url: null,
        fallback_reason: expect.stringContaining("SimpMusic Base"),
      });
    }
    expect(byKey.get("118b")).toMatchObject({
      score_source: "image",
      score_asset_url: null,
      arrangement_asset_url: null,
      fallback_reason: expect.stringContaining("第二调"),
    });
    for (const key of ["1", "118", "154", "712"]) {
      expect(byKey.get(key)).toMatchObject({
        score_source: "pptx",
        score_asset_url: `/materials/hymns/${key}/score.json`,
        arrangement_asset_url: `/materials/hymns/${key}/arrangement.json`,
        fallback_reason: null,
      });
    }

    const arrangement118 = await readJson<PianoArrangementDocument>(
      resolve(generatedRoot, "118/arrangement.json"),
    );
    expect(
      arrangement118.fingerings.some(
        (item) => item.status === "manual_confirmed",
      ),
    ).toBe(true);
    expect(
      arrangement118.chords.some(
        (item) => item.status === "manual_confirmed",
      ),
    ).toBe(true);

    const score154 = await readJson<PianoScoreDocument>(
      resolve(generatedRoot, "154/score.json"),
    );
    expect(
      score154.pages.some((page) =>
        page.systems.some((system) =>
          system.measures.some((measure) =>
            measure.events.some((event) => event.raw_glyphs.includes("eo")),
          ),
        ),
      ),
    ).toBe(true);
    const score712 = await readJson<PianoScoreDocument>(
      resolve(generatedRoot, "712/score.json"),
    );
    expect(score712.hymn_key).toBe("712");
    expect(score712.pages.length).toBeGreaterThan(0);
  });
});
