import { render, screen } from "@testing-library/react";
import type { ServiceSetItem } from "@/features/progress/types";
import {
  makeArrangement,
  makeHymn,
  makeScore,
} from "@/test/scoreFixtures";
import { ServiceSimulation } from "./ServiceSimulation";

const { useHymnAssetsMock } = vi.hoisted(() => ({
  useHymnAssetsMock: vi.fn(),
}));

vi.mock("@/hooks/useHymnAssets", () => ({
  useHymnAssets: useHymnAssetsMock,
}));

describe("ServiceSimulation", () => {
  it("[defect-probing] 为当前曲目按需加载并渲染结构化谱面", () => {
    const hymn = makeHymn();
    const item: ServiceSetItem = {
      id: "item-1",
      hymn_key: hymn.key,
      position: 0,
      practice_key: "E♭",
      bpm: 72,
      count_in: "四拍",
      transition_note: "",
    };
    useHymnAssetsMock.mockReturnValue({
      assets: {
        status: "structured",
        score: makeScore(),
        arrangement: makeArrangement(),
      },
      retry: vi.fn(),
      useImageFallback: vi.fn(),
    });

    render(
      <ServiceSimulation
        items={[item]}
        hymnsByKey={new Map([[hymn.key, hymn]])}
        onClose={vi.fn()}
      />,
    );

    expect(useHymnAssetsMock).toHaveBeenCalledWith(hymn);
    expect(
      screen.getByRole("img", { name: /第 1 首《至大医生现今可近》简谱/ }),
    ).toBeInTheDocument();
  });
});
