import {
  makeArrangement,
  makeHymn,
  makeScore,
} from "@/test/scoreFixtures";
import { createHymnGuidance } from "./guidance";

describe("createHymnGuidance", () => {
  it("从 Score 与 Arrangement 生成逐曲教学摘要", () => {
    const guidance = createHymnGuidance(makeHymn(), {
      status: "structured",
      score: makeScore(),
      arrangement: makeArrangement(),
    });

    expect(guidance).toMatchObject({
      hymn_key: "1",
      status: "auto_candidate",
      available: true,
      key_signature: "E♭",
      meter: "6/8",
      melody_range: {
        lowest: "1",
        highest: "5̇",
      },
      stats: {
        note_count: 2,
        fingering_count: 2,
        position_count: 1,
        chord_count: 1,
      },
    });
    expect(guidance.positions[0].label).toBe("E♭ Position");
    expect(guidance.chords[0]).toMatchObject({ symbol: "E♭", function: "I" });
  });

  it("字体回退图片时仍可使用已加载的结构化教学数据", () => {
    const guidance = createHymnGuidance(makeHymn(), {
      status: "image",
      reason: "SimpMusic 字体不可用。",
      score: makeScore(),
      arrangement: makeArrangement(),
    });

    expect(guidance.available).toBe(true);
    expect(guidance.stats.fingering_count).toBe(2);
  });

  it("[defect-probing] 第二调永不复用原调结构化方案", () => {
    const guidance = createHymnGuidance(
      makeHymn({
        key: "118b",
        number: 118,
        variant: "b",
        is_alternate_tune: true,
        score_source: "image",
      }),
      {
        status: "structured",
        score: makeScore({ hymn_key: "118" }),
        arrangement: makeArrangement({ hymn_key: "118" }),
      },
    );

    expect(guidance).toMatchObject({
      hymn_key: "118b",
      status: "unavailable",
      available: false,
    });
    expect(guidance.fallback_reason).toContain("第二调不复用原调");
    expect(guidance.chords).toEqual([]);
  });
});
