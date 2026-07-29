import type { BBox } from "./contracts";
import type {
  HymnRenderDocument,
  RenderMediaShape,
  RenderParagraph,
  RenderTextRun,
  RenderTextShape,
} from "./render-contracts";

export const POINT_TO_CSS_PX = 96 / 72;

const PAGE_TOP = 24;
const POSITION_TRACK_OFFSET = 4;
const FINGER_TRACK_OFFSET = 48;
const SCORE_TRACK_OFFSET = 78;
const LYRIC_TRACK_GAP = 12;
const ROW_GAP = 24;

export interface LyricLine {
  shape: RenderTextShape;
  paragraph: RenderParagraph;
  sourceY: number;
}

export interface ScoreRowLayout {
  index: number;
  baseY: number;
  sourceCenterY: number;
  positionY: number;
  fingeringY: number;
  scoreY: number;
  lyricY: number;
  lyricBottom: number;
  textShapes: RenderTextShape[];
  mediaShapes: RenderMediaShape[];
  lyricLine?: LyricLine;
}

interface FallbackLyricLayout {
  shape: RenderTextShape;
  bbox: BBox;
}

export interface ScoreReflowLayout {
  rows: ScoreRowLayout[];
  fallbackLyrics: FallbackLyricLayout[];
  contentHeight: number;
}

export function fontSize(
  run: RenderTextRun,
  role: RenderTextShape["role"],
): number {
  if (run.font_size !== null) {
    return Number((run.font_size * POINT_TO_CSS_PX).toFixed(3));
  }
  return role === "lyric" ? 28 : 37.333;
}

function dominantValue<T extends string | number>(
  values: T[],
  fallback: T,
): T {
  const counts = new Map<T, number>();
  let selected = fallback;
  let selectedCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > selectedCount) {
      selected = value;
      selectedCount = count;
    }
  }
  return selected;
}

export function shapeFontSize(shape: RenderTextShape): number {
  const sizes = shape.paragraphs.flatMap((paragraph) =>
    paragraph.runs.map((run) => fontSize(run, shape.role)),
  );
  return dominantValue(
    sizes,
    shape.role === "lyric" ? 28 : 37.333,
  );
}

function paragraphText(paragraph: RenderParagraph): string {
  return paragraph.runs.map((run) => run.text).join("");
}

export function nearestRow(
  rows: ScoreRowLayout[],
  sourceY: number,
): ScoreRowLayout {
  return [...rows].sort(
    (left, right) =>
      Math.abs(left.sourceCenterY - sourceY) -
        Math.abs(right.sourceCenterY - sourceY) ||
      left.index - right.index,
  )[0];
}

function belongsToScoreRow(
  row: ScoreRowLayout,
  shape: RenderTextShape,
): boolean {
  if (Math.abs(shape.bbox.y - row.baseY) <= 20) return true;
  const rowBottom = Math.max(
    ...row.textShapes.map(
      (current) => current.bbox.y + current.bbox.height,
    ),
  );
  const verticalGap = shape.bbox.y - rowBottom;
  const rowLeft = Math.min(
    ...row.textShapes.map((current) => current.bbox.x),
  );
  const rowRight = Math.max(
    ...row.textShapes.map(
      (current) => current.bbox.x + current.bbox.width,
    ),
  );
  const rowWidth = rowRight - rowLeft;
  const widthRatio = shape.bbox.width / rowWidth;
  return (
    verticalGap >= 0 &&
    verticalGap <= 4 &&
    Math.abs(shape.bbox.x - rowLeft) <= 20 &&
    widthRatio >= 0.8 &&
    widthRatio <= 1.25
  );
}

export function buildScoreReflowLayout(
  variant: HymnRenderDocument["variants"][number],
): ScoreReflowLayout {
  const baseShapes = variant.score_shapes
    .filter((shape) => shape.role === "score")
    .sort(
      (left, right) =>
        left.bbox.y - right.bbox.y ||
        left.bbox.x - right.bbox.x ||
        left.id.localeCompare(right.id),
    );
  const rows: ScoreRowLayout[] = [];
  for (const shape of baseShapes) {
    const current = rows.at(-1);
    if (current && belongsToScoreRow(current, shape)) {
      current.textShapes.push(shape);
      current.baseY = Math.min(current.baseY, shape.bbox.y);
      current.sourceCenterY =
        current.textShapes.reduce(
          (sum, item) => sum + item.bbox.y + item.bbox.height / 2,
          0,
        ) / current.textShapes.length;
      continue;
    }
    rows.push({
      index: rows.length,
      baseY: shape.bbox.y,
      sourceCenterY: shape.bbox.y + shape.bbox.height / 2,
      positionY: 0,
      fingeringY: 0,
      scoreY: 0,
      lyricY: 0,
      lyricBottom: 0,
      textShapes: [shape],
      mediaShapes: [],
    });
  }

  if (rows.length === 0) {
    return {
      rows: [],
      fallbackLyrics: [],
      contentHeight: variant.page.height,
    };
  }

  variant.score_shapes
    .filter((shape) => shape.role !== "score")
    .forEach((shape) => {
      nearestRow(
        rows,
        shape.bbox.y + shape.bbox.height / 2,
      ).textShapes.push(shape);
    });
  variant.media_shapes.forEach((shape) => {
    nearestRow(
      rows,
      shape.bbox.y + shape.bbox.height / 2,
    ).mediaShapes.push(shape);
  });

  const lyricShapes =
    variant.lyric_versions[0]?.shapes.filter(
      (shape) => shape.bbox.width > 0 && shape.bbox.height > 0,
    ) ?? [];
  const lyricLines = lyricShapes.flatMap((shape) => {
    const paragraphStep =
      shape.bbox.height / Math.max(1, shape.paragraphs.length);
    return shape.paragraphs.flatMap(
      (paragraph, paragraphIndex): LyricLine[] =>
        paragraphText(paragraph).trim()
          ? [
              {
                shape,
                paragraph,
                sourceY: shape.bbox.y + paragraphIndex * paragraphStep,
              },
            ]
          : [],
    );
  });
  const lyricLinesByRow = rows.map((): LyricLine[] => []);
  for (const line of lyricLines) {
    const row =
      [...rows].reverse().find((candidate) => candidate.baseY <= line.sourceY) ??
      nearestRow(rows, line.sourceY);
    lyricLinesByRow[row.index].push(line);
  }
  const selectedLyricLines = lyricLinesByRow.map((lines) => lines[0]);
  const firstLyricRow = selectedLyricLines.findIndex(
    (line) => line !== undefined,
  );
  const canPairLyrics =
    firstLyricRow >= 0 &&
    selectedLyricLines
      .slice(firstLyricRow)
      .every((line) => line !== undefined);
  let cursorY = PAGE_TOP;

  for (const row of rows) {
    row.positionY = cursorY + POSITION_TRACK_OFFSET;
    row.fingeringY = cursorY + FINGER_TRACK_OFFSET;
    row.scoreY = cursorY + SCORE_TRACK_OFFSET;
    row.lyricLine = canPairLyrics
      ? selectedLyricLines[row.index]
      : undefined;
    const rowElements = [...row.textShapes, ...row.mediaShapes];
    const scoreBottom = Math.max(
      ...rowElements.map(
        (shape) =>
          row.scoreY +
          (shape.bbox.y - row.baseY) +
          shape.bbox.height,
      ),
    );
    row.lyricY = scoreBottom + LYRIC_TRACK_GAP;
    const lyricHeight = row.lyricLine
      ? Math.max(
          48,
          shapeFontSize(row.lyricLine.shape) * 1.35 + 4,
        )
      : 0;
    row.lyricBottom = row.lyricY + lyricHeight;
    cursorY =
      (row.lyricLine ? row.lyricBottom : scoreBottom) + ROW_GAP;
  }

  const fallbackLyrics: FallbackLyricLayout[] = [];
  if (!canPairLyrics) {
    cursorY += 12;
    for (const shape of lyricShapes) {
      const minimumHeight =
        Math.max(1, shape.paragraphs.length) *
          shapeFontSize(shape) *
          1.35 +
        4;
      const height = Math.max(shape.bbox.height, minimumHeight);
      fallbackLyrics.push({
        shape,
        bbox: {
          ...shape.bbox,
          y: cursorY,
          height,
        },
      });
      cursorY += height + ROW_GAP;
    }
  }

  return {
    rows,
    fallbackLyrics,
    contentHeight: Math.max(variant.page.height, cursorY),
  };
}
