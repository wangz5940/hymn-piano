import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SourceTextShape } from "../../src/features/score/contracts";
import { validateRenderDocument } from "../../src/features/score/render-contracts";
import { readPptxSource } from "./pptx-reader";
import { buildRenderDocument } from "./render-builder";

const hymn001 = resolve("712首-文字/001 至大医生.pptx");
const hymn059 = resolve("712首-文字/059 主耶稣当我们想到祢.pptx");
const hymn110 = resolve("712首-文字/110 我们当来同声欢呼.pptx");
const hymn118 = resolve("712首-文字/118 神的儿子亲爱救主.pptx");
const hymn712 = resolve("712首-文字/712 你们要赞美耶和华.pptx");

describe("PPT 原坐标渲染资产", () => {
  it("[defect-probing] 第 1 首七张歌词 slide 合并后只输出第一段", async () => {
    const source = await readPptxSource(hymn001);
    const render = buildRenderDocument(source);

    expect(validateRenderDocument(render)).toEqual([]);
    expect(render.hymn_key).toBe("1");
    expect(render.variants).toHaveLength(1);
    expect(render.variants[0]).toMatchObject({
      index: 0,
      canonical_slide: 1,
      source_slides: [1, 2, 3, 4, 5, 6, 7],
      page: {
        width: 960,
        height: 540,
        view_box: [0, 0, 960, 540],
      },
    });
    expect(render.variants[0].score_shapes).toHaveLength(4);
    expect(render.variants[0].lyric_versions).toHaveLength(1);
    expect(render.variants[0].lyric_versions[0]).toMatchObject({
      source_slide: 1,
      shapes: [
        {
          paragraphs: expect.arrayContaining([
            expect.objectContaining({
              runs: expect.arrayContaining([
                expect.objectContaining({ text: expect.stringContaining("至大医生") }),
              ]),
            }),
          ]),
        },
      ],
    });
  });

  it("[defect-probing] 第 118 首两套独立谱面各只保留第一段", async () => {
    const source = await readPptxSource(hymn118);
    const render = buildRenderDocument(source);

    expect(render.variants).toHaveLength(2);
    expect(render.variants.map((variant) => variant.source_slides)).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    expect(render.variants.map((variant) => variant.lyric_versions.length)).toEqual([
      1,
      1,
    ]);
    expect(
      render.variants.map(
        (variant) => variant.lyric_versions[0].source_slide,
      ),
    ).toEqual([1, 5]);
    expect(render.variants.map((variant) => variant.score_shapes.length)).toEqual([
      5,
      4,
    ]);
    expect(render.variants[0].fingerprint).not.toBe(
      render.variants[1].fingerprint,
    );
  });

  it("[defect-probing] 歌词版本排除谱前元数据与谱后编辑注释", async () => {
    const render059 = buildRenderDocument(await readPptxSource(hymn059));
    const render110 = buildRenderDocument(await readPptxSource(hymn110));

    expect(
      render059.variants.map(
        (variant) => variant.lyric_versions[0].shapes.length,
      ),
    ).toEqual([1, 1, 1, 1]);
    expect(
      render059.variants[0].lyric_versions[0].shapes[0].paragraphs
        .flatMap((paragraph) => paragraph.runs)
        .map((run) => run.text)
        .join(""),
    ).toContain("主耶稣，当我们想到祢的一切恩爱");
    expect(
      render110.variants[1].lyric_versions[0].shapes.some((shape) =>
        shape.paragraphs
          .flatMap((paragraph) => paragraph.runs)
          .some((run) => run.text.includes("Joseph Grigg")),
      ),
    ).toBe(false);
  });

  it("[defect-probing] canonical slide 的媒体谱面元素按原坐标进入渲染资产", async () => {
    const source = await readPptxSource(hymn712);
    const render = buildRenderDocument(source);
    const canonicalMedia = source.slides[0].shapes.filter(
      (shape) => shape.kind === "media",
    );

    expect(canonicalMedia.length).toBeGreaterThan(0);
    expect(render.variants[0]).toMatchObject({
      media_shapes: canonicalMedia.map((shape) => ({
        id: shape.id,
        bbox: shape.bbox,
        bbox_emu: shape.bbox_emu,
        media_path: shape.media_path,
        rotation: shape.rotation,
        source: shape.source,
      })),
    });
  });

  it("保留 canonical slide 的字体、run、旋转与原始坐标", async () => {
    const source = await readPptxSource(hymn118);
    const render = buildRenderDocument(source);
    const canonicalSlide = source.slides[0];
    const canonicalScoreShape = canonicalSlide.shapes
      .filter((shape): shape is SourceTextShape => shape.kind === "text")
      .find(
        (shape) =>
        shape.paragraphs.some((paragraph) =>
          paragraph.runs.some(
            (run) => run.font_family === "SimpMusic Base",
          ),
        ),
      );
    const renderedScoreShape = render.variants[0].score_shapes.find(
      (shape) => shape.id === canonicalScoreShape?.id,
    );

    expect(renderedScoreShape).toMatchObject({
      role: "score",
      bbox: canonicalScoreShape?.bbox,
      bbox_emu: canonicalScoreShape?.bbox_emu,
      rotation: canonicalScoreShape?.rotation,
      paragraphs: canonicalScoreShape?.paragraphs,
    });
  });

  it("相同 Source AST 重复生成得到相同文档与内容哈希", async () => {
    const source = await readPptxSource(hymn001);
    const first = buildRenderDocument(source);
    const second = buildRenderDocument(source);

    expect(first).toEqual(second);
    expect(first.content_hash).toMatch(/^[a-f0-9]{64}$/u);
  });
});
