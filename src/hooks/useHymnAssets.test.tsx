import { act, renderHook, waitFor } from "@testing-library/react";
import type { HymnAssets } from "@/features/score/loadHymnAssets";
import {
  availableFontSet,
  makeArrangement,
  makeHymn,
  makeScore,
} from "@/test/scoreFixtures";

const loadHymnAssetsMock = vi.fn();

vi.mock("@/features/score/loadHymnAssets", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/score/loadHymnAssets")>();
  return {
    ...actual,
    loadHymnAssets: (...args: unknown[]) => loadHymnAssetsMock(...args),
  };
});

import { useHymnAssets } from "./useHymnAssets";

const structured: HymnAssets = {
  status: "structured",
  score: makeScore(),
  arrangement: makeArrangement(),
};

describe("useHymnAssets", () => {
  beforeEach(() => {
    loadHymnAssetsMock.mockReset();
  });

  it("图片曲目直接进入回退状态且不加载 JSON", () => {
    const hymn = makeHymn({
      score_source: "image",
      render_schema: null,
      render_asset_url: null,
      render_variant: null,
      fallback_reason: "PPTX 无结构化 SimpMusic 谱面。",
    });
    const { result } = renderHook(() => useHymnAssets(hymn));

    expect(result.current.assets).toEqual({
      status: "image",
      reason: "PPTX 无结构化 SimpMusic 谱面。",
    });
    expect(loadHymnAssetsMock).not.toHaveBeenCalled();
  });

  it("加载失败后可重试并进入结构化状态", async () => {
    loadHymnAssetsMock
      .mockRejectedValueOnce(new Error("网络失败"))
      .mockResolvedValueOnce(structured);
    const fontSet = availableFontSet();
    const hymn = makeHymn();
    const { result } = renderHook(() =>
      useHymnAssets(hymn, { fontSet }),
    );

    await waitFor(() =>
      expect(result.current.assets).toEqual({
        status: "error",
        message: "网络失败",
      }),
    );
    act(() => result.current.retry());
    await waitFor(() =>
      expect(result.current.assets.status).toBe("structured"),
    );
    expect(loadHymnAssetsMock).toHaveBeenCalledTimes(2);
  });

  it("加载失败后允许手动切换同版本图片", async () => {
    loadHymnAssetsMock.mockRejectedValue(new Error("schema 错误"));
    const hymn = makeHymn();
    const { result } = renderHook(() => useHymnAssets(hymn));

    await waitFor(() => expect(result.current.assets.status).toBe("error"));
    act(() => result.current.useImageFallback());
    expect(result.current.assets).toMatchObject({
      status: "image",
      reason: expect.stringContaining("schema 错误"),
    });
  });

  it("切换曲目会中止旧请求且旧结果不能覆盖新曲目", async () => {
    const resolvers = new Map<string, (value: HymnAssets) => void>();
    const signals = new Map<string, AbortSignal>();
    loadHymnAssetsMock.mockImplementation(
      (
        hymn: ReturnType<typeof makeHymn>,
        options: { signal: AbortSignal },
      ) =>
        new Promise<HymnAssets>((resolve) => {
          resolvers.set(hymn.key, resolve);
          signals.set(hymn.key, options.signal);
        }),
    );
    const first = makeHymn();
    const secondScore = makeScore({ hymn_key: "2", title: "第二首" });
    const secondArrangement = makeArrangement({
      hymn_key: "2",
      score_hash: secondScore.content_hash,
    });
    const second = makeHymn({
      key: "2",
      number: 2,
      title: "第二首",
      score_asset_url: "/materials/hymns/2/score.json",
      arrangement_asset_url: "/materials/hymns/2/arrangement.json",
    });
    const { result, rerender } = renderHook(
      ({ hymn }) => useHymnAssets(hymn),
      { initialProps: { hymn: first } },
    );

    rerender({ hymn: second });
    expect(signals.get("1")?.aborted).toBe(true);
    act(() =>
      resolvers.get("2")?.({
        status: "structured",
        score: secondScore,
        arrangement: secondArrangement,
      }),
    );
    await waitFor(() =>
      expect(
        result.current.assets.status === "structured"
          ? result.current.assets.score.hymn_key
          : "",
      ).toBe("2"),
    );
    act(() => resolvers.get("1")?.(structured));
    expect(
      result.current.assets.status === "structured"
        ? result.current.assets.score.hymn_key
        : "",
    ).toBe("2");
  });
});
