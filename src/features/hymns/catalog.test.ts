import { hymnCatalog } from "@/data/hymns.generated";
import {
  groupHymnVariants,
  parseHymnFilename,
  searchHymns,
} from "./catalog";
import { validateCatalogEntry } from "@/features/score/contracts";

describe("诗歌曲库", () => {
  it("解析基础版本和第二调版本", () => {
    expect(parseHymnFilename("1 至大医生现今可近.jpg")).toMatchObject({
      number: 1,
      variant: "",
      title: "至大医生现今可近",
      is_alternate_tune: false,
    });
    expect(
      parseHymnFilename("118b 神的儿子亲爱救主(第二调).jpg"),
    ).toMatchObject({
      number: 118,
      variant: "b",
      title: "神的儿子亲爱救主",
      is_alternate_tune: true,
    });
  });

  it("拒绝不符合契约的文件名", () => {
    expect(() => parseHymnFilename("没有编号.jpg")).toThrow(
      "无法解析歌谱文件名",
    );
  });

  it("覆盖全部本地歌谱资产", () => {
    expect(hymnCatalog).toHaveLength(747);
    expect(hymnCatalog.filter((hymn) => hymn.variant === "")).toHaveLength(
      712,
    );
    expect(
      hymnCatalog.filter((hymn) => hymn.is_alternate_tune),
    ).toHaveLength(35);
    expect(hymnCatalog.at(0)?.number).toBe(1);
    expect(hymnCatalog.at(-1)?.number).toBe(712);
  });

  it("可按编号、变体和标题检索", () => {
    expect(searchHymns(hymnCatalog, "118")).toHaveLength(2);
    expect(searchHymns(hymnCatalog, "118b")).toHaveLength(1);
    expect(searchHymns(hymnCatalog, "神的儿子亲爱救主")).toHaveLength(2);
  });

  it("把原调和第二调归到同一编号", () => {
    expect(groupHymnVariants(hymnCatalog).get(118)).toHaveLength(2);
  });

  it("709 首结构化目录项和 38 个图片回退项严格隔离", () => {
    const structured = hymnCatalog.filter(
      (hymn) => hymn.score_source === "pptx",
    );
    const imageFallbacks = hymnCatalog.filter(
      (hymn) => hymn.score_source === "image",
    );

    expect(structured).toHaveLength(709);
    expect(imageFallbacks).toHaveLength(38);
    expect(
      structured.every(
        (hymn) =>
          hymn.score_asset_url ===
            `/materials/hymns/${hymn.key}/score.json` &&
          hymn.arrangement_asset_url ===
            `/materials/hymns/${hymn.key}/arrangement.json` &&
          hymn.render_asset_url ===
            `/materials/hymns/${hymn.key}/render.json` &&
          hymn.render_schema === "shiqin-render/v1" &&
          hymn.render_variant === 0 &&
          hymn.fallback_reason === null,
      ),
    ).toBe(true);
    expect(
      imageFallbacks.every(
        (hymn) =>
          hymn.score_asset_url === null &&
          hymn.arrangement_asset_url === null &&
          Boolean(hymn.fallback_reason),
      ),
    ).toBe(true);
    expect(
      hymnCatalog.flatMap((hymn) =>
        validateCatalogEntry({
          hymn_key: hymn.key,
          score_source: hymn.score_source,
          score_schema: hymn.score_schema,
          arrangement_schema: hymn.arrangement_schema,
          score_asset_url: hymn.score_asset_url,
          arrangement_asset_url: hymn.arrangement_asset_url,
          image_url: hymn.image_url,
          fallback_reason: hymn.fallback_reason,
        }),
      ),
    ).toEqual([]);
  });

  it("060、063、444 和全部第二调都不继承原调结构化资产", () => {
    for (const key of ["60", "63", "444"]) {
      expect(hymnCatalog.find((hymn) => hymn.key === key)).toMatchObject({
        score_source: "image",
        score_asset_url: null,
        arrangement_asset_url: null,
        fallback_reason: expect.stringContaining("SimpMusic Base"),
      });
    }
    const alternateTunes = hymnCatalog.filter(
      (hymn) => hymn.is_alternate_tune,
    );
    expect(alternateTunes).toHaveLength(35);
    expect(
      alternateTunes.every(
        (hymn) =>
          hymn.score_source === "image" &&
          hymn.score_asset_url === null &&
          hymn.arrangement_asset_url === null &&
          hymn.render_schema === "shiqin-render/v1" &&
          hymn.render_asset_url ===
            `/materials/hymns/${hymn.number}/render.json` &&
          hymn.render_variant === 1 &&
          hymn.fallback_reason?.includes("第二调"),
      ),
    ).toBe(true);
    expect(hymnCatalog.find((hymn) => hymn.key === "118b")).toMatchObject({
      score_asset_url: null,
      arrangement_asset_url: null,
      render_asset_url: "/materials/hymns/118/render.json",
      render_variant: 1,
    });
  });
});
