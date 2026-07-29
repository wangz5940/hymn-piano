import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeArrangement,
  makeHymn,
  makeRender,
  makeScore,
} from "@/test/scoreFixtures";
import type { HymnAssets } from "@/features/score/loadHymnAssets";
import { ScoreViewer } from "./ScoreViewer";

function structuredAssets(): HymnAssets {
  const score = makeScore();
  const events = score.pages[0].systems[0].measures[0].events;
  events[0].source_anchor = { slide: 1, x: 140, y: 105 };
  events[1].source_anchor = { slide: 1, x: 240, y: 105 };
  events[2].source_anchor = { slide: 1, x: 300, y: 105 };
  const arrangement = makeArrangement();
  arrangement.chords[0].display_default = true;
  return {
    status: "structured",
    score,
    arrangement,
    render: makeRender(),
    renderVariant: 0,
  } as unknown as HymnAssets;
}

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
