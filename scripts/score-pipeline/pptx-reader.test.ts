import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  validateSourceDocument,
  type PptxSourceDocument,
  type SourceMediaShape,
  type SourceTextRun,
  type SourceTextShape,
} from "../../src/features/score/contracts";
import { resolvePptxCorpusFile } from "./corpus-paths";
import { readPptxSource } from "./pptx-reader";

const hymn001 = resolvePptxCorpusFile("001 至大医生.pptx");
const hymn005 = resolvePptxCorpusFile("005 需要耶稣.pptx");
const hymn060 = resolvePptxCorpusFile("060 乐哉白白恩典.pptx");
const hymn118 = resolvePptxCorpusFile("118 神的儿子亲爱救主.pptx");
const hymn154 = resolvePptxCorpusFile("154 一直走十架窄路.pptx");
const hymn712 = resolvePptxCorpusFile("712 你们要赞美耶和华.pptx");

describe("readPptxSource", () => {
  it("按 presentation 顺序读取 001 的页面、z-order、EMU/px 和 run 样式", async () => {
    const document = await readPptxSource(hymn001);

    expect(document).toMatchObject({
      schema: "shiqin-pptx-source/v1",
      hymn_key: "1",
      title: "至大医生",
      generator_version: "pptx-reader/v3",
    });
    expect(document.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(document.slides).toHaveLength(7);
    expect(document.slides.map((slide) => slide.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(document.slides[0]).toMatchObject({
      width_emu: 9_144_000,
      height_emu: 5_143_500,
      width: 960,
      height: 540,
    });

    const titleShape = textShapes(document).find(
      (shape) => shape.name === "标题 3",
    );
    expect(titleShape).toBeDefined();
    expect(titleShape?.bbox_emu).toEqual({
      x: 899_592,
      y: 1_177_589,
      width: 8_172_400,
      height: 3_770_263,
    });
    expect(titleShape?.bbox.x).toBe(94.445);
    expect(titleShape?.bbox.y).toBe(123.631);
    expect(titleShape?.paragraphs[0].runs[0]).toMatchObject({
      text: "至大医生现今可",
      font_family: "SimHei",
      font_size: 32,
      bold: false,
      italic: false,
    });
    expect(runs(document).some((run) => run.color === "#0432FF")).toBe(true);
    for (const slide of document.slides) {
      expect(slide.shapes.map((shape) => shape.order)).toEqual(
        [...slide.shapes.map((shape) => shape.order)].sort(
          (left, right) => left - right,
        ),
      );
    }
    expect(validateSourceDocument(document)).toEqual([]);
  });

  it("保留 154 的 SimpMusic 字体、原始文本和显式粗斜体", async () => {
    const document = await readPptxSource(hymn154);
    const allRuns = runs(document);
    const scoreRun = allRuns.find(
      (run) =>
        run.font_family === "SimpMusic Base" && run.text.includes("eod"),
    );

    expect(document.hymn_key).toBe("154");
    expect(document.slides).toHaveLength(6);
    expect(scoreRun).toMatchObject({
      font_family: "SimpMusic Base",
      font_size: 32,
    });
    expect(scoreRun?.text).toContain("eod");
    expect(
      allRuns.some((run) => run.bold) && allRuns.some((run) => run.italic),
    ).toBe(true);
    expect(scoreRun?.source).toMatchObject({
      asset: "data/generated/hymn-sources/154.json",
      slide: 1,
    });
    expect(scoreRun?.source.shape_id).toMatch(/^slide-1-shape-/);
    expect(scoreRun?.source.paragraph).toEqual(expect.any(Number));
    expect(scoreRun?.source.run).toEqual(expect.any(Number));
  });

  it("[defect-probing] 保留 118 歌词 run 的正负字符间距", async () => {
    const document = await readPptxSource(hymn118);
    const lyricRuns = runs(document).filter(
      (run) => run.source.shape_id === "slide-1-shape-2",
    );

    expect(
      lyricRuns.find((run) => run.text === "的"),
    ).toMatchObject({
      font_family: "SimHei",
      font_size: 32,
      character_spacing: 16,
    });
    expect(
      lyricRuns.find((run) => run.text === "，"),
    ).toMatchObject({
      font_family: "SimHei",
      font_size: 32,
      character_spacing: -16,
    });
  });

  it("[defect-probing] 将 PPT 段内换行保留为可定位的歌词行", async () => {
    const document = await readPptxSource(hymn005);
    const lyricShape = textShapes(document).find(
      (shape) => shape.id === "slide-1-shape-18",
    );
    const lines =
      lyricShape?.paragraphs.map((paragraph) =>
        paragraph.runs.map((run) => run.text).join(""),
      ) ?? [];

    expect(lines.filter(Boolean)).toEqual([
      "需要耶稣！需要耶稣！",
      "人人都需要耶稣！",
      "要脱罪担需要主，要得平安需要主，",
      "要免沉沦得永生，你需要耶稣！",
    ]);
    expect(lines).toEqual([
      lines[0],
      "",
      lines[2],
      "",
      lines[4],
      "",
      lines[6],
    ]);
    expect(validateSourceDocument(document)).toEqual([]);
  });

  it("解析 712 的图片 relationship 并保留媒体 z-order 与坐标", async () => {
    const document = await readPptxSource(hymn712);
    const media = mediaShapes(document);

    expect(document.slides).toHaveLength(4);
    expect(media.length).toBeGreaterThan(0);
    expect(
      media.every(
        (shape) =>
          shape.relationship_id.startsWith("rId") &&
          shape.media_path.startsWith("ppt/media/"),
      ),
    ).toBe(true);
    expect(
      media.some((shape) => /\.(?:png|svg)$/i.test(shape.media_path)),
    ).toBe(true);
    expect(
      media.every(
        (shape) =>
          shape.bbox_emu.width > 0 &&
          shape.bbox_emu.height > 0 &&
          shape.bbox.width > 0 &&
          shape.bbox.height > 0,
      ),
    ).toBe(true);
  });

  it("将 060 保留为无 SimpMusic Base 的正常 Source AST", async () => {
    const first = await readPptxSource(hymn060);
    const second = await readPptxSource(hymn060);

    expect(first.hymn_key).toBe("60");
    expect(first.title).toBe("乐哉白白恩典");
    expect(first.slides).toHaveLength(4);
    expect(
      runs(first).some((run) => run.font_family === "SimpMusic Base"),
    ).toBe(false);
    expect(
      textShapes(first).some((shape) =>
        shape.paragraphs.some((paragraph) =>
          paragraph.runs
            .map((run) => run.text)
            .join("")
            .includes("白白恩典"),
        ),
      ),
    ).toBe(true);
    expect(first.source_hash).toBe(second.source_hash);
    expect(first.slides).toEqual(second.slides);
  });

  it("对未知 shape 生成带稳定来源的诊断，并解析旋转角度", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shiqin-pptx-"));
    const fixture = join(directory, "999 未知节点.pptx");
    await writeFile(fixture, makeUnknownShapePptx());

    try {
      const document = await readPptxSource(fixture);
      const supportedShape = textShapes(document)[0];
      const issue = document.diagnostics.find(
        (diagnostic) => diagnostic.code === "unsupported_shape",
      );

      expect(supportedShape).toMatchObject({
        id: "slide-1-shape-2",
        order: 0,
        rotation: 90,
        bbox_emu: { x: 9_525, y: 19_050, width: 95_250, height: 190_500 },
        bbox: { x: 1, y: 2, width: 10, height: 20 },
      });
      expect(issue).toMatchObject({
        severity: "warning",
        sources: [
          {
            asset: "data/generated/hymn-sources/999.json",
            slide: 1,
            shape_id: "slide-1-shape-9",
          },
        ],
      });
      expect(issue?.message).toContain("p:graphicFrame");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function textShapes(document: PptxSourceDocument): SourceTextShape[] {
  return document.slides.flatMap((slide) =>
    slide.shapes.filter(
      (shape): shape is SourceTextShape => shape.kind === "text",
    ),
  );
}

function mediaShapes(document: PptxSourceDocument): SourceMediaShape[] {
  return document.slides.flatMap((slide) =>
    slide.shapes.filter(
      (shape): shape is SourceMediaShape => shape.kind === "media",
    ),
  );
}

function runs(document: PptxSourceDocument): SourceTextRun[] {
  return textShapes(document).flatMap((shape) =>
    shape.paragraphs.flatMap((paragraph) => paragraph.runs),
  );
}

function makeUnknownShapePptx(): Uint8Array {
  const presentation = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="1" r:id="rId1"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500"/>
</p:presentation>`;
  const presentationRelationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`;
  const slide = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr/><p:grpSpPr/>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="旋转文本"/></p:nvSpPr>
      <p:spPr><a:xfrm rot="5400000"><a:off x="9525" y="19050"/><a:ext cx="95250" cy="190500"/></a:xfrm></p:spPr>
      <p:txBody><a:p><a:r><a:rPr sz="2400" b="1" i="1"><a:latin typeface="SimpMusic Base"/></a:rPr><a:t>eod</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:graphicFrame>
      <p:nvGraphicFramePr><p:cNvPr id="9" name="未知图框"/></p:nvGraphicFramePr>
    </p:graphicFrame>
  </p:spTree></p:cSld>
</p:sld>`;
  return zipSync({
    "ppt/presentation.xml": strToU8(presentation),
    "ppt/_rels/presentation.xml.rels": strToU8(
      presentationRelationships,
    ),
    "ppt/slides/slide1.xml": strToU8(slide),
  });
}
