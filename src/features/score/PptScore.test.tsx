import { render } from "@testing-library/react";
import { makeRender } from "@/test/scoreFixtures";
import { PptScore } from "./PptScore";

describe("PptScore", () => {
  it("[defect-probing] 将 PPT 正负字符间距转换为 CSS letter-spacing", () => {
    const document = makeRender();
    const shape = document.variants[0].lyric_versions[0].shapes[0];
    const run = shape.paragraphs[0].runs[0];
    const positive = {
      ...run,
      id: "lyric-spacing-positive",
      text: "的",
      character_spacing: 16,
    };
    const negative = {
      ...run,
      id: "lyric-spacing-negative",
      text: "，",
      character_spacing: -16,
    };
    shape.paragraphs = [
      {
        id: "lyric-spacing-paragraph",
        order: 0,
        runs: [positive, negative],
      },
    ];

    const { container } = render(
      <PptScore document={document} variantIndex={0} />,
    );

    expect(
      container.querySelector<HTMLElement>(
        ".ppt-render-box--lyric span:nth-of-type(1)",
      ),
    ).toHaveStyle({ letterSpacing: "21.333px" });
    expect(
      container.querySelector<HTMLElement>(
        ".ppt-render-box--lyric span:nth-of-type(2)",
      ),
    ).toHaveStyle({ letterSpacing: "-21.333px" });
  });

  it("[defect-probing] 歌词按 PPT 样式使用统一字号与行高", () => {
    const document = makeRender();
    const shape = document.variants[0].lyric_versions[0].shapes[0];
    const firstRun = {
      ...shape.paragraphs[0].runs[0],
      font_size: 32,
      text: "第一行歌词",
    };
    shape.bbox = { x: 94.445, y: 123.631, width: 857.995, height: 395.828 };
    shape.paragraphs = [
      {
        id: "lyric-paragraph-1",
        order: 0,
        runs: [firstRun],
      },
      {
        id: "lyric-paragraph-2",
        order: 1,
        runs: [],
      },
      {
        id: "lyric-paragraph-3",
        order: 2,
        runs: [
          {
            ...firstRun,
            id: "lyric-run-3",
            text: "第三行歌词",
          },
        ],
      },
    ];

    const { container } = render(
      <PptScore document={document} variantIndex={0} />,
    );
    const lyric = container.querySelector(
      'foreignObject[data-render-role="lyric"]',
    );
    const box = lyric?.querySelector<HTMLElement>(".ppt-render-box--lyric");

    expect(lyric).toHaveAttribute("x", "94.445");
    expect(lyric).toHaveAttribute("width", "857.995");
    expect(Number(lyric?.getAttribute("height"))).toBeGreaterThan(48);
    expect(Number(lyric?.getAttribute("y"))).toBeGreaterThan(140);
    const scoreRow = container.querySelector<SVGGElement>("[data-score-row]");
    expect(Number(lyric?.getAttribute("y"))).toBe(
      Number(scoreRow?.dataset.lyricY),
    );
    expect(Number(lyric?.getAttribute("y"))).toBeLessThan(
      Number(scoreRow?.dataset.lyricBottom),
    );
    expect(box).toHaveStyle({
      fontSize: "42.667px",
      lineHeight: "1.35",
      padding: "2px 4px",
      whiteSpace: "pre",
    });
    expect(box).toHaveTextContent("第一行歌词");
    expect(box).not.toHaveTextContent("第三行歌词");
    expect(box?.querySelector("br")).not.toBeInTheDocument();
  });

  it("每个谱行按手位、指法、歌谱、歌词分轨且下一行不回叠", () => {
    const document = makeRender();
    const variant = document.variants[0];
    const firstScore = variant.score_shapes[0];
    variant.score_shapes.push({
      ...firstScore,
      id: "score-shape-2",
      order: 3,
      bbox: { ...firstScore.bbox, y: 210 },
      bbox_emu: {
        ...firstScore.bbox_emu,
        y: 210 * 9_525,
      },
    });
    const lyricShape = variant.lyric_versions[0].shapes[0];
    const lyricRun = lyricShape.paragraphs[0].runs[0];
    lyricShape.bbox = { ...lyricShape.bbox, y: 140, height: 210 };
    lyricShape.paragraphs = [
      {
        id: "lyric-line-1",
        order: 0,
        runs: [{ ...lyricRun, text: "第一谱行歌词" }],
      },
      { id: "lyric-gap", order: 1, runs: [] },
      {
        id: "lyric-line-2",
        order: 2,
        runs: [{ ...lyricRun, id: "lyric-run-2", text: "第二谱行歌词" }],
      },
    ];

    const { container } = render(
      <PptScore document={document} variantIndex={0} />,
    );
    const rows = Array.from(
      container.querySelectorAll<SVGGElement>("[data-score-row]"),
    );

    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      const positionY = Number(row.dataset.positionY);
      const fingeringY = Number(row.dataset.fingeringY);
      const scoreY = Number(row.dataset.scoreY);
      const lyricY = Number(row.dataset.lyricY);
      expect(positionY).toBeLessThan(fingeringY);
      expect(fingeringY).toBeLessThan(scoreY);
      expect(scoreY).toBeLessThan(lyricY);
    });
    expect(Number(rows[0].dataset.lyricBottom)).toBeLessThan(
      Number(rows[1].dataset.positionY),
    );
    const lyricBoxes = Array.from(
      container.querySelectorAll<HTMLElement>(".ppt-render-box--lyric"),
    );
    expect(lyricBoxes).toHaveLength(2);
    lyricBoxes.forEach((box) => {
      expect(box).toHaveStyle({ whiteSpace: "pre" });
      expect(box.querySelector("br")).not.toBeInTheDocument();
    });
  });

  it("同一谱行有多段候选歌词时按原 y 分组并只取第一段", () => {
    const document = makeRender();
    const variant = document.variants[0];
    const firstScore = variant.score_shapes[0];
    firstScore.bbox = { ...firstScore.bbox, y: 80 };
    variant.score_shapes.push({
      ...firstScore,
      id: "score-shape-chorus",
      order: 3,
      bbox: { ...firstScore.bbox, y: 320 },
    });
    const lyricShape = variant.lyric_versions[0].shapes[0];
    const lyricRun = lyricShape.paragraphs[0].runs[0];
    lyricShape.bbox = { ...lyricShape.bbox, y: 128, height: 406 };
    lyricShape.paragraphs = [
      { id: "verse-1", order: 0, runs: [{ ...lyricRun, text: "第一段主歌" }] },
      { id: "verse-2", order: 1, runs: [{ ...lyricRun, text: "第二段主歌" }] },
      { id: "verse-3", order: 2, runs: [{ ...lyricRun, text: "第三段主歌" }] },
      { id: "gap", order: 3, runs: [] },
      { id: "chorus-1", order: 4, runs: [{ ...lyricRun, text: "第一段副歌" }] },
      { id: "chorus-2", order: 5, runs: [{ ...lyricRun, text: "第二段副歌" }] },
      { id: "chorus-3", order: 6, runs: [{ ...lyricRun, text: "第三段副歌" }] },
    ];

    const { container } = render(
      <PptScore document={document} variantIndex={0} />,
    );
    const rows = Array.from(
      container.querySelectorAll<SVGGElement>("svg > [data-score-row]"),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('[data-render-role="lyric"]')).toHaveTextContent(
      "第一段主歌",
    );
    expect(rows[1].querySelector('[data-render-role="lyric"]')).toHaveTextContent(
      "第一段副歌",
    );
    expect(container).not.toHaveTextContent("第二段主歌");
    expect(container).not.toHaveTextContent("第二段副歌");
  });

  it("紧邻的末行候选谱面合并为同一谱行并共用歌词轨", () => {
    const document = makeRender();
    const variant = document.variants[0];
    const firstScore = variant.score_shapes[0];
    firstScore.bbox = {
      ...firstScore.bbox,
      y: 80,
      height: 48,
    };
    variant.score_shapes.push({
      ...firstScore,
      id: "score-shape-ending",
      bbox: {
        ...firstScore.bbox,
        y: 130,
      },
    });
    const lyricShape = variant.lyric_versions[0].shapes[0];
    lyricShape.bbox = {
      ...lyricShape.bbox,
      y: 180,
      height: 60,
    };

    const { container } = render(
      <PptScore document={document} variantIndex={0} />,
    );
    const rows = container.querySelectorAll<SVGGElement>(
      "svg > [data-score-row]",
    );

    expect(rows).toHaveLength(1);
    expect(
      rows[0].querySelectorAll('[data-render-role="score"]'),
    ).toHaveLength(2);
    expect(
      rows[0].querySelector('[data-render-role="lyric"]'),
    ).toBeInTheDocument();
  });

  it("前奏谱行可无歌词且后续主歌仍逐行配对", () => {
    const document = makeRender();
    const variant = document.variants[0];
    const firstScore = variant.score_shapes[0];
    firstScore.bbox = { ...firstScore.bbox, y: 70 };
    variant.score_shapes.push({
      ...firstScore,
      id: "score-shape-verse",
      bbox: { ...firstScore.bbox, y: 210 },
    });
    const lyricShape = variant.lyric_versions[0].shapes[0];
    lyricShape.bbox = {
      ...lyricShape.bbox,
      y: 260,
      height: 60,
    };
    lyricShape.paragraphs[0].runs[0].text = "第一段主歌";

    const { container } = render(
      <PptScore document={document} variantIndex={0} />,
    );
    const rows = container.querySelectorAll<SVGGElement>(
      "svg > [data-score-row]",
    );

    expect(rows).toHaveLength(2);
    expect(
      rows[0].querySelector('[data-render-role="lyric"]'),
    ).not.toBeInTheDocument();
    expect(
      rows[1].querySelector('[data-render-role="lyric"]'),
    ).toHaveTextContent("第一段主歌");
    expect(
      container.querySelector(
        'svg > foreignObject[data-render-role="lyric"]',
      ),
    ).not.toBeInTheDocument();
  });
});
