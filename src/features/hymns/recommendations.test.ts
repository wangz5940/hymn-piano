import { hymnCatalog } from "@/data/hymns.generated";
import type { HymnCatalogItem } from "./types";
import {
  buildLearningPath,
  keySignatureLabel,
  learningStageFor,
  positionChangeLabel,
} from "./recommendations";

function hymn(
  keySignature: string | null,
  meter: string | null,
  positionChangeCount: number | null,
  overrides: Partial<HymnCatalogItem> = {},
): HymnCatalogItem {
  return {
    key: "999",
    number: 999,
    variant: "",
    title: "分级测试",
    filename: "999 分级测试.jpg",
    image_url: "/歌谱/999.jpg",
    is_alternate_tune: false,
    score_source: "pptx",
    key_signature: keySignature,
    meter,
    position_change_count: positionChangeCount,
    ...overrides,
  };
}

describe("诗歌学习曲线", () => {
  it("按 C 调、拍号和换位次数依次分入七个阶段", () => {
    expect(learningStageFor(hymn("C", "4/4", 0))).toBe(
      "c-four-four-foundation",
    );
    expect(learningStageFor(hymn("C", "4/4", 2))).toBe(
      "c-four-four-foundation",
    );
    expect(learningStageFor(hymn("C", "4/4", 3))).toBe(
      "c-four-four-shifts",
    );
    expect(learningStageFor(hymn("C", "3/4", 4))).toBe(
      "c-meter-variety",
    );
    expect(learningStageFor(hymn("C", "4/4", 5))).toBe(
      "c-advanced-shifts",
    );
    expect(learningStageFor(hymn("G", "4/4", 2))).toBe(
      "new-key-stable",
    );
    expect(learningStageFor(hymn("F", "3/4", 4))).toBe(
      "new-key-shifts",
    );
    expect(learningStageFor(hymn("D", "4/4", 5))).toBe(
      "new-key-advanced",
    );
  });

  it("不把第二调、图片回退或元数据不完整曲目混入推荐", () => {
    expect(
      learningStageFor(hymn("C", "4/4", 0, { variant: "b" })),
    ).toBeNull();
    expect(
      learningStageFor(
        hymn("C", "4/4", 0, { score_source: "image" }),
      ),
    ).toBeNull();
    expect(learningStageFor(hymn(null, "4/4", 0))).toBeNull();
    expect(learningStageFor(hymn("C", null, 0))).toBeNull();
    expect(learningStageFor(hymn("C", "4/4", null))).toBeNull();
  });

  it("相同阶段优先邻近调、较少换位和 4/4 拍", () => {
    const path = buildLearningPath([
      hymn("D", "4/4", 1, { key: "1", number: 1 }),
      hymn("G", "3/4", 2, { key: "9", number: 9 }),
      hymn("G", "4/4", 2, { key: "8", number: 8 }),
      hymn("G", "4/4", 0, { key: "7", number: 7 }),
    ]);
    const stage = path.find((item) => item.id === "new-key-stable");

    expect(stage?.hymns.map((item) => item.key)).toEqual([
      "7",
      "8",
      "9",
      "1",
    ]);
  });

  it("全量目录的推荐分组互斥且覆盖 651 首元数据完整曲目", () => {
    const path = buildLearningPath(hymnCatalog);
    const recommended = path.flatMap((stage) => stage.hymns);
    const keys = new Set(recommended.map((item) => item.key));

    expect(path.map((stage) => stage.hymns.length)).toEqual([
      11, 12, 10, 32, 201, 165, 220,
    ]);
    expect(recommended).toHaveLength(651);
    expect(keys.size).toBe(recommended.length);
  });

  it("生成面向初学者的调性和换位文案", () => {
    expect(keySignatureLabel("C")).toBe("C 大调");
    expect(positionChangeLabel(0)).toBe("固定手位");
    expect(positionChangeLabel(3)).toBe("3 次换位");
  });
});
