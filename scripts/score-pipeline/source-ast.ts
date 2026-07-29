import { posix } from "node:path";
import type { BBox, SourceReference } from "../../src/features/score/contracts";

export const EMU_PER_CSS_PX = 9_525;
export const DEFAULT_SLIDE_SIZE_EMU = {
  width: 9_144_000,
  height: 5_143_500,
} as const;
export const PPTX_SOURCE_GENERATOR_VERSION = "pptx-reader/v2";

export interface OrderedXmlNode {
  [key: string]: unknown;
  ":@"?: Record<string, string>;
  "#text"?: string;
}

export function elementName(node: OrderedXmlNode): string | null {
  return (
    Object.keys(node).find(
      (key) => key !== ":@" && key !== "#text" && key !== "?xml",
    ) ?? null
  );
}

export function elementChildren(node: OrderedXmlNode): OrderedXmlNode[] {
  const name = elementName(node);
  if (!name) return [];
  const children = node[name];
  return Array.isArray(children)
    ? children.filter(isOrderedXmlNode)
    : [];
}

export function childElements(
  node: OrderedXmlNode,
  name: string,
): OrderedXmlNode[] {
  return elementChildren(node).filter((child) => elementName(child) === name);
}

export function firstChild(
  node: OrderedXmlNode,
  name: string,
): OrderedXmlNode | undefined {
  return childElements(node, name)[0];
}

export function firstDescendant(
  nodes: readonly OrderedXmlNode[],
  name: string,
): OrderedXmlNode | undefined {
  for (const node of nodes) {
    if (elementName(node) === name) return node;
    const nested = firstDescendant(elementChildren(node), name);
    if (nested) return nested;
  }
  return undefined;
}

export function descendants(
  nodes: readonly OrderedXmlNode[],
  name: string,
): OrderedXmlNode[] {
  const matches: OrderedXmlNode[] = [];
  for (const node of nodes) {
    if (elementName(node) === name) matches.push(node);
    matches.push(...descendants(elementChildren(node), name));
  }
  return matches;
}

export function attributes(
  node: OrderedXmlNode | undefined,
): Record<string, string> {
  return node?.[":@"] ?? {};
}

export function textContent(node: OrderedXmlNode | undefined): string {
  if (!node) return "";
  return elementChildren(node)
    .map((child) => {
      if (typeof child["#text"] === "string") return child["#text"];
      return textContent(child);
    })
    .join("");
}

export function emuToCssPx(value: number): number {
  return round(value / EMU_PER_CSS_PX);
}

export function bboxEmuToCssPx(bbox: BBox): BBox {
  return {
    x: emuToCssPx(bbox.x),
    y: emuToCssPx(bbox.y),
    width: emuToCssPx(bbox.width),
    height: emuToCssPx(bbox.height),
  };
}

export function createShapeId(
  slide: number,
  sourceShapeId: string,
): string {
  return `slide-${slide}-shape-${sourceShapeId}`;
}

export function createSourceReference(
  asset: string,
  slide: number,
  shapeId: string,
  paragraph?: number,
  run?: number,
): SourceReference {
  return {
    asset,
    slide,
    shape_id: shapeId,
    ...(paragraph === undefined ? {} : { paragraph }),
    ...(run === undefined ? {} : { run }),
  };
}

export function resolveRelationshipTarget(
  sourcePart: string,
  target: string,
): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(target)) return target;
  if (target.startsWith("/")) return target.slice(1);
  return posix.normalize(posix.join(posix.dirname(sourcePart), target));
}

export function parsePptxFilename(filePath: string): {
  hymnKey: string;
  title: string;
} {
  const basename = posix.basename(filePath.replace(/\\/g, "/"));
  const match = basename.match(/^(\d+)\s+(.+)\.pptx$/i);
  if (!match) {
    throw new Error(`无法从 PPTX 文件名解析曲目编号和标题：${basename}`);
  }
  return {
    hymnKey: String(Number(match[1])),
    title: match[2].trim(),
  };
}

export function isOrderedXmlNode(value: unknown): value is OrderedXmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
