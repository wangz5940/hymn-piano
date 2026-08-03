import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeArrangement,
  makeHymn,
  makeRender,
  makeScore,
} from "@/test/scoreFixtures";
import type { HymnAssets } from "@/features/score/loadHymnAssets";
import {
  createDefaultScoreDisplay,
  STORAGE_KEYS,
} from "@/features/progress/storage";
import { useAppStore } from "@/store/useAppStore";
import { ScoreViewer } from "./ScoreViewer";

function structuredAssets(): HymnAssets {
  const score = makeScore();
  const events = score.pages[0].systems[0].measures[0].events;
  events[0].source_anchor = { slide: 1, x: 140, y: 105 };
  events[1].source_anchor = { slide: 1, x: 240, y: 105 };
  events[2].source_anchor = { slide: 1, x: 300, y: 105 };
  const arrangement = makeArrangement();
  return {
    status: "structured",
    score,
    arrangement,
    render: makeRender(),
    renderVariant: 0,
  } as unknown as HymnAssets;
}

beforeEach(() => {
  useAppStore.setState({
    score_display: createDefaultScoreDisplay(),
    storage_available: true,
  });
});

describe("ScoreViewer", () => {
  it("加载结构化资产时显示明确的歌谱加载状态", () => {
    render(
      <ScoreViewer
        hymn={makeHymn()}
        assets={{ status: "loading" }}
      />,
    );

    expect(screen.getByLabelText("歌谱加载中")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /第 1 首/ }),
    ).not.toBeInTheDocument();
  });

  it("[defect-probing] 结构化资产优先按 PPT 原坐标渲染且只展示第一段", () => {
    const { container } = render(
      <ScoreViewer
        hymn={makeHymn()}
        assets={structuredAssets()}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: /第 1 首《至大医生现今可近》PPT 原版简谱（第一段）/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("第一段歌词")).toBeInTheDocument();
    expect(screen.queryByText("第二段歌词")).not.toBeInTheDocument();
    const metadata = screen.getByLabelText("原曲调性与节拍");
    expect(within(metadata).getByText("1 = E♭")).toBeInTheDocument();
    expect(within(metadata).getByText("6/8 拍")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /第 1 首《至大医生现今可近》简谱/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByAltText(/歌谱/)).not.toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-layer="fingerings"] [data-event-id="note-1"]',
      ),
    ).toHaveTextContent("①");
    expect(
      container.querySelector(
        '[data-layer="positions"] [data-position-id="position-1"]',
      ),
    ).toHaveTextContent("E♭ Position");
    expect(
      container.querySelector(
        '[data-layer="chords"] [data-chord-id="chord-1"]',
      ),
    ).toHaveTextContent("E♭ · I");
    expect(
      container.querySelector(
        '[data-layer="chords"] [data-chord-id="chord-1"]',
      ),
    ).toHaveTextContent("5-3-1");
    expect(
      container.querySelector(
        '[data-layer="chords"] [data-chord-id="chord-1"]',
      ),
    ).toHaveAttribute("data-status", "auto_candidate");
    expect(
      container.querySelector(
        '[data-layer="chords"] [data-chord-id="chord-1"]',
      ),
    ).toHaveTextContent("自动预判");
  });

  it("第二调原版 SVG 按对应 slide 展示和弦教学层", () => {
    const renderDocument = makeRender({ hymn_key: "118" });
    renderDocument.variants.push({
      ...renderDocument.variants[0],
      id: "variant-2",
      index: 1,
      canonical_slide: 5,
      source_slides: [5],
    });
    const score = makeScore({ hymn_key: "118" });
    score.pages[0].systems[0].measures[0].events.forEach(
      (event, index) => {
        event.source_anchor = {
          slide: 5,
          x: 140 + index * 80,
          y: 105,
        };
      },
    );
    const arrangement = makeArrangement({
      hymn_key: "118",
      score_hash: score.content_hash,
    });
    const { container } = render(
      <ScoreViewer
        hymn={makeHymn({
          key: "118b",
          number: 118,
          variant: "b",
          title: "神的儿子亲爱救主",
        })}
        assets={{
          status: "faithful",
          render: renderDocument,
          renderVariant: 1,
          score,
          arrangement,
          reason: null,
        }}
      />,
    );

    expect(
      container.querySelector(
        '[data-layer="chords"] [data-chord-id="chord-1"]',
      ),
    ).toHaveTextContent("E♭ · I");
  });

  it("在设置中切换并持久化手位、指法和和弦显示", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ScoreViewer
        hymn={makeHymn()}
        assets={structuredAssets()}
      />,
    );
    const svg = screen.getByRole("img", { name: /PPT 原版简谱/ });
    const visibleHeight = Number(
      svg.getAttribute("viewBox")?.split(" ")[3],
    );

    const settingsButton = screen.getByRole("button", {
      name: "教学标记设置",
    });
    expect(settingsButton).toHaveTextContent("标记设置");
    await user.click(settingsButton);
    const positions = screen.getByRole("switch", { name: "显示手位" });
    const fingerings = screen.getByRole("switch", { name: "显示指法" });
    const noteNames = screen.getByRole("switch", { name: "显示键位" });
    const chords = screen.getByRole("switch", { name: "显示左手和弦" });
    const lyrics = screen.getByRole("switch", { name: "显示歌词" });

    expect(positions).toBeChecked();
    expect(fingerings).toBeChecked();
    expect(noteNames).toBeChecked();
    expect(chords).toBeChecked();
    expect(lyrics).toBeChecked();

    await user.click(positions);
    await user.click(fingerings);
    await user.click(noteNames);
    await user.click(chords);
    await user.click(lyrics);

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
    expect(
      Number(svg.getAttribute("viewBox")?.split(" ")[3]),
    ).toBeLessThan(visibleHeight);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.scoreDisplay) ?? "{}"),
    ).toEqual({
      positions: false,
      fingerings: false,
      noteNames: false,
      chords: false,
      lyrics: false,
    });
  });

  it("图片来源显示回退原因和同版本图片", () => {
    render(
      <ScoreViewer
        hymn={makeHymn({ key: "60", number: 60, image_url: "/歌谱/60.jpg" })}
        assets={{
          status: "image",
          reason: "PPTX 不含 SimpMusic Base 结构化谱面。",
        }}
      />,
    );

    expect(screen.getByText("PPTX 不含 SimpMusic Base 结构化谱面。")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /第 60 首/ })).toHaveAttribute(
      "src",
      "/歌谱/60.jpg",
    );
  });

  it("加载错误提供重试和图片回退操作", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onUseImageFallback = vi.fn();
    render(
      <ScoreViewer
        hymn={makeHymn()}
        assets={{ status: "error", message: "谱面内容哈希校验失败" }}
        onRetry={onRetry}
        onUseImageFallback={onUseImageFallback}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("谱面内容哈希校验失败");
    await user.click(screen.getByRole("button", { name: "重新加载结构化谱面" }));
    await user.click(screen.getByRole("button", { name: "改用图片谱" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onUseImageFallback).toHaveBeenCalledOnce();
  });

  it("保留缩放、旋转、适合宽度和全屏控制", async () => {
    const user = userEvent.setup();
    const requestFullscreen = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    const { container } = render(
      <ScoreViewer
        hymn={makeHymn()}
        assets={structuredAssets()}
      />,
    );

    const frame = container.querySelector<HTMLElement>(".score-document-frame");
    await user.click(screen.getByRole("button", { name: "放大歌谱" }));
    expect(frame).toHaveStyle({ width: "125%" });
    await user.click(screen.getByRole("button", { name: "顺时针旋转歌谱" }));
    expect(frame).toHaveStyle({ transform: "rotate(90deg)" });
    await user.click(screen.getByRole("button", { name: "适合宽度" }));
    expect(frame).toHaveStyle({ width: "100%" });
    await user.click(screen.getByRole("button", { name: "全屏查看歌谱" }));
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });
});
