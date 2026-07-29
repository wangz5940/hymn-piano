import {
  SIMPMUSIC_BROWSER_FONT_PROBES,
  checkSimpMusicFontAvailability,
  decideScoreRenderMode,
} from "./fontAvailability";
import type {
  FontFaceSetLike,
  FontMetricsMeasurer,
  FontMetricsSignature,
} from "./fontAvailability";

function fontSet(
  availableFamilies: readonly string[],
  ready: Promise<unknown> = Promise.resolve(),
  failedLoads: readonly string[] = [],
): FontFaceSetLike {
  return {
    ready,
    check: (font) =>
      availableFamilies.some((family) => font.includes(`"${family}"`)),
    load: async (font) => {
      if (failedLoads.some((family) => font.includes(`"${family}"`))) {
        throw new Error(`failed to load ${font}`);
      }
      return [];
    },
  };
}

const fallbackMetrics: FontMetricsSignature = {
  width: 40,
  actualBoundingBoxLeft: 0,
  actualBoundingBoxRight: 40,
  actualBoundingBoxAscent: 12,
  actualBoundingBoxDescent: 3,
};

function metrics(
  availableFamilies: readonly string[],
): FontMetricsMeasurer {
  return (font) => {
    if (
      availableFamilies.includes("SimpMusic Base") &&
      font.includes('"SimpMusic Base"')
    ) {
      return {
        ...fallbackMetrics,
        width: 67,
        actualBoundingBoxRight: 66,
        actualBoundingBoxAscent: 19,
      };
    }
    if (
      availableFamilies.includes("SimpMusic Accent") &&
      font.includes('"SimpMusic Accent"')
    ) {
      return {
        ...fallbackMetrics,
        width: 53,
        actualBoundingBoxLeft: 2,
        actualBoundingBoxRight: 51,
      };
    }
    return fallbackMetrics;
  };
}

describe("SimpMusic 浏览器字体决策", () => {
  it("Base 与 Accent 都可用时选择结构化 SVG", async () => {
    await expect(
      decideScoreRenderMode({
        scoreSource: "pptx",
        fontSet: fontSet(["SimpMusic Base", "SimpMusic Accent"]),
        measureText: metrics(["SimpMusic Base", "SimpMusic Accent"]),
      }),
    ).resolves.toEqual({
      mode: "structured",
      reason: null,
      missingFamilies: [],
    });
  });

  it("仅部分字体可用时回退图片并列出缺失字体", async () => {
    await expect(
      decideScoreRenderMode({
        scoreSource: "pptx",
        fontSet: fontSet(["SimpMusic Base"]),
        measureText: metrics(["SimpMusic Base"]),
      }),
    ).resolves.toMatchObject({
      mode: "image",
      missingFamilies: ["SimpMusic Accent"],
    });
  });

  it("document.fonts 不可用或 ready 拒绝时稳定回退", async () => {
    await expect(checkSimpMusicFontAvailability(null)).resolves.toEqual({
      available: false,
      missingFamilies: ["SimpMusic Base", "SimpMusic Accent"],
    });
    await expect(
      checkSimpMusicFontAvailability(
        fontSet(
          ["SimpMusic Base", "SimpMusic Accent"],
          Promise.reject(new Error("font loading failed")),
        ),
        undefined,
        metrics(["SimpMusic Base", "SimpMusic Accent"]),
      ),
    ).resolves.toEqual({
      available: false,
      missingFamilies: ["SimpMusic Base", "SimpMusic Accent"],
    });
  });

  it("图片来源不检查字体并保留数据层回退原因", async () => {
    const check = vi.fn(() => {
      throw new Error("不应检查");
    });

    await expect(
      decideScoreRenderMode({
        scoreSource: "image",
        fallbackReason: "第二调没有独立 PPTX",
        fontSet: { check },
      }),
    ).resolves.toEqual({
      mode: "image",
      reason: "第二调没有独立 PPTX",
      missingFamilies: [],
    });
    expect(check).not.toHaveBeenCalled();
  });

  it("可按曲目只要求 Base 字体", async () => {
    await expect(
      decideScoreRenderMode({
        scoreSource: "pptx",
        fontSet: fontSet(["SimpMusic Base"]),
        requiredFamilies: ["SimpMusic Base"],
        measureText: metrics(["SimpMusic Base"]),
      }),
    ).resolves.toMatchObject({ mode: "structured" });
  });

  it("[defect-probing] fallback 对所有 check 返回 true但字形度量相同时仍回退图片", async () => {
    const fallbackOnly: FontFaceSetLike = {
      ready: Promise.resolve(),
      check: () => true,
      load: async () => [],
    };

    await expect(
      checkSimpMusicFontAvailability(
        fallbackOnly,
        undefined,
        () => fallbackMetrics,
      ),
    ).resolves.toEqual({
      available: false,
      missingFamilies: ["SimpMusic Base", "SimpMusic Accent"],
    });
  });

  it("目标字体度量与 fallback 不同时选择结构化模式", async () => {
    const available = ["SimpMusic Base", "SimpMusic Accent"] as const;

    await expect(
      checkSimpMusicFontAvailability(
        fontSet(available),
        undefined,
        metrics(available),
      ),
    ).resolves.toMatchObject({ available: true });
  });

  it("任一字体 load 失败时回退图片并报告该字体", async () => {
    const available = ["SimpMusic Base", "SimpMusic Accent"] as const;

    await expect(
      checkSimpMusicFontAvailability(
        fontSet(available, Promise.resolve(), ["SimpMusic Accent"]),
        undefined,
        metrics(available),
      ),
    ).resolves.toEqual({
      available: false,
      missingFamilies: ["SimpMusic Accent"],
    });
  });

  it("没有 Canvas 字形度量能力时保守回退图片", async () => {
    const available = ["SimpMusic Base", "SimpMusic Accent"] as const;

    await expect(
      checkSimpMusicFontAvailability(fontSet(available), undefined, null),
    ).resolves.toEqual({
      available: false,
      missingFamilies: ["SimpMusic Base", "SimpMusic Accent"],
    });
  });

  it("Base 与 Accent 分别使用多字符私用区探针完成 load 和度量", async () => {
    const check = vi.fn(() => true);
    const load = vi.fn(async () => []);
    const measureText = vi.fn(metrics(["SimpMusic Base", "SimpMusic Accent"]));

    await expect(
      checkSimpMusicFontAvailability(
        { ready: Promise.resolve(), check, load },
        undefined,
        measureText,
      ),
    ).resolves.toMatchObject({ available: true });

    expect(check).toHaveBeenCalledWith(
      '16px "SimpMusic Base"',
      SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Base"],
    );
    expect(check).toHaveBeenCalledWith(
      '16px "SimpMusic Accent"',
      SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Accent"],
    );
    expect(load).toHaveBeenCalledWith(
      '16px "SimpMusic Base"',
      SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Base"],
    );
    expect(load).toHaveBeenCalledWith(
      '16px "SimpMusic Accent"',
      SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Accent"],
    );
    expect(measureText).toHaveBeenCalledWith(
      '16px "SimpMusic Base"',
      SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Base"],
    );
    expect(measureText).toHaveBeenCalledWith(
      expect.stringContaining("__shiqin_missing_SimpMusic_Base__"),
      SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Base"],
    );
    expect(measureText).toHaveBeenCalledWith(
      '16px "SimpMusic Accent"',
      SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Accent"],
    );
    expect(measureText).toHaveBeenCalledWith(
      expect.stringContaining("__shiqin_missing_SimpMusic_Accent__"),
      SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Accent"],
    );
  });

  it("[defect-probing] 使用 PPTX 真实 ASCII 字符探针，避免 Symbol 私用区误判", () => {
    expect(SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Base"]).toContain("1234567");
    expect(SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Base"]).toContain("qwertyu");
    expect(SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Base"]).not.toContain("\uF086");
    expect(SIMPMUSIC_BROWSER_FONT_PROBES["SimpMusic Accent"]).toBe("-zc3cZ");
  });
});
