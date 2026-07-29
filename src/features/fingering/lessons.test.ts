import {
  crossRoadDemo,
  fingeringPrinciples,
  fingeringWorkflow,
} from "./lessons";

describe("指法与手位课程数据", () => {
  it("包含五条核心原则和五步分析法", () => {
    expect(fingeringPrinciples).toHaveLength(5);
    expect(fingeringWorkflow.map((step) => step.title)).toEqual([
      "看调性",
      "看音域",
      "看旋律走向",
      "看和弦",
      "看下一句",
    ]);
  });

  it("十架窄路示范课覆盖 D 大调右手手位和左手和弦", () => {
    expect(crossRoadDemo.key_signature).toContain("D 大调");
    expect(crossRoadDemo.right_hand_position).toHaveLength(8);
    expect(crossRoadDemo.left_hand_chords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "A7",
          fingering: "5-3-2-1",
        }),
        expect.objectContaining({
          symbol: "D",
          fingering: "5-3-1",
        }),
      ]),
    );
    expect(crossRoadDemo.phrases[1].right_hand).toContain("3-5-4-1-3-4");
  });
});
