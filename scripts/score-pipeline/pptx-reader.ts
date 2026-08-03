import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import {
  SOURCE_SCHEMA,
  type BBox,
  type ContractDiagnostic,
  type PptxSourceDocument,
  type SourceMediaShape,
  type SourceParagraph,
  type SourceReference,
  type SourceShape,
  type SourceSlide,
  type SourceTextShape,
} from "../../src/features/score/contracts";
import {
  DEFAULT_SLIDE_SIZE_EMU,
  PPTX_SOURCE_GENERATOR_VERSION,
  attributes,
  bboxEmuToCssPx,
  childElements,
  createShapeId,
  createSourceReference,
  descendants,
  elementChildren,
  elementName,
  firstChild,
  firstDescendant,
  parsePptxFilename,
  resolveRelationshipTarget,
  textContent,
  type OrderedXmlNode,
} from "./source-ast";

const PRESENTATION_PART = "ppt/presentation.xml";
const PRESENTATION_RELS_PART = "ppt/_rels/presentation.xml.rels";
const SP_TREE_METADATA = new Set(["p:nvGrpSpPr", "p:grpSpPr"]);
const SUPPORTED_SHAPES = new Set(["p:sp", "p:pic"]);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  parseTagValue: false,
  preserveOrder: true,
  processEntities: true,
  trimValues: false,
});

interface Relationship {
  id: string;
  target: string;
  type: string;
  external: boolean;
}

interface RunStyleDefaults {
  fontFamily: string | null;
  fontSize: number | null;
  characterSpacing: number | null;
}

type PlaceholderTextDefaults = Map<
  string,
  Map<number, RunStyleDefaults>
>;

export interface ReadPptxSourceOptions {
  hymnKey?: string;
  title?: string;
  sourceFile?: string;
  generatorVersion?: string;
}

export async function readPptxSource(
  filePath: string,
  options: ReadPptxSourceOptions = {},
): Promise<PptxSourceDocument> {
  const bytes = new Uint8Array(await readFile(filePath));
  const packageParts = unzipSync(bytes);
  const filenameMetadata = parsePptxFilename(filePath);
  const hymnKey = options.hymnKey ?? filenameMetadata.hymnKey;
  const title = options.title ?? filenameMetadata.title;
  const sourceFile = options.sourceFile ?? filePath.replace(/\\/g, "/");
  const auditAsset = `data/generated/hymn-sources/${hymnKey}.json`;
  const documentDiagnostics: ContractDiagnostic[] = [];

  const presentation = readXmlPart(packageParts, PRESENTATION_PART);
  const presentationRelationships = readRelationships(
    packageParts,
    PRESENTATION_RELS_PART,
  );
  const slideSize = parsePresentationSize(presentation);
  const slideParts = parseSlideOrder(
    presentation,
    presentationRelationships,
    packageParts,
    documentDiagnostics,
    auditAsset,
  );

  const slides = slideParts.map((slidePart, index) => {
    const number = index + 1;
    const slide = parseSlide(
      packageParts,
      slidePart,
      number,
      slideSize,
      auditAsset,
    );
    documentDiagnostics.push(...slide.diagnostics);
    return slide;
  });

  return {
    schema: SOURCE_SCHEMA,
    hymn_key: hymnKey,
    title,
    source_file: sourceFile,
    source_hash: createHash("sha256").update(bytes).digest("hex"),
    generator_version:
      options.generatorVersion ?? PPTX_SOURCE_GENERATOR_VERSION,
    slides,
    diagnostics: documentDiagnostics,
  };
}

export function parsePresentationSize(nodes: readonly OrderedXmlNode[]): {
  width: number;
  height: number;
} {
  const size = firstDescendant(nodes, "p:sldSz");
  const sizeAttributes = attributes(size);
  const width = positiveNumber(sizeAttributes.cx);
  const height = positiveNumber(sizeAttributes.cy);
  return {
    width: width ?? DEFAULT_SLIDE_SIZE_EMU.width,
    height: height ?? DEFAULT_SLIDE_SIZE_EMU.height,
  };
}

export function parseSlide(
  packageParts: Record<string, Uint8Array>,
  slidePart: string,
  number: number,
  slideSize: { width: number; height: number },
  auditAsset: string,
): SourceSlide {
  const nodes = readXmlPart(packageParts, slidePart);
  const relationships = readRelationships(
    packageParts,
    slideRelationshipPart(slidePart),
  );
  const placeholderDefaults = readLayoutPlaceholderDefaults(
    packageParts,
    slidePart,
    relationships,
  );
  const spTree = firstDescendant(nodes, "p:spTree");
  const diagnostics: ContractDiagnostic[] = [];
  const shapes: SourceShape[] = [];
  let zOrder = 0;

  if (!spTree) {
    diagnostics.push(
      diagnostic(
        "missing_shape_tree",
        "error",
        `幻灯片 ${number} 缺少 p:spTree`,
        createSourceReference(auditAsset, number, `slide-${number}`),
      ),
    );
  } else {
    for (const node of elementChildren(spTree)) {
      const name = elementName(node);
      if (!name || SP_TREE_METADATA.has(name)) continue;
      const order = zOrder;
      zOrder += 1;

      if (!SUPPORTED_SHAPES.has(name)) {
        const identity = readShapeIdentity(node, number, String(order));
        diagnostics.push(
          diagnostic(
            "unsupported_shape",
            "warning",
            `暂不支持的 OOXML shape：${name}`,
            createSourceReference(auditAsset, number, identity.id),
          ),
        );
        continue;
      }

      if (name === "p:sp") {
        shapes.push(
          parseTextShape(
            node,
            number,
            order,
            auditAsset,
            placeholderDefaults,
          ),
        );
        continue;
      }
      shapes.push(
        parseMediaShape(
          node,
          slidePart,
          number,
          order,
          auditAsset,
          relationships,
          diagnostics,
        ),
      );
    }
  }

  return {
    id: `slide-${number}`,
    number,
    width_emu: slideSize.width,
    height_emu: slideSize.height,
    width: bboxEmuToCssPx({
      x: 0,
      y: 0,
      width: slideSize.width,
      height: slideSize.height,
    }).width,
    height: bboxEmuToCssPx({
      x: 0,
      y: 0,
      width: slideSize.width,
      height: slideSize.height,
    }).height,
    shapes,
    diagnostics,
  };
}

export function resolveRelationship(
  relationships: ReadonlyMap<string, Relationship>,
  relationshipId: string,
  sourcePart: string,
): string | null {
  const relationship = relationships.get(relationshipId);
  if (!relationship) return null;
  return relationship.external
    ? relationship.target
    : resolveRelationshipTarget(sourcePart, relationship.target);
}

function placeholderKeys(node: OrderedXmlNode): string[] {
  const placeholder = firstDescendant([node], "p:ph");
  const values = attributes(placeholder);
  return [
    values.idx ? `idx:${values.idx}` : "",
    values.type ? `type:${values.type}` : "",
  ].filter(Boolean);
}

function readRunStyleDefaults(
  properties: OrderedXmlNode | undefined,
): RunStyleDefaults {
  const values = attributes(properties);
  return {
    fontFamily: readTypeface(properties),
    fontSize: optionalNumber(values.sz, 100),
    characterSpacing: optionalNumber(values.spc, 100),
  };
}

function readLayoutPlaceholderDefaults(
  packageParts: Record<string, Uint8Array>,
  slidePart: string,
  relationships: ReadonlyMap<string, Relationship>,
): PlaceholderTextDefaults {
  const relationship = [...relationships.values()].find(
    (item) =>
      !item.external && item.type.endsWith("/slideLayout"),
  );
  if (!relationship) return new Map();
  const layoutPart = resolveRelationshipTarget(
    slidePart,
    relationship.target,
  );
  if (!packageParts[layoutPart]) return new Map();
  const spTree = firstDescendant(
    readXmlPart(packageParts, layoutPart),
    "p:spTree",
  );
  if (!spTree) return new Map();

  const result: PlaceholderTextDefaults = new Map();
  for (const shape of childElements(spTree, "p:sp")) {
    const keys = placeholderKeys(shape);
    if (keys.length === 0) continue;
    const listStyle = firstDescendant([shape], "a:lstStyle");
    if (!listStyle) continue;
    const levels = new Map<number, RunStyleDefaults>();
    for (let level = 0; level < 9; level += 1) {
      const paragraphProperties = firstChild(
        listStyle,
        `a:lvl${level + 1}pPr`,
      );
      const runProperties = paragraphProperties
        ? firstChild(paragraphProperties, "a:defRPr")
        : undefined;
      if (runProperties) {
        levels.set(level, readRunStyleDefaults(runProperties));
      }
    }
    if (levels.size === 0) continue;
    keys.forEach((key) => result.set(key, levels));
  }
  return result;
}

function resolveParagraphDefaults(
  shape: OrderedXmlNode,
  paragraph: OrderedXmlNode,
  defaults: PlaceholderTextDefaults,
): RunStyleDefaults | undefined {
  const levels = placeholderKeys(shape)
    .map((key) => defaults.get(key))
    .find((value) => value !== undefined);
  if (!levels) return undefined;
  const level = Number(
    attributes(firstChild(paragraph, "a:pPr")).lvl ?? 0,
  );
  return levels.get(Number.isFinite(level) ? level : 0) ?? levels.get(0);
}

function parseSlideOrder(
  presentation: readonly OrderedXmlNode[],
  relationships: ReadonlyMap<string, Relationship>,
  packageParts: Record<string, Uint8Array>,
  diagnostics: ContractDiagnostic[],
  auditAsset: string,
): string[] {
  const slideIdList = firstDescendant(presentation, "p:sldIdLst");
  const orderedParts =
    slideIdList
      ? childElements(slideIdList, "p:sldId")
          .map((node) => attributes(node)["r:id"])
          .filter((id): id is string => Boolean(id))
          .map((id) => resolveRelationship(relationships, id, PRESENTATION_PART))
          .filter((part): part is string => Boolean(part))
      : [];

  if (orderedParts.length > 0) return orderedParts;

  diagnostics.push(
    diagnostic(
      "missing_slide_order",
      "warning",
      "presentation.xml 未提供可解析的幻灯片顺序，已按 part 编号排序",
      createSourceReference(auditAsset, 1, "presentation"),
    ),
  );
  return Object.keys(packageParts)
    .filter((part) => /^ppt\/slides\/slide\d+\.xml$/.test(part))
    .sort((left, right) => slidePartNumber(left) - slidePartNumber(right));
}

function parseTextShape(
  node: OrderedXmlNode,
  slide: number,
  order: number,
  auditAsset: string,
  placeholderDefaults: PlaceholderTextDefaults,
): SourceTextShape {
  const identity = readShapeIdentity(node, slide, String(order));
  const source = createSourceReference(
    auditAsset,
    slide,
    identity.id,
  );
  const txBody = firstChild(node, "p:txBody");
  const paragraphs: SourceParagraph[] = [];
  for (const paragraph of txBody
    ? childElements(txBody, "a:p")
    : []) {
    paragraphs.push(
      ...parseParagraphLines(
        paragraph,
        identity.id,
        slide,
        paragraphs.length,
        auditAsset,
        resolveParagraphDefaults(node, paragraph, placeholderDefaults),
      ),
    );
  }
  const transform = readTransform(node);

  return {
    id: identity.id,
    kind: "text",
    name: identity.name,
    order,
    bbox_emu: transform.bbox,
    bbox: bboxEmuToCssPx(transform.bbox),
    rotation: transform.rotation,
    source,
    paragraphs,
  };
}

function parseParagraphLines(
  node: OrderedXmlNode,
  shapeId: string,
  slide: number,
  firstParagraphIndex: number,
  auditAsset: string,
  defaults?: RunStyleDefaults,
): SourceParagraph[] {
  const paragraphs: SourceParagraph[] = [];
  const nextParagraph = (): SourceParagraph => {
    const paragraphIndex = firstParagraphIndex + paragraphs.length;
    const paragraph = {
      id: `${shapeId}-p-${paragraphIndex}`,
      order: paragraphIndex,
      runs: [],
    };
    paragraphs.push(paragraph);
    return paragraph;
  };
  let current = nextParagraph();

  for (const child of elementChildren(node)) {
    const name = elementName(child);
    if (name === "a:br") {
      current = nextParagraph();
      continue;
    }
    if (name !== "a:r" && name !== "a:fld") continue;
    const paragraphIndex = current.order;
    const runIndex = current.runs.length;
    const source = createSourceReference(
      auditAsset,
      slide,
      shapeId,
      paragraphIndex,
      runIndex,
    );
    const properties = firstChild(child, "a:rPr");
    const propertyAttributes = attributes(properties);
    current.runs.push({
      id: `${shapeId}-p-${paragraphIndex}-r-${runIndex}`,
      text: descendants([child], "a:t").map(textContent).join(""),
      font_family: readTypeface(properties) ?? defaults?.fontFamily ?? null,
      font_size:
        optionalNumber(propertyAttributes.sz, 100) ??
        defaults?.fontSize ??
        null,
      character_spacing:
        optionalNumber(propertyAttributes.spc, 100) ??
        defaults?.characterSpacing ??
        null,
      bold: booleanAttribute(propertyAttributes.b),
      italic: booleanAttribute(propertyAttributes.i),
      color: readColor(properties),
      source,
    });
  }
  return paragraphs;
}

function parseMediaShape(
  node: OrderedXmlNode,
  slidePart: string,
  slide: number,
  order: number,
  auditAsset: string,
  relationships: ReadonlyMap<string, Relationship>,
  diagnostics: ContractDiagnostic[],
): SourceMediaShape {
  const identity = readShapeIdentity(node, slide, String(order));
  const source = createSourceReference(auditAsset, slide, identity.id);
  const transform = readTransform(node);
  const blip = firstDescendant([node], "a:blip");
  const relationshipId =
    attributes(blip)["r:embed"] ?? attributes(blip)["r:link"] ?? "";
  const mediaPath = relationshipId
    ? resolveRelationship(relationships, relationshipId, slidePart)
    : null;
  if (!relationshipId || !mediaPath) {
    diagnostics.push(
      diagnostic(
        "missing_media_relationship",
        "error",
        `图片 shape ${identity.name || identity.id} 缺少可解析的媒体 relationship`,
        source,
      ),
    );
  }
  return {
    id: identity.id,
    kind: "media",
    name: identity.name,
    order,
    bbox_emu: transform.bbox,
    bbox: bboxEmuToCssPx(transform.bbox),
    rotation: transform.rotation,
    source,
    relationship_id: relationshipId,
    media_path: mediaPath ?? "",
  };
}

function readShapeIdentity(
  node: OrderedXmlNode,
  slide: number,
  fallbackId: string,
): { id: string; name: string } {
  const nonVisualProperties = firstDescendant([node], "p:cNvPr");
  const propertyAttributes = attributes(nonVisualProperties);
  const sourceId = propertyAttributes.id || fallbackId;
  return {
    id: createShapeId(slide, sourceId),
    name: propertyAttributes.name ?? "",
  };
}

function readTransform(node: OrderedXmlNode): {
  bbox: BBox;
  rotation: number;
} {
  const shapeProperties =
    firstChild(node, "p:spPr") ?? firstChild(node, "p:grpSpPr");
  const transform = shapeProperties
    ? firstDescendant([shapeProperties], "a:xfrm")
    : undefined;
  const offset = transform ? firstChild(transform, "a:off") : undefined;
  const extent = transform ? firstChild(transform, "a:ext") : undefined;
  const offsetAttributes = attributes(offset);
  const extentAttributes = attributes(extent);
  const transformAttributes = attributes(transform);
  return {
    bbox: {
      x: numberOrZero(offsetAttributes.x),
      y: numberOrZero(offsetAttributes.y),
      width: numberOrZero(extentAttributes.cx),
      height: numberOrZero(extentAttributes.cy),
    },
    rotation: numberOrZero(transformAttributes.rot) / 60_000,
  };
}

function readTypeface(properties: OrderedXmlNode | undefined): string | null {
  if (!properties) return null;
  for (const fontTag of ["a:sym", "a:latin", "a:ea", "a:cs"]) {
    const typeface = attributes(firstChild(properties, fontTag)).typeface;
    if (typeface) return typeface;
  }
  return null;
}

function readColor(properties: OrderedXmlNode | undefined): string | null {
  if (!properties) return null;
  const solidFill = firstDescendant([properties], "a:solidFill");
  if (!solidFill) return null;
  const rgb = attributes(firstChild(solidFill, "a:srgbClr")).val;
  if (rgb) return `#${rgb.toUpperCase()}`;
  const scheme = attributes(firstChild(solidFill, "a:schemeClr")).val;
  return scheme ? `scheme:${scheme}` : null;
}

function readRelationships(
  packageParts: Record<string, Uint8Array>,
  relationshipPart: string,
): Map<string, Relationship> {
  const bytes = packageParts[relationshipPart];
  if (!bytes) return new Map();
  const nodes = parseXml(bytes, relationshipPart);
  return new Map(
    descendants(nodes, "Relationship")
      .map((node): Relationship | null => {
        const relationshipAttributes = attributes(node);
        if (!relationshipAttributes.Id || !relationshipAttributes.Target) {
          return null;
        }
        return {
          id: relationshipAttributes.Id,
          target: relationshipAttributes.Target,
          type: relationshipAttributes.Type ?? "",
          external: relationshipAttributes.TargetMode === "External",
        };
      })
      .filter(
        (relationship): relationship is Relationship =>
          relationship !== null,
      )
      .map((relationship) => [relationship.id, relationship]),
  );
}

function readXmlPart(
  packageParts: Record<string, Uint8Array>,
  part: string,
): OrderedXmlNode[] {
  const bytes = packageParts[part];
  if (!bytes) throw new Error(`PPTX 缺少必要 OOXML part：${part}`);
  return parseXml(bytes, part);
}

function parseXml(bytes: Uint8Array, part: string): OrderedXmlNode[] {
  const result: unknown = parser.parse(strFromU8(bytes));
  if (!Array.isArray(result)) {
    throw new Error(`OOXML part 解析结果无效：${part}`);
  }
  return result.filter(
    (node): node is OrderedXmlNode =>
      typeof node === "object" && node !== null && !Array.isArray(node),
  );
}

function slideRelationshipPart(slidePart: string): string {
  return posix.join(
    posix.dirname(slidePart),
    "_rels",
    `${posix.basename(slidePart)}.rels`,
  );
}

function slidePartNumber(part: string): number {
  return Number(part.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function diagnostic(
  code: string,
  severity: ContractDiagnostic["severity"],
  message: string,
  source: SourceReference,
): ContractDiagnostic {
  return { code, severity, message, sources: [source] };
}

function positiveNumber(value: string | undefined): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function numberOrZero(value: string | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalNumber(
  value: string | undefined,
  divisor: number,
): number | null {
  const number = Number(value);
  return Number.isFinite(number) && value !== undefined
    ? number / divisor
    : null;
}

function booleanAttribute(value: string | undefined): boolean {
  return value === "1" || value === "true";
}
