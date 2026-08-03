import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { HymnRenderDocument } from "./render-contracts";
import { buildScoreReflowLayout } from "./ppt-score-layout";

const generatedRoot = resolve("public/materials/hymns");
const metadataPattern =
  /^\s*(?:[（(]?注[：:]|(?:稍|不|很|中)?(?:快|慢)$|和$|切换\s)/u;

async function readRenderDocuments(): Promise<HymnRenderDocument[]> {
  const directories = (await readdir(generatedRoot, {
    withFileTypes: true,
  }))
    .filter(
      (entry) => entry.isDirectory() && /^\d+$/u.test(entry.name),
    )
    .sort(
      (left, right) => Number(left.name) - Number(right.name),
    );
  const documents = await Promise.all(
    directories.map(async (entry) => {
      const path = resolve(generatedRoot, entry.name, "render.json");
      try {
        return JSON.parse(
          await readFile(path, "utf8"),
        ) as HymnRenderDocument;
      } catch {
        return null;
      }
    }),
  );
  return documents.filter(
    (document): document is HymnRenderDocument =>
      document !== null,
  );
}

describe("PPT 全量重排语料", () => {
  it("709 首 1319 个变体无元数据污染、轨道回叠或媒体缺失", async () => {
    const documents = await readRenderDocuments();
    const variants = documents.flatMap((document) =>
      document.variants.map((variant) => ({ document, variant })),
    );
    const fallbackVariants: string[] = [];
    const preludeVariants: string[] = [];
    const mediaPaths: string[] = [];

    expect(documents).toHaveLength(709);
    expect(variants).toHaveLength(1319);

    for (const { document, variant } of variants) {
      expect(document.generator_version).toBe("render-builder/v3");
      expect(variant.score_shapes.length).toBeGreaterThan(0);
      expect(variant.lyric_versions).toHaveLength(1);

      const firstScoreY = Math.min(
        ...variant.score_shapes
          .filter((shape) => shape.role === "score")
          .map((shape) => shape.bbox.y),
      );
      const lyricShapes = variant.lyric_versions[0].shapes;
      expect(lyricShapes.length).toBeGreaterThan(0);
      for (const shape of lyricShapes) {
        const text = shape.paragraphs
          .flatMap((paragraph) => paragraph.runs)
          .map((run) => run.text)
          .join("")
          .trim();
        expect(text).not.toMatch(metadataPattern);
        expect(shape.bbox.y).toBeGreaterThanOrEqual(firstScoreY);
        expect(shape.bbox.width / variant.page.width).toBeGreaterThanOrEqual(
          0.4,
        );
      }

      const layout = buildScoreReflowLayout(variant);
      expect(layout.rows.length).toBeGreaterThan(0);
      for (const [index, row] of layout.rows.entries()) {
        expect(row.positionY).toBeLessThan(row.fingeringY);
        expect(row.fingeringY).toBeLessThan(row.scoreY);
        expect(row.scoreY).toBeLessThan(row.lyricY);
        if (row.lyricLine && index < layout.rows.length - 1) {
          expect(row.lyricBottom).toBeLessThan(
            layout.rows[index + 1].positionY,
          );
        }
      }

      const key = `${document.hymn_key}:${variant.index}`;
      if (layout.fallbackLyrics.length > 0) {
        fallbackVariants.push(key);
      } else if (
        layout.rows[0].lyricLine === undefined &&
        layout.rows.slice(1).some((row) => row.lyricLine !== undefined)
      ) {
        preludeVariants.push(key);
      }

      for (const media of variant.media_shapes) {
        if (media.asset_url.startsWith("/materials/")) {
          mediaPaths.push(
            resolve(
              "public",
              decodeURIComponent(media.asset_url).replace(/^\/+/u, ""),
            ),
          );
        }
      }
    }

    expect(fallbackVariants).toEqual([]);
    expect(preludeVariants).toEqual(["697:0"]);
    await expect(
      Promise.all(mediaPaths.map((path) => access(path))),
    ).resolves.toHaveLength(mediaPaths.length);
  }, 120_000);

  it("第 5、10 首按 PPT 手动换行逐行配对歌词", async () => {
    const documents = await readRenderDocuments();
    const expected = new Map<string, string[]>([
      [
        "5",
        [
          "需要耶稣！需要耶稣！",
          "人人都需要耶稣！",
          "要脱罪担需要主，要得平安需要主，",
          "要免沉沦得永生，你需要耶稣！",
        ],
      ],
      [
        "10",
        [
          "我的罪孽比发还多，无数罪孽追上我，",
          "罪孽刑罚怎能免脱？恳求救主拯救我！",
          "拯救我！拯救我！求主现在拯救我！",
          "赦我罪过，免我灾祸，求主现在拯救我！",
        ],
      ],
    ]);

    for (const [hymnKey, expectedLines] of expected) {
      const document = documents.find(
        (candidate) => candidate.hymn_key === hymnKey,
      );
      expect(document).toBeDefined();
      const layout = buildScoreReflowLayout(document!.variants[0]);
      expect(layout.fallbackLyrics).toEqual([]);
      expect(
        layout.rows.map((row) =>
          row.lyricLine?.paragraph.runs
            .map((run) => run.text)
            .join(""),
        ),
      ).toEqual(expectedLines);
    }
  }, 120_000);
});
