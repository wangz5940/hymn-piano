import { render, waitFor } from "@testing-library/react";
import {
  makeArrangement,
  makeRender,
  makeScore,
} from "@/test/scoreFixtures";
import { PptScore } from "./PptScore";

describe("PptScore", () => {
  it("按浏览器实际字形中心校正指法横坐标", async () => {
    const document = makeRender();
    const shape = document.variants[0].score_shapes[0];
    shape.bbox = { ...shape.bbox, x: 100, width: 300 };
    shape.paragraphs[0].runs[0].text = "123";
    const score = makeScore();
    const firstEvent = score.pages[0].systems[0].measures[0].events[0];
    firstEvent.source_anchor = {
      slide: 1,
      x: 150,
      y: 105,
    };
    const arrangement = makeArrangement({
      fingerings: [makeArrangement().fingerings[0]],
      positions: [],
      chords: [],
    });
    const originalCreateRange = globalThis.document.createRange.bind(
      globalThis.document,
    );
    const rangeSpy = vi
      .spyOn(globalThis.document, "createRange")
      .mockImplementation(() => {
        const range = originalCreateRange();
        Object.defineProperty(range, "getBoundingClientRect", {
          configurable: true,
          value: () =>
            ({
              x: 310,
              y: 0,
              width: 20,
              height: 20,
              top: 0,
              right: 330,
              bottom: 20,
              left: 310,
              toJSON: () => ({}),
            }) satisfies DOMRect,
        });
        return range;
      });
    const svgRectSpy = vi
      .spyOn(SVGSVGElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        x: 0,
        y: 0,
        width: 960,
        height: 540,
        top: 0,
        right: 960,
        bottom: 540,
        left: 0,
        toJSON: () => ({}),
      });

    try {
      const { container } = render(
        <PptScore
          document={document}
          variantIndex={0}
          score={score}
          arrangement={arrangement}
        />,
      );

      await waitFor(() =>
        expect(
          container.querySelector(
            '[data-layer="fingerings"] [data-event-id="note-1"]',
          ),
        ).toHaveAttribute("x", "320"),
      );
    } finally {
      rangeSpy.mockRestore();
      svgRectSpy.mockRestore();
    }
  });

  it("将自动候选和人工确认和弦以不同状态展示在对应谱行下方", () => {
    const document = makeRender();
    const score = makeScore();
    const arrangement = makeArrangement();
    score.pages[0].systems[0].measures[0].events.forEach(
      (event, index) => {
        event.source_anchor = {
          slide: 1,
          x: 140 + index * 80,
          y: 105,
        };
      },
    );

    const { container, rerender } = render(
      <PptScore
        document={document}
        variantIndex={0}
        score={score}
        arrangement={arrangement}
      />,
    );
    const candidate = container.querySelector(
      '[data-layer="chords"] [data-chord-id="chord-1"]',
    );
    const noteName = container.querySelector(
      '[data-layer="note-names"] [data-event-id="note-1"]',
    );
    const row = container.querySelector<SVGGElement>(
      "svg > [data-score-row='0']",
    );

    expect(noteName).toHaveTextContent("E♭4");
    expect(noteName).toHaveAttribute("x", "140");
    expect(Number(noteName?.getAttribute("y"))).toBeGreaterThan(
      Number(row?.dataset.scoreBottom),
    );
    expect(Number(noteName?.getAttribute("y"))).toBeLessThanOrEqual(
      Number(row?.dataset.noteNameBottom),
    );
    expect(candidate).toHaveAttribute(
      "data-status",
      "auto_candidate",
    );
    expect(candidate).toHaveAttribute("data-score-row", "0");
    expect(candidate).toHaveTextContent("E♭ · I");
    expect(candidate).toHaveTextContent("5-3-1");
    expect(candidate).toHaveTextContent("自动预判");

    arrangement.chords[0].status = "manual_confirmed";
    rerender(
      <PptScore
        document={document}
        variantIndex={0}
        score={score}
        arrangement={arrangement}
      />,
    );
    expect(
      container.querySelector(
        '[data-layer="chords"] [data-chord-id="chord-1"]',
      ),
    ).toHaveTextContent("已确认");
  });

  it("按源锚点将和弦归入谱行并为同行碰撞分配轨道", () => {
    const document = makeRender();
    const variant = document.variants[0];
    const firstScoreShape = variant.score_shapes[0];
    variant.score_shapes.push({
      ...firstScoreShape,
      id: "score-shape-row-2",
      bbox: { ...firstScoreShape.bbox, y: 240 },
      bbox_emu: {
        ...firstScoreShape.bbox_emu,
        y: 240 * 9_525,
      },
    });
    const lyricShape = variant.lyric_versions[0].shapes[0];
    const lyricRun = lyricShape.paragraphs[0].runs[0];
    lyricShape.bbox = { ...lyricShape.bbox, y: 150, height: 220 };
    lyricShape.paragraphs = [
      {
        id: "lyric-row-1",
        order: 0,
        runs: [{ ...lyricRun, text: "第一谱行歌词" }],
      },
      {
        id: "lyric-row-2",
        order: 1,
        runs: [
          {
            ...lyricRun,
            id: "lyric-run-row-2",
            text: "第二谱行歌词",
          },
        ],
      },
    ];

    const score = makeScore();
    const firstMeasure = score.pages[0].systems[0].measures[0];
    firstMeasure.events.forEach((event, index) => {
      event.source_anchor = {
        slide: 1,
        x: 220 + index * 70,
        y: 105,
      };
    });
    const secondMeasure = structuredClone(firstMeasure);
    secondMeasure.id = "measure-2";
    secondMeasure.number = 2;
    secondMeasure.events.forEach((event, index) => {
      event.id = `${event.id}-row-2`;
      event.measure_id = secondMeasure.id;
      event.source_anchor = {
        slide: 1,
        x: 620 + index * 70,
        y: 265,
      };
    });
    score.pages[0].systems[0].measures.push(secondMeasure);

    const arrangement = makeArrangement();
    const firstChord = arrangement.chords[0];
    arrangement.chords.push(
      {
        ...firstChord,
        id: "chord-1-overlap",
      },
      {
        ...firstChord,
        id: "chord-2",
        measure_id: "measure-2",
      },
    );

    const { container } = render(
      <PptScore
        document={document}
        variantIndex={0}
        score={score}
        arrangement={arrangement}
      />,
    );
    const rows = container.querySelectorAll<SVGGElement>(
      "svg > [data-score-row]",
    );
    const firstTrack = container.querySelector(
      '[data-chord-track="0"]',
    );
    const firstChordNode = container.querySelector<SVGGElement>(
      '[data-chord-id="chord-1"]',
    );
    const overlapChordNode = container.querySelector<SVGGElement>(
      '[data-chord-id="chord-1-overlap"]',
    );
    const secondChordNode = container.querySelector<SVGGElement>(
      '[data-chord-id="chord-2"]',
    );
    const secondChordRect = secondChordNode?.querySelector("rect");

    expect(rows).toHaveLength(2);
    expect(firstTrack).toHaveAttribute("data-lane-count", "2");
    expect(firstChordNode).toHaveAttribute("data-score-row", "0");
    expect(firstChordNode).toHaveAttribute("data-lane", "0");
    expect(overlapChordNode).toHaveAttribute("data-score-row", "0");
    expect(overlapChordNode).toHaveAttribute("data-lane", "1");
    expect(secondChordNode).toHaveAttribute("data-score-row", "1");
    expect(Number(rows[0].dataset.scoreBottom)).toBeLessThan(
      Number(rows[0].dataset.chordY),
    );
    expect(Number(rows[0].dataset.chordBottom)).toBeLessThan(
      Number(rows[0].dataset.lyricY),
    );
    expect(Number(rows[0].dataset.lyricBottom)).toBeLessThan(
      Number(rows[1].dataset.positionY),
    );
    expect(
      Number(secondChordRect?.getAttribute("x")) +
        Number(secondChordRect?.getAttribute("width")) / 2,
    ).toBe(Number(secondChordNode?.getAttribute("data-source-x")));
    expect(Number(secondChordRect?.getAttribute("width"))).toBeLessThan(64);
  });

  it("每张和弦卡按内容收缩且中心对齐对应音符", () => {
    const document = makeRender();
    const score = makeScore();
    const firstMeasure = score.pages[0].systems[0].measures[0];
    const measures = Array.from({ length: 4 }, (_, measureIndex) => {
      const measure = structuredClone(firstMeasure);
      measure.id = `measure-${measureIndex + 1}`;
      measure.number = measureIndex + 1;
      measure.events.forEach((event, eventIndex) => {
        event.id = `${event.id}-measure-${measureIndex + 1}`;
        event.measure_id = measure.id;
        event.source_anchor = {
          slide: 1,
          x: 150 + measureIndex * 210 + eventIndex * 90,
          y: 105,
        };
      });
      return measure;
    });
    score.pages[0].systems[0].measures = measures;

    const firstChord = makeArrangement().chords[0];
    const arrangement = makeArrangement({
      chords: measures.map((measure, index) => ({
        ...firstChord,
        id: `chord-${index + 1}`,
        measure_id: measure.id,
        symbol: index === 1 ? "E♭maj7(add9)" : firstChord.symbol,
      })),
    });
    const { container } = render(
      <PptScore
        document={document}
        variantIndex={0}
        score={score}
        arrangement={arrangement}
      />,
    );
    const track = container.querySelector('[data-chord-track="0"]');
    const cards = Array.from(
      track?.querySelectorAll<SVGRectElement>(
        "[data-chord-id] > rect",
      ) ?? [],
    );
    const sourceXs = cards.map((card) =>
      Number(card.parentElement?.getAttribute("data-source-x")),
    );
    const cardCenters = cards.map(
      (card) =>
        Number(card.getAttribute("x")) +
        Number(card.getAttribute("width")) / 2,
    );
    const widths = cards.map((card) =>
      Number(card.getAttribute("width")),
    );

    expect(track).toHaveAttribute("data-lane-count", "1");
    expect(cards).toHaveLength(4);
    expect(cardCenters).toEqual(sourceXs);
    expect(widths[0]).toBeLessThan(64);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBe(widths[0]);
  });

  it("关闭教学层后隐藏标记并回收对应轨道高度", () => {
    const document = makeRender();
    const score = makeScore();
    score.pages[0].systems[0].measures[0].events.forEach(
      (event, index) => {
        event.source_anchor = {
          slide: 1,
          x: 140 + index * 80,
          y: 105,
        };
      },
    );
    const arrangement = makeArrangement();
    const { container, rerender } = render(
      <PptScore
        document={document}
        variantIndex={0}
        score={score}
        arrangement={arrangement}
      />,
    );
    const visibleHeight = Number(
      container.querySelector("svg")?.getAttribute("viewBox")?.split(" ")[3],
    );

    rerender(
      <PptScore
        document={document}
        variantIndex={0}
        score={score}
        arrangement={arrangement}
        visibility={{
          positions: false,
          fingerings: false,
          noteNames: false,
          chords: false,
          lyrics: false,
        }}
      />,
    );
    const hiddenHeight = Number(
      container.querySelector("svg")?.getAttribute("viewBox")?.split(" ")[3],
    );

    expect(
      container.querySelector('[data-layer="positions"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-layer="fingerings"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-layer="note-names"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-layer="chords"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-render-role="lyric"]'),
    ).not.toBeInTheDocument();
    expect(hiddenHeight).toBeLessThan(visibleHeight);
  });

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
