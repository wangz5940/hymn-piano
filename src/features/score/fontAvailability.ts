export const SIMPMUSIC_BROWSER_FAMILIES = [
  "SimpMusic Base",
  "SimpMusic Accent",
] as const;

declare const __SIMPMUSIC_LOCAL_FONTS_AVAILABLE__: boolean | undefined;

export type SimpMusicBrowserFamily =
  (typeof SIMPMUSIC_BROWSER_FAMILIES)[number];

export const SIMPMUSIC_BROWSER_FONT_PROBES: Readonly<
  Record<SimpMusicBrowserFamily, string>
> = {
  "SimpMusic Base": "1234567qwertyuL\":[]\\–",
  "SimpMusic Accent": "-zc3cZ",
};

export interface FontFaceSetLike {
  check(font: string, text?: string): boolean;
  load?(font: string, text?: string): PromiseLike<readonly unknown[]>;
  ready?: Promise<unknown>;
}

export interface FontMetricsSignature {
  width: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}

export type FontMetricsMeasurer = (
  font: string,
  text: string,
) => FontMetricsSignature | null;

export type ScoreRenderDecision =
  | {
      mode: "structured";
      reason: null;
      missingFamilies: [];
    }
  | {
      mode: "image";
      reason: string;
      missingFamilies: SimpMusicBrowserFamily[];
    };

function browserFontSet(): FontFaceSetLike | null {
  if (typeof document === "undefined" || !document.fonts) return null;
  return document.fonts;
}

function buildTimeLocalFontsAvailable(): boolean {
  return (
    typeof __SIMPMUSIC_LOCAL_FONTS_AVAILABLE__ !== "undefined" &&
    __SIMPMUSIC_LOCAL_FONTS_AVAILABLE__
  );
}

function quotedFamily(family: string): string {
  return `16px "${family}"`;
}

function missingControlFamily(family: SimpMusicBrowserFamily): string {
  return `__shiqin_missing_${family.replace(/\s+/gu, "_")}__`;
}

function finiteMetric(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function browserFontMetricsMeasurer(): FontMetricsMeasurer | null {
  if (typeof document === "undefined") return null;
  try {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return null;
    return (font, text) => {
      context.font = font;
      const metrics = context.measureText(text);
      return {
        width: finiteMetric(metrics.width),
        actualBoundingBoxLeft: finiteMetric(metrics.actualBoundingBoxLeft),
        actualBoundingBoxRight: finiteMetric(metrics.actualBoundingBoxRight),
        actualBoundingBoxAscent: finiteMetric(metrics.actualBoundingBoxAscent),
        actualBoundingBoxDescent: finiteMetric(metrics.actualBoundingBoxDescent),
      };
    };
  } catch {
    return null;
  }
}

function metricsAreDistinct(
  target: FontMetricsSignature,
  fallback: FontMetricsSignature,
): boolean {
  const fields: Array<keyof FontMetricsSignature> = [
    "width",
    "actualBoundingBoxLeft",
    "actualBoundingBoxRight",
    "actualBoundingBoxAscent",
    "actualBoundingBoxDescent",
  ];
  return fields.some(
    (field) => Math.abs(target[field] - fallback[field]) > 0.1,
  );
}

async function hasDistinctFontFace(
  fontSet: FontFaceSetLike,
  family: SimpMusicBrowserFamily,
  measureText: FontMetricsMeasurer,
): Promise<boolean> {
  const probe = SIMPMUSIC_BROWSER_FONT_PROBES[family];
  const targetFont = quotedFamily(family);
  const targetAvailable = fontSet.check(targetFont, probe);
  if (!targetAvailable) return false;

  try {
    await fontSet.load?.(targetFont, probe);
  } catch {
    return false;
  }

  const targetMetrics = measureText(targetFont, probe);
  const fallbackMetrics = measureText(
    quotedFamily(missingControlFamily(family)),
    probe,
  );
  return Boolean(
    targetMetrics &&
      fallbackMetrics &&
      metricsAreDistinct(targetMetrics, fallbackMetrics),
  );
}

export async function checkSimpMusicFontAvailability(
  fontSet?: FontFaceSetLike | null,
  requiredFamilies: readonly SimpMusicBrowserFamily[] =
    SIMPMUSIC_BROWSER_FAMILIES,
  measureText?: FontMetricsMeasurer | null,
): Promise<{
  available: boolean;
  missingFamilies: SimpMusicBrowserFamily[];
}> {
  if (
    fontSet === undefined &&
    measureText === undefined &&
    buildTimeLocalFontsAvailable()
  ) {
    return { available: true, missingFamilies: [] };
  }

  const resolvedFontSet = fontSet === undefined ? browserFontSet() : fontSet;

  if (!resolvedFontSet) {
    return {
      available: false,
      missingFamilies: [...requiredFamilies],
    };
  }

  try {
    await resolvedFontSet.ready;
    const checkResults = requiredFamilies.map((family) =>
      resolvedFontSet.check(
        quotedFamily(family),
        SIMPMUSIC_BROWSER_FONT_PROBES[family],
      ),
    );
    if (checkResults.every((available) => !available)) {
      return {
        available: false,
        missingFamilies: [...requiredFamilies],
      };
    }
    const measurer =
      measureText === undefined ? browserFontMetricsMeasurer() : measureText;
    if (!measurer) {
      return {
        available: false,
        missingFamilies: [...requiredFamilies],
      };
    }
    const availability = await Promise.all(
      requiredFamilies.map((family, index) =>
        checkResults[index]
          ? hasDistinctFontFace(resolvedFontSet, family, measurer)
          : false,
      ),
    );
    const missingFamilies = requiredFamilies.filter(
      (_, index) => !availability[index],
    );
    return {
      available: missingFamilies.length === 0,
      missingFamilies,
    };
  } catch {
    return {
      available: false,
      missingFamilies: [...requiredFamilies],
    };
  }
}

export async function decideScoreRenderMode(options: {
  scoreSource: "pptx" | "image";
  fallbackReason?: string | null;
  fontSet?: FontFaceSetLike | null;
  requiredFamilies?: readonly SimpMusicBrowserFamily[];
  measureText?: FontMetricsMeasurer | null;
}): Promise<ScoreRenderDecision> {
  if (options.scoreSource === "image") {
    return {
      mode: "image",
      reason: options.fallbackReason ?? "该曲目仅提供图片谱。",
      missingFamilies: [],
    };
  }

  const result = await checkSimpMusicFontAvailability(
    options.fontSet,
    options.requiredFamilies,
    options.measureText,
  );
  if (result.available) {
    return {
      mode: "structured",
      reason: null,
      missingFamilies: [],
    };
  }

  return {
    mode: "image",
    reason: `SimpMusic 字体不可用：${result.missingFamilies.join("、")}。`,
    missingFamilies: result.missingFamilies,
  };
}
