import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  makeArrangement,
  makeHymn,
  makeRender,
  makeScore,
} from "@/test/scoreFixtures";
import { HymnPreparationGuide } from "./HymnPreparationGuide";

describe("HymnPreparationGuide", () => {
  it("[defect-probing] 默认折叠逐音指法，并按谱行显示音符、手指和理由", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HymnPreparationGuide
        hymn={makeHymn()}
        assets={{
          status: "structured",
          score: makeScore(),
          arrangement: makeArrangement(),
        }}
      />,
    );

    const details = screen.getByText("第 1 谱行 · 2 个音符").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(
      container.querySelector('[data-event-id="note-1"]'),
    ).toBeInTheDocument();

    await user.click(screen.getByText("第 1 谱行 · 2 个音符"));

    const firstNote = container.querySelector('[data-event-id="note-1"]');
    expect(firstNote).toHaveTextContent("1");
    expect(firstNote).toHaveTextContent("E♭4");
    expect(firstNote).toHaveTextContent("1 指");
    expect(firstNote).toHaveTextContent("主音用 1 指建立手位。");

    const secondNote = container.querySelector('[data-event-id="note-2"]');
    expect(secondNote).toHaveTextContent("5̇");
    expect(secondNote).toHaveTextContent("B♭5");
    expect(secondNote).toHaveTextContent("5 指");
    expect(secondNote).toHaveTextContent("高音 5 用 5 指。");
  });

  it("第二调原版谱不复用原调逐音指法明细", () => {
    render(
      <HymnPreparationGuide
        hymn={makeHymn({
          key: "118b",
          number: 118,
          variant: "b",
          is_alternate_tune: true,
          score_source: "image",
          score_schema: null,
          arrangement_schema: null,
          score_asset_url: null,
          arrangement_asset_url: null,
          render_asset_url: "/materials/hymns/118/render.json",
          render_variant: 1,
          fallback_reason: "第二调暂无独立 SimpMusic PPTX。",
        })}
        assets={{
          status: "faithful",
          render: makeRender({ hymn_key: "118" }),
          renderVariant: 1,
          score: makeScore({ hymn_key: "118" }),
          arrangement: makeArrangement({ hymn_key: "118" }),
          reason: null,
        }}
      />,
    );

    expect(screen.getByText("结构化教学不可用")).toBeInTheDocument();
    expect(screen.getByText("PPT 原版谱")).toBeInTheDocument();
    expect(screen.getByText("当前显示 PPT 原版谱面")).toBeInTheDocument();
    expect(screen.queryByText("逐音指法明细")).not.toBeInTheDocument();
    expect(document.querySelector("[data-event-id]")).not.toBeInTheDocument();
  });
});
