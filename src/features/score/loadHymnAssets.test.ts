import {
  availableFontMetrics,
  availableFontSet,
  makeArrangement,
  makeHymn,
  makeRender,
  makeScore,
  TEST_HASH,
} from "@/test/scoreFixtures";
import { loadHymnAssets } from "./loadHymnAssets";

function response(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function fetchDocuments(
  score = makeScore(),
  arrangement = makeArrangement(),
  render = makeRender(),
) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("arrangement")) return response(arrangement);
    if (url.includes("render")) return response(render);
    return response(score);
  });
  return mock as typeof mock & typeof fetch;
}

describe("loadHymnAssets", () => {
  it("图片来源不请求结构化资产", async () => {
    const fetchImpl = vi.fn();
    const result = await loadHymnAssets(
      makeHymn({
        key: "118b",
        variant: "b",
        is_alternate_tune: true,
        score_source: "image",
        score_schema: null,
        arrangement_schema: null,
        render_schema: null,
        score_asset_url: null,
        arrangement_asset_url: null,
        render_asset_url: null,
        render_variant: null,
        fallback_reason: "第二调暂无独立 SimpMusic PPTX。",
      }),
      { fetch: fetchImpl as typeof fetch },
    );

    expect(result).toEqual({
      status: "image",
      reason: "第二调暂无独立 SimpMusic PPTX。",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("存在独立渲染变体的第二调加载对应原版谱与教学资产", async () => {
    const render = makeRender({ hymn_key: "118" });
    render.variants.push({
      ...render.variants[0],
      id: "variant-2",
      index: 1,
      canonical_slide: 5,
      source_slides: [5],
      lyric_versions: [
        {
          ...render.variants[0].lyric_versions[0],
          id: "variant-2-lyrics-slide-5",
          source_slide: 5,
        },
      ],
    });
    const score = makeScore({ hymn_key: "118" });
    const arrangement = makeArrangement({
      hymn_key: "118",
      score_hash: score.content_hash,
    });
    const fetchImpl = fetchDocuments(
      score,
      arrangement,
      render,
    );
    const result = await loadHymnAssets(
      makeHymn({
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
      }),
      {
        fetch: fetchImpl,
        fontSet: availableFontSet(),
        measureText: availableFontMetrics(),
        hashDocument: () => TEST_HASH,
      },
    );

    expect(result).toMatchObject({
      status: "faithful",
      render: { hymn_key: "118" },
      renderVariant: 1,
      score: { hymn_key: "118" },
      arrangement: { hymn_key: "118" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(
      fetchImpl.mock.calls.map(([url]) => String(url)).sort(),
    ).toEqual([
      "/materials/hymns/118/arrangement.json",
      "/materials/hymns/118/render.json",
      "/materials/hymns/118/score.json",
    ]);
  });

  it("[defect-probing] 校验后返回当前曲目的结构化谱面、编配和忠实渲染", async () => {
    const fetchImpl = fetchDocuments();
    const result = await loadHymnAssets(makeHymn(), {
      fetch: fetchImpl,
      fontSet: availableFontSet(),
      measureText: availableFontMetrics(),
      hashDocument: (document) =>
        (document as { content_hash: string }).content_hash,
    });

    expect(result).toMatchObject({
      status: "structured",
      score: { hymn_key: "1", content_hash: TEST_HASH },
      arrangement: { hymn_key: "1", score_hash: TEST_HASH },
      render: { hymn_key: "1", content_hash: TEST_HASH },
      renderVariant: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(
      fetchImpl.mock.calls.map(([url]) => String(url)).sort(),
    ).toEqual([
      "/materials/hymns/1/arrangement.json",
      "/materials/hymns/1/render.json",
      "/materials/hymns/1/score.json",
    ]);
    expect(
      fetchImpl.mock.calls.some(([url]) => /\/(?:2|118)\//u.test(String(url))),
    ).toBe(false);
  });

  it("字体不可用时保留已加载教学数据并降级到图片", async () => {
    const result = await loadHymnAssets(makeHymn(), {
      fetch: fetchDocuments(),
      fontSet: { ready: Promise.resolve(), check: () => false },
      hashDocument: (document) =>
        (document as { content_hash: string }).content_hash,
    });

    expect(result).toMatchObject({
      status: "image",
      reason: expect.stringContaining("SimpMusic 字体不可用"),
      score: { hymn_key: "1" },
      arrangement: { hymn_key: "1" },
    });
  });

  it("网络、schema 和内容哈希失败时给出可操作错误", async () => {
    const networkFetch = vi.fn().mockRejectedValue(new TypeError("offline"));
    await expect(
      loadHymnAssets(makeHymn(), {
        fetch: networkFetch as typeof fetch,
        fontSet: availableFontSet(),
      }),
    ).rejects.toThrow("网络请求错误");

    await expect(
      loadHymnAssets(makeHymn(), {
        fetch: fetchDocuments({ ...makeScore(), schema: "invalid" } as never),
        fontSet: availableFontSet(),
        hashDocument: () => TEST_HASH,
      }),
    ).rejects.toThrow("谱面数据不符合规范");

    await expect(
      loadHymnAssets(makeHymn(), {
        fetch: fetchDocuments(),
        fontSet: availableFontSet(),
        hashDocument: () => "b".repeat(64),
      }),
    ).rejects.toThrow("谱面内容哈希校验失败");
  });

  it("拒绝跨曲目和编配 score_hash 不一致", async () => {
    await expect(
      loadHymnAssets(makeHymn(), {
        fetch: fetchDocuments(makeScore({ hymn_key: "2" })),
        fontSet: availableFontSet(),
        hashDocument: () => TEST_HASH,
      }),
    ).rejects.toThrow("谱面归属校验失败");

    await expect(
      loadHymnAssets(makeHymn(), {
        fetch: fetchDocuments(
          makeScore(),
          makeArrangement({ score_hash: "b".repeat(64) }),
        ),
        fontSet: availableFontSet(),
        measureText: availableFontMetrics(),
        hashDocument: () => TEST_HASH,
      }),
    ).rejects.toThrow("编配数据不符合规范");
  });

  it("[defect-probing] 拒绝跨曲目和内容哈希错误的忠实渲染资产", async () => {
    await expect(
      loadHymnAssets(makeHymn(), {
        fetch: fetchDocuments(
          makeScore(),
          makeArrangement(),
          makeRender({ hymn_key: "2" }),
        ),
        fontSet: availableFontSet(),
        measureText: availableFontMetrics(),
        hashDocument: () => TEST_HASH,
      }),
    ).rejects.toThrow("渲染归属校验失败");

    await expect(
      loadHymnAssets(makeHymn(), {
        fetch: fetchDocuments(),
        fontSet: availableFontSet(),
        measureText: availableFontMetrics(),
        hashDocument: (document) =>
          "generator_version" in (document as object)
            ? "b".repeat(64)
            : TEST_HASH,
      }),
    ).rejects.toThrow("渲染内容哈希校验失败");
  });

  it("[defect-probing] 拒绝歌词和连线中的悬空事件引用", async () => {
    const score = makeScore();
    const system = score.pages[0].systems[0];
    system.lyrics[0].event_ids = ["missing-note"];
    system.measures[0].events.push({
      id: "tie-broken",
      kind: "tie",
      measure_id: "measure-1",
      beat: 0,
      duration: 0,
      from_event_id: "note-1",
      to_event_id: "missing-note",
      raw_glyphs: "-",
      sources: system.measures[0].events[0].sources,
    });

    await expect(
      loadHymnAssets(makeHymn(), {
        fetch: fetchDocuments(score),
        fontSet: availableFontSet(),
        hashDocument: () => TEST_HASH,
      }),
    ).rejects.toThrow("谱面数据不符合规范");
  });
});
