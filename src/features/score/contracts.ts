export const SOURCE_SCHEMA = "shiqin-pptx-source/v1" as const;
export const SCORE_SCHEMA = "shiqin-score/v1" as const;
export const ARRANGEMENT_SCHEMA = "shiqin-arrangement/v1" as const;

export type ContentHash = string;
export type TeachingSourceStatus =
  | "source_confirmed"
  | "manual_confirmed"
  | "auto_candidate"
  | "unavailable";
export type FingerNumber = 1 | 2 | 3 | 4 | 5;

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourceReference {
  asset: string;
  slide: number;
  shape_id: string;
  paragraph?: number;
  run?: number;
}

export interface ContractDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  sources: SourceReference[];
}

export interface SourceTextRun {
  id: string;
  text: string;
  font_family: string | null;
  font_size: number | null;
  character_spacing?: number | null;
  bold: boolean;
  italic: boolean;
  color: string | null;
  source: SourceReference;
}

export interface SourceParagraph {
  id: string;
  order: number;
  runs: SourceTextRun[];
}

export interface SourceTextShape {
  id: string;
  kind: "text";
  name: string;
  order: number;
  bbox_emu: BBox;
  bbox: BBox;
  rotation: number;
  source: SourceReference;
  paragraphs: SourceParagraph[];
}

export interface SourceMediaShape {
  id: string;
  kind: "media";
  name: string;
  order: number;
  bbox_emu: BBox;
  bbox: BBox;
  rotation: number;
  source: SourceReference;
  relationship_id: string;
  media_path: string;
}

export type SourceShape = SourceTextShape | SourceMediaShape;

export interface SourceSlide {
  id: string;
  number: number;
  width_emu: number;
  height_emu: number;
  width: number;
  height: number;
  shapes: SourceShape[];
  diagnostics: ContractDiagnostic[];
}

export interface PptxSourceDocument {
  schema: typeof SOURCE_SCHEMA;
  hymn_key: string;
  title: string;
  source_file: string;
  source_hash: ContentHash;
  generator_version: string;
  slides: SourceSlide[];
  diagnostics: ContractDiagnostic[];
}

export interface ScoreValueWithSource<T> {
  value: T;
  sources: SourceReference[];
}

export interface ScoreSourceAnchor {
  slide: number;
  x: number;
  y: number;
}

interface ScoreEventBase {
  id: string;
  measure_id: string;
  beat: number;
  duration: number;
  raw_glyphs: string;
  sources: SourceReference[];
  source_anchor?: ScoreSourceAnchor;
}

export interface ScoreNoteEvent extends ScoreEventBase {
  kind: "note";
  degree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  accidental: "flat" | "natural" | "sharp" | null;
  octave: number;
  augmentation_dots: number;
  beams: number;
}

export interface ScoreRestEvent extends ScoreEventBase {
  kind: "rest";
  augmentation_dots: number;
  beams: number;
}

export interface ScoreBarlineEvent extends ScoreEventBase {
  kind: "barline";
  style: "single" | "double" | "final";
}

export interface ScoreRepeatEvent extends ScoreEventBase {
  kind: "repeat";
  direction: "start" | "end";
}

export interface ScoreTieEvent extends ScoreEventBase {
  kind: "tie";
  from_event_id: string;
  to_event_id: string;
}

export interface ScoreSlurEvent extends ScoreEventBase {
  kind: "slur";
  from_event_id: string;
  to_event_id: string;
}

export interface ScoreUnknownEvent extends ScoreEventBase {
  kind: "unknown";
  reason: string;
}

export type ScoreEvent =
  | ScoreNoteEvent
  | ScoreRestEvent
  | ScoreBarlineEvent
  | ScoreRepeatEvent
  | ScoreTieEvent
  | ScoreSlurEvent
  | ScoreUnknownEvent;

export interface ScoreLyric {
  id: string;
  verse: string;
  text: string;
  event_ids: string[];
  sources: SourceReference[];
}

export interface ScoreMeasure {
  id: string;
  number: number;
  events: ScoreEvent[];
}

export interface ScorePhrase {
  id: string;
  measure_ids: string[];
}

export interface ScoreSystem {
  id: string;
  measures: ScoreMeasure[];
  phrases: ScorePhrase[];
  lyrics: ScoreLyric[];
}

export interface ScorePage {
  id: string;
  source_slides: number[];
  systems: ScoreSystem[];
}

export interface PianoScoreDocument {
  schema: typeof SCORE_SCHEMA;
  hymn_key: string;
  title: string;
  content_hash: ContentHash;
  source: {
    asset: string;
    source_hash: ContentHash;
    decoder_version: string;
  };
  key_signature: ScoreValueWithSource<string> | null;
  meter: ScoreValueWithSource<string> | null;
  pages: ScorePage[];
  diagnostics: ContractDiagnostic[];
}

export interface FingerAssignment {
  event_id: string;
  finger: FingerNumber;
  hand: "right";
  status: TeachingSourceStatus;
  confidence: number;
  reason: string;
}

export interface PositionSegment {
  id: string;
  start_event_id: string;
  end_event_id: string;
  label: string;
  finger_notes: Partial<Record<FingerNumber, string>>;
  status: TeachingSourceStatus;
  confidence: number;
  reason: string;
}

export interface PositionMove {
  id: string;
  trigger_event_id: string;
  from_position_id: string;
  to_position_id: string;
  instruction: string;
  reason: string;
}

export interface ChordTone {
  note: string;
  finger: FingerNumber;
}

export interface ChordAssignment {
  id: string;
  measure_id: string;
  beat: number;
  display_default: boolean;
  symbol: string;
  function: string;
  bass: string;
  inversion: string;
  tones: ChordTone[];
  status: TeachingSourceStatus;
  confidence: number;
  evidence: string[];
  alternatives: string[];
  reason: string;
}

export interface ArrangementRecommendation {
  status: TeachingSourceStatus;
  text: string;
  reason: string;
}

export interface PianoArrangementDocument {
  schema: typeof ARRANGEMENT_SCHEMA;
  hymn_key: string;
  score_hash: ContentHash;
  content_hash: ContentHash;
  fingerings: FingerAssignment[];
  positions: PositionSegment[];
  moves: PositionMove[];
  chords: ChordAssignment[];
  accompaniment: ArrangementRecommendation;
  intro: ArrangementRecommendation;
  interlude: ArrangementRecommendation;
  ending: ArrangementRecommendation;
}

export interface HymnScoreCatalogEntry {
  hymn_key: string;
  score_source: "pptx" | "image";
  score_schema: typeof SCORE_SCHEMA | null;
  arrangement_schema: typeof ARRANGEMENT_SCHEMA | null;
  score_asset_url: string | null;
  arrangement_asset_url: string | null;
  image_url: string;
  fallback_reason: string | null;
}

export interface ContractIssue {
  path: string;
  code: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHash(value: unknown): value is ContentHash {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function addIssue(
  issues: ContractIssue[],
  path: string,
  code: string,
  message: string,
) {
  issues.push({ path, code, message });
}

function validateSourceReference(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): value is SourceReference {
  if (!isRecord(value)) {
    addIssue(issues, path, "missing_source", "来源引用必须是对象");
    return false;
  }
  if (!hasText(value.asset)) {
    addIssue(issues, `${path}.asset`, "missing_source", "来源资产不能为空");
  }
  if (!Number.isInteger(value.slide) || Number(value.slide) < 1) {
    addIssue(issues, `${path}.slide`, "invalid_source", "幻灯片编号必须大于 0");
  }
  if (!hasText(value.shape_id)) {
    addIssue(issues, `${path}.shape_id`, "missing_source", "shape_id 不能为空");
  }
  return true;
}

function validateSourceList(
  value: unknown,
  path: string,
  issues: ContractIssue[],
) {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(issues, path, "missing_source", "至少需要一个来源引用");
    return;
  }
  value.forEach((source, index) =>
    validateSourceReference(source, `${path}[${index}]`, issues),
  );
}

export function validateSourceDocument(value: unknown): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: "$", code: "invalid_document", message: "Source AST 必须是对象" }];
  }
  if (value.schema !== SOURCE_SCHEMA) {
    addIssue(issues, "$.schema", "invalid_schema", `schema 必须为 ${SOURCE_SCHEMA}`);
  }
  if (!hasText(value.hymn_key)) {
    addIssue(issues, "$.hymn_key", "invalid_hymn_key", "曲目键不能为空");
  }
  if (!isHash(value.source_hash)) {
    addIssue(issues, "$.source_hash", "invalid_hash", "source_hash 必须是 SHA-256");
  }
  if (!Array.isArray(value.slides) || value.slides.length === 0) {
    addIssue(issues, "$.slides", "missing_slides", "Source AST 至少包含一张幻灯片");
    return issues;
  }
  value.slides.forEach((slideValue, slideIndex) => {
    const slidePath = `$.slides[${slideIndex}]`;
    if (!isRecord(slideValue) || !Array.isArray(slideValue.shapes)) {
      addIssue(issues, slidePath, "invalid_slide", "幻灯片结构无效");
      return;
    }
    slideValue.shapes.forEach((shapeValue, shapeIndex) => {
      const shapePath = `${slidePath}.shapes[${shapeIndex}]`;
      if (!isRecord(shapeValue)) {
        addIssue(issues, shapePath, "invalid_shape", "shape 必须是对象");
        return;
      }
      validateSourceReference(shapeValue.source, `${shapePath}.source`, issues);
      if (shapeValue.kind === "text" && Array.isArray(shapeValue.paragraphs)) {
        shapeValue.paragraphs.forEach((paragraphValue, paragraphIndex) => {
          if (!isRecord(paragraphValue) || !Array.isArray(paragraphValue.runs)) {
            addIssue(
              issues,
              `${shapePath}.paragraphs[${paragraphIndex}]`,
              "invalid_paragraph",
              "段落结构无效",
            );
            return;
          }
          paragraphValue.runs.forEach((runValue, runIndex) => {
            const runPath = `${shapePath}.paragraphs[${paragraphIndex}].runs[${runIndex}]`;
            if (!isRecord(runValue)) {
              addIssue(issues, runPath, "invalid_run", "文本 run 必须是对象");
              return;
            }
            validateSourceReference(runValue.source, `${runPath}.source`, issues);
          });
        });
      }
    });
  });
  return issues;
}

interface ScoreIndex {
  events: Map<string, ScoreEvent>;
  measures: Set<string>;
  positions: Set<string>;
}

function indexScore(value: PianoScoreDocument): ScoreIndex {
  const events = new Map<string, ScoreEvent>();
  const measures = new Set<string>();
  for (const page of value.pages) {
    for (const system of page.systems) {
      for (const measure of system.measures) {
        measures.add(measure.id);
        for (const event of measure.events) events.set(event.id, event);
      }
    }
  }
  return { events, measures, positions: new Set() };
}

function validateScoreSourceAnchor(
  value: unknown,
  path: string,
  issues: ContractIssue[],
) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    addIssue(
      issues,
      path,
      "invalid_source_anchor",
      "source_anchor 必须是对象",
    );
    return;
  }
  if (!Number.isFinite(value.slide) || Number(value.slide) <= 0) {
    addIssue(
      issues,
      `${path}.slide`,
      "invalid_source_anchor",
      "source_anchor.slide 必须是大于 0 的有限数",
    );
  }
  for (const coordinate of ["x", "y"] as const) {
    if (!Number.isFinite(value[coordinate])) {
      addIssue(
        issues,
        `${path}.${coordinate}`,
        "invalid_source_anchor",
        `source_anchor.${coordinate} 必须是有限数`,
      );
    }
  }
}

export function validateScoreDocument(value: unknown): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const pendingEventReferences: Array<{
    path: string;
    eventId: unknown;
    message: string;
  }> = [];
  if (!isRecord(value)) {
    return [{ path: "$", code: "invalid_document", message: "Score AST 必须是对象" }];
  }
  if (value.schema !== SCORE_SCHEMA) {
    addIssue(issues, "$.schema", "invalid_schema", `schema 必须为 ${SCORE_SCHEMA}`);
  }
  if (!hasText(value.hymn_key)) {
    addIssue(issues, "$.hymn_key", "invalid_hymn_key", "曲目键不能为空");
  }
  if (!isHash(value.content_hash)) {
    addIssue(issues, "$.content_hash", "invalid_hash", "content_hash 必须是 SHA-256");
  }
  if (!isRecord(value.source) || !hasText(value.source.asset)) {
    addIssue(issues, "$.source", "missing_source", "Score AST 必须指向 Source AST 资产");
  } else if (!isHash(value.source.source_hash)) {
    addIssue(issues, "$.source.source_hash", "invalid_hash", "source_hash 必须是 SHA-256");
  }
  const eventIds = new Set<string>();
  if (!Array.isArray(value.pages)) {
    addIssue(issues, "$.pages", "invalid_pages", "pages 必须是数组");
    return issues;
  }
  value.pages.forEach((pageValue, pageIndex) => {
    if (!isRecord(pageValue) || !Array.isArray(pageValue.systems)) {
      addIssue(issues, `$.pages[${pageIndex}]`, "invalid_page", "谱面页结构无效");
      return;
    }
    pageValue.systems.forEach((systemValue, systemIndex) => {
      const systemPath = `$.pages[${pageIndex}].systems[${systemIndex}]`;
      if (!isRecord(systemValue) || !Array.isArray(systemValue.measures)) {
        addIssue(issues, systemPath, "invalid_system", "谱表系统结构无效");
        return;
      }
      systemValue.measures.forEach((measureValue, measureIndex) => {
        const measurePath = `${systemPath}.measures[${measureIndex}]`;
        if (!isRecord(measureValue) || !hasText(measureValue.id) || !Array.isArray(measureValue.events)) {
          addIssue(issues, measurePath, "invalid_measure", "小节结构无效");
          return;
        }
        measureValue.events.forEach((eventValue, eventIndex) => {
          const eventPath = `${measurePath}.events[${eventIndex}]`;
          if (!isRecord(eventValue) || !hasText(eventValue.id)) {
            addIssue(issues, eventPath, "invalid_event", "事件必须具有稳定 ID");
            return;
          }
          if (eventIds.has(eventValue.id)) {
            addIssue(issues, `${eventPath}.id`, "duplicate_id", "事件 ID 不得重复");
          }
          eventIds.add(eventValue.id);
          if (eventValue.measure_id !== measureValue.id) {
            addIssue(issues, `${eventPath}.measure_id`, "cross_measure", "事件必须引用所在小节");
          }
          validateSourceList(eventValue.sources, `${eventPath}.sources`, issues);
          validateScoreSourceAnchor(
            eventValue.source_anchor,
            `${eventPath}.source_anchor`,
            issues,
          );
          if (
            (eventValue.kind === "tie" || eventValue.kind === "slur") &&
            (!hasText(eventValue.from_event_id) || !hasText(eventValue.to_event_id))
          ) {
            addIssue(issues, eventPath, "invalid_relation", "连线必须具有起止事件");
          } else if (eventValue.kind === "tie" || eventValue.kind === "slur") {
            pendingEventReferences.push(
              {
                path: `${eventPath}.from_event_id`,
                eventId: eventValue.from_event_id,
                message: "连线起点事件不存在",
              },
              {
                path: `${eventPath}.to_event_id`,
                eventId: eventValue.to_event_id,
                message: "连线终点事件不存在",
              },
            );
          }
        });
      });
      if (Array.isArray(systemValue.lyrics)) {
        systemValue.lyrics.forEach((lyricValue, lyricIndex) => {
          const lyricPath = `${systemPath}.lyrics[${lyricIndex}]`;
          if (!isRecord(lyricValue)) {
            addIssue(issues, lyricPath, "invalid_lyric", "歌词结构无效");
            return;
          }
          validateSourceList(lyricValue.sources, `${lyricPath}.sources`, issues);
          if (!Array.isArray(lyricValue.event_ids)) {
            addIssue(
              issues,
              `${lyricPath}.event_ids`,
              "invalid_lyric_events",
              "歌词必须提供事件引用数组",
            );
          } else {
            lyricValue.event_ids.forEach((eventId, eventIndex) => {
              pendingEventReferences.push({
                path: `${lyricPath}.event_ids[${eventIndex}]`,
                eventId,
                message: "歌词锚定事件不存在",
              });
            });
          }
        });
      }
    });
  });
  for (const reference of pendingEventReferences) {
    if (!hasText(reference.eventId) || !eventIds.has(reference.eventId)) {
      addIssue(
        issues,
        reference.path,
        "dangling_event_id",
        reference.message,
      );
    }
  }
  return issues;
}

export function validateArrangementDocument(
  score: PianoScoreDocument,
  value: unknown,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: "$", code: "invalid_document", message: "Arrangement AST 必须是对象" }];
  }
  if (value.schema !== ARRANGEMENT_SCHEMA) {
    addIssue(
      issues,
      "$.schema",
      "invalid_schema",
      `schema 必须为 ${ARRANGEMENT_SCHEMA}`,
    );
  }
  if (value.hymn_key !== score.hymn_key) {
    addIssue(
      issues,
      "$.hymn_key",
      "cross_version",
      `编配 ${String(value.hymn_key)} 不得引用曲目 ${score.hymn_key}`,
    );
  }
  if (value.score_hash !== score.content_hash) {
    addIssue(issues, "$.score_hash", "score_hash_mismatch", "编配必须引用当前 Score AST");
  }
  if (!isHash(value.content_hash)) {
    addIssue(issues, "$.content_hash", "invalid_hash", "content_hash 必须是 SHA-256");
  }
  const index = indexScore(score);
  const positionIds = new Set<string>();
  if (Array.isArray(value.positions)) {
    value.positions.forEach((positionValue, positionIndex) => {
      const positionPath = `$.positions[${positionIndex}]`;
      if (!isRecord(positionValue)) return;
      if (hasText(positionValue.id)) positionIds.add(positionValue.id);
      for (const field of ["start_event_id", "end_event_id"] as const) {
        const eventId = positionValue[field];
        if (!hasText(eventId) || !index.events.has(eventId)) {
          addIssue(
            issues,
            `${positionPath}.${field}`,
            "dangling_event_id",
            `找不到事件 ${String(eventId)}`,
          );
        }
      }
    });
  } else {
    addIssue(issues, "$.positions", "invalid_positions", "positions 必须是数组");
  }
  if (Array.isArray(value.fingerings)) {
    value.fingerings.forEach((fingeringValue, fingeringIndex) => {
      const fingeringPath = `$.fingerings[${fingeringIndex}]`;
      if (!isRecord(fingeringValue)) return;
      const eventId = fingeringValue.event_id;
      const event = hasText(eventId) ? index.events.get(eventId) : undefined;
      if (!event) {
        addIssue(
          issues,
          `${fingeringPath}.event_id`,
          "dangling_event_id",
          `找不到事件 ${String(eventId)}`,
        );
      } else if (event.kind !== "note") {
        addIssue(
          issues,
          `${fingeringPath}.event_id`,
          "invalid_fingering_target",
          "指法只能锚定音符事件",
        );
      }
      if (
        !Number.isInteger(fingeringValue.finger) ||
        Number(fingeringValue.finger) < 1 ||
        Number(fingeringValue.finger) > 5
      ) {
        addIssue(
          issues,
          `${fingeringPath}.finger`,
          "invalid_finger",
          "手指编号必须是 1 至 5",
        );
      }
    });
  } else {
    addIssue(issues, "$.fingerings", "invalid_fingerings", "fingerings 必须是数组");
  }
  if (Array.isArray(value.moves)) {
    value.moves.forEach((moveValue, moveIndex) => {
      const movePath = `$.moves[${moveIndex}]`;
      if (!isRecord(moveValue)) return;
      if (!hasText(moveValue.trigger_event_id) || !index.events.has(moveValue.trigger_event_id)) {
        addIssue(issues, `${movePath}.trigger_event_id`, "dangling_event_id", "换位触发事件不存在");
      }
      for (const field of ["from_position_id", "to_position_id"] as const) {
        if (!hasText(moveValue[field]) || !positionIds.has(moveValue[field])) {
          addIssue(issues, `${movePath}.${field}`, "dangling_position_id", "换位手位不存在");
        }
      }
    });
  }
  if (Array.isArray(value.chords)) {
    value.chords.forEach((chordValue, chordIndex) => {
      const chordPath = `$.chords[${chordIndex}]`;
      if (!isRecord(chordValue)) return;
      if (!hasText(chordValue.measure_id) || !index.measures.has(chordValue.measure_id)) {
        addIssue(issues, `${chordPath}.measure_id`, "dangling_measure_id", "和弦小节不存在");
      }
      if (typeof chordValue.display_default !== "boolean") {
        addIssue(
          issues,
          `${chordPath}.display_default`,
          "invalid_display_default",
          "和弦默认展示标记必须是布尔值",
        );
      } else {
        const confirmed =
          chordValue.status === "manual_confirmed" ||
          chordValue.status === "source_confirmed";
        if (chordValue.display_default !== confirmed) {
          addIssue(
            issues,
            `${chordPath}.display_default`,
            "display_status_mismatch",
            confirmed
              ? "人工或来源确认和弦必须默认展示"
              : "自动候选和弦不得默认展示",
          );
        }
      }
      if (Array.isArray(chordValue.tones)) {
        chordValue.tones.forEach((toneValue, toneIndex) => {
          if (
            !isRecord(toneValue) ||
            !Number.isInteger(toneValue.finger) ||
            Number(toneValue.finger) < 1 ||
            Number(toneValue.finger) > 5
          ) {
            addIssue(
              issues,
              `${chordPath}.tones[${toneIndex}].finger`,
              "invalid_finger",
              "左手手指编号必须是 1 至 5",
            );
          }
        });
      }
    });
  }
  return issues;
}

export function validateCatalogEntry(value: unknown): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: "$", code: "invalid_document", message: "目录项必须是对象" }];
  }
  if (!hasText(value.hymn_key)) {
    addIssue(issues, "$.hymn_key", "invalid_hymn_key", "曲目键不能为空");
  }
  if (value.score_source !== "pptx" && value.score_source !== "image") {
    addIssue(issues, "$.score_source", "invalid_source_type", "谱面来源无效");
  }
  const isAlternate = hasText(value.hymn_key) && /[a-z]$/i.test(value.hymn_key);
  if (isAlternate && value.score_source === "pptx") {
    addIssue(issues, "$.score_source", "cross_version", "当前第二调没有独立 PPTX，不得继承原调结构化谱面");
  }
  if (value.score_source === "pptx") {
    if (!hasText(value.score_asset_url)) {
      addIssue(issues, "$.score_asset_url", "missing_asset", "PPTX 曲目必须提供分曲 Score 资产 URL");
    }
    if (
      value.arrangement_schema === ARRANGEMENT_SCHEMA &&
      !hasText(value.arrangement_asset_url)
    ) {
      addIssue(
        issues,
        "$.arrangement_asset_url",
        "missing_asset",
        "已声明 Arrangement schema 时必须提供分曲 Arrangement 资产 URL",
      );
    }
    if (
      value.arrangement_schema === null &&
      value.arrangement_asset_url !== null
    ) {
      addIssue(
        issues,
        "$.arrangement_asset_url",
        "invalid_asset",
        "未生成 Arrangement 时不得暴露 Arrangement 资产 URL",
      );
    }
    if (value.fallback_reason !== null) {
      addIssue(issues, "$.fallback_reason", "invalid_fallback", "结构化曲目不应具有回退原因");
    }
  }
  if (value.score_source === "image") {
    if (value.score_asset_url !== null || value.arrangement_asset_url !== null) {
      addIssue(issues, "$.score_asset_url", "cross_version", "图片回退不得引用结构化资产");
    }
    if (!hasText(value.fallback_reason)) {
      addIssue(issues, "$.fallback_reason", "missing_fallback", "图片回退必须说明原因");
    }
  }
  return issues;
}

function assertNoIssues(
  issues: ContractIssue[],
  contractName: string,
): asserts issues is [] {
  if (issues.length === 0) return;
  const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
  throw new Error(`${contractName} 校验失败：${detail}`);
}

export function assertSourceDocument(
  value: unknown,
): asserts value is PptxSourceDocument {
  assertNoIssues(validateSourceDocument(value), "Source AST");
}

export function assertScoreDocument(
  value: unknown,
): asserts value is PianoScoreDocument {
  assertNoIssues(validateScoreDocument(value), "Score AST");
}

export function assertArrangementDocument(
  score: PianoScoreDocument,
  value: unknown,
): asserts value is PianoArrangementDocument {
  assertNoIssues(validateArrangementDocument(score, value), "Arrangement AST");
}

export function assertCatalogEntry(
  value: unknown,
): asserts value is HymnScoreCatalogEntry {
  assertNoIssues(validateCatalogEntry(value), "曲库目录项");
}
