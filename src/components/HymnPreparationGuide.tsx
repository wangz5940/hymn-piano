import { AlertTriangle, CheckCircle2, Music2 } from "lucide-react";
import type {
  FingerAssignment,
  PianoArrangementDocument,
  PianoScoreDocument,
  ScoreNoteEvent,
  TeachingSourceStatus,
} from "@/features/score/contracts";
import type { HymnAssets } from "@/features/score/loadHymnAssets";
import { scoreNoteName } from "@/features/score/pitch";
import { createHymnGuidance } from "@/features/hymns/guidance";
import type { HymnCatalogItem } from "@/features/hymns/types";

interface HymnPreparationGuideProps {
  hymn: HymnCatalogItem;
  assets: HymnAssets;
}

const SUMMARY_LIMIT = 12;
const FINGERING_GROUP_LIMIT = 12;
const FINGERING_PER_GROUP_LIMIT = 24;

const sourceLabels: Record<TeachingSourceStatus, string> = {
  source_confirmed: "原谱确认",
  manual_confirmed: "人工确认",
  auto_candidate: "自动候选",
  unavailable: "不可用",
};

function documentsFromAssets(assets: HymnAssets): {
  score: PianoScoreDocument;
  arrangement: PianoArrangementDocument;
} | null {
  if (assets.status === "structured") {
    return { score: assets.score, arrangement: assets.arrangement };
  }
  if (assets.status === "image" && assets.score && assets.arrangement) {
    return { score: assets.score, arrangement: assets.arrangement };
  }
  return null;
}

function statusPresentation(
  arrangement: PianoArrangementDocument | undefined,
): { title: string; badge: string; green: boolean } {
  if (!arrangement) {
    return {
      title: "结构化教学不可用",
      badge: "图片谱回退",
      green: false,
    };
  }
  const statuses = [
    ...arrangement.fingerings.map((item) => item.status),
    ...arrangement.positions.map((item) => item.status),
    ...arrangement.chords.map((item) => item.status),
  ];
  if (statuses.includes("manual_confirmed")) {
    return {
      title: "人工确认与逐曲候选协同",
      badge: "含人工确认",
      green: true,
    };
  }
  if (statuses.includes("source_confirmed")) {
    return {
      title: "原谱确认的逐曲教学方案",
      badge: "原谱确认",
      green: true,
    };
  }
  return {
    title: "逐曲自动编配，使用前请复核",
    badge: "PPTX + 乐句规则候选",
    green: false,
  };
}

function toneSummary(
  tones: PianoArrangementDocument["chords"][number]["tones"],
): string {
  return tones.map((tone) => `${tone.note}·${tone.finger}`).join(" · ");
}

interface FingeringDetail {
  eventId: string;
  note: string;
  keyName: string;
  assignment: FingerAssignment;
}

interface FingeringGroup {
  id: string;
  label: string;
  total: number;
  items: FingeringDetail[];
}

function noteLabel(note: ScoreNoteEvent): string {
  const accidental =
    note.accidental === "sharp"
      ? "♯"
      : note.accidental === "flat"
        ? "♭"
        : note.accidental === "natural"
          ? "♮"
          : "";
  const octave =
    note.octave > 0
      ? "̇".repeat(note.octave)
      : "̣".repeat(Math.abs(note.octave));
  return `${accidental}${note.degree}${octave}`;
}

function buildFingeringGroups(
  score: PianoScoreDocument,
  arrangement: PianoArrangementDocument,
): FingeringGroup[] {
  const assignmentByEvent = new Map(
    arrangement.fingerings.map((assignment) => [
      assignment.event_id,
      assignment,
    ]),
  );
  const groups: FingeringGroup[] = [];
  let systemNumber = 0;

  for (const page of score.pages) {
    for (const system of page.systems) {
      systemNumber += 1;
      const details = system.measures.flatMap((measure) =>
        measure.events.flatMap((event): FingeringDetail[] => {
          if (event.kind !== "note") return [];
          const assignment = assignmentByEvent.get(event.id);
          if (!assignment) return [];
          return [
            {
              eventId: event.id,
              note: noteLabel(event),
              keyName: scoreNoteName(
                event,
                score.key_signature?.value ?? null,
              ),
              assignment,
            },
          ];
        }),
      );
      if (details.length === 0) continue;
      groups.push({
        id: system.id,
        label: `第 ${systemNumber} 谱行`,
        total: details.length,
        items: details.slice(0, FINGERING_PER_GROUP_LIMIT),
      });
    }
  }

  return groups;
}

export function HymnPreparationGuide({
  hymn,
  assets,
}: HymnPreparationGuideProps) {
  const guidance = createHymnGuidance(hymn, assets);
  const documents = documentsFromAssets(assets);
  const arrangement = documents?.arrangement;
  const faithfulOnly = assets.status === "faithful";
  const presentation = faithfulOnly
    ? {
        title: "结构化教学不可用",
        badge: "PPT 原版谱",
        green: false,
      }
    : statusPresentation(arrangement);
  const positions = arrangement?.positions.slice(0, SUMMARY_LIMIT) ?? [];
  const moves = arrangement?.moves.slice(0, SUMMARY_LIMIT) ?? [];
  const chords = arrangement?.chords.slice(0, SUMMARY_LIMIT) ?? [];
  const allFingeringGroups =
    documents && arrangement
      ? buildFingeringGroups(documents.score, arrangement)
      : [];
  const fingeringGroups = allFingeringGroups.slice(0, FINGERING_GROUP_LIMIT);
  const missingTitle = faithfulOnly
    ? "当前显示 PPT 原版谱面"
    : "当前仅显示同版本图片谱";
  const missingText = faithfulOnly
    ? "本调暂无可用于指法、手位与和弦分析的独立结构化教学数据。"
    : guidance.fallback_reason ?? "暂无结构化教学数据。";

  return (
    <section className="paper-panel hymn-prep">
      <div className="section-heading">
        <div>
          <p className="eyebrow">曲目预备方案</p>
          <h2>{presentation.title}</h2>
        </div>
        <span
          className={
            presentation.green
              ? "status-badge status-badge--green"
              : "status-badge status-badge--amber"
          }
        >
          {presentation.badge}
        </span>
      </div>

      {guidance.available ? (
        <p className="lead-copy">
          本曲从结构化谱面读取 {guidance.stats.note_count} 个音符，并按实际
          乐句生成指法、手位与和声。自动候选不是原谱事实，聚会使用前仍需复核。
        </p>
      ) : (
        <MissingBlock
          title={missingTitle}
          text={missingText}
        />
      )}

      <div className="prep-overview">
        <article>
          <span>调号</span>
          <strong>{guidance.key_signature ?? "未可靠识别"}</strong>
        </article>
        <article>
          <span>拍号</span>
          <strong>{guidance.meter ?? "未可靠识别"}</strong>
        </article>
        <article>
          <span>旋律音域</span>
          <strong>{guidance.melody_range?.summary ?? "结构化谱面不可用"}</strong>
        </article>
        <article>
          <span>指法覆盖</span>
          <strong>
            {guidance.stats.fingering_count} / {guidance.stats.note_count} 个音符
          </strong>
        </article>
      </div>

      {arrangement && (
        <>
          <div className="prep-section fingering-detail-section">
            <div className="prep-section__heading">
              <Music2 size={19} aria-hidden="true" />
              <h3>逐音指法明细</h3>
              <span>默认折叠 · 谱面仍显示全部指法</span>
            </div>
            <div className="fingering-detail-list">
              {fingeringGroups.map((group) => (
                <details className="fingering-detail-group" key={group.id}>
                  <summary>
                    <strong>
                      {group.label} · {group.total} 个音符
                    </strong>
                    <span>展开查看</span>
                  </summary>
                  <ol>
                    {group.items.map((item) => (
                      <li data-event-id={item.eventId} key={item.eventId}>
                        <span className="fingering-detail__pitch">
                          <span className="fingering-detail__note">
                            {item.note}
                          </span>
                          <small>{item.keyName}</small>
                        </span>
                        <strong>{item.assignment.finger} 指</strong>
                        <p>{item.assignment.reason}</p>
                        <small>{sourceLabels[item.assignment.status]}</small>
                      </li>
                    ))}
                  </ol>
                  {group.total > group.items.length && (
                    <p className="prep-summary-note">
                      本谱行其余 {group.total - group.items.length} 个指法请在
                      SVG 谱面逐音查看。
                    </p>
                  )}
                </details>
              ))}
            </div>
            {allFingeringGroups.length > fingeringGroups.length && (
              <p className="prep-summary-note">
                此处展示前 {FINGERING_GROUP_LIMIT} 个谱行；全部逐音指法仍在
                SVG 谱面中完整显示。
              </p>
            )}
          </div>

          <div className="prep-section">
            <div className="prep-section__heading">
              <Music2 size={19} aria-hidden="true" />
              <h3>右手手位与换位</h3>
              <span>
                {arrangement.positions.length} 个区段 · {arrangement.moves.length} 次提示
              </span>
            </div>
            <div className="position-plan-grid">
              {positions.map((position) => (
                <article className="position-plan-card" key={position.id}>
                  <div>
                    <strong>{position.label}</strong>
                    <span>{sourceLabels[position.status]}</span>
                  </div>
                  <p className="finger-note-row">
                    {Object.entries(position.finger_notes)
                      .map(([finger, note]) => `${finger} 指 ${note}`)
                      .join(" · ")}
                  </p>
                  <p>{position.reason}</p>
                </article>
              ))}
            </div>
            {moves.length > 0 && (
              <div className="move-plan-list" aria-label="换位提示">
                {moves.map((move) => (
                  <p key={move.id}>
                    <strong>{move.instruction}</strong>
                    <span>{move.reason}</span>
                  </p>
                ))}
              </div>
            )}
            {arrangement.positions.length > SUMMARY_LIMIT && (
              <p className="prep-summary-note">
                此处展示前 {SUMMARY_LIMIT} 个手位区段；全部逐音指法与换位已直接标在 SVG 谱面。
              </p>
            )}
          </div>

          <div className="prep-section">
            <div className="prep-section__heading">
              <CheckCircle2 size={19} aria-hidden="true" />
              <h3>和弦与左手逐音手指</h3>
              <span>{arrangement.chords.length} 个和弦锚点</span>
            </div>
            {chords.length > 0 ? (
              <div className="left-hand-chord-grid">
                {chords.map((chord) => (
                  <article key={chord.id}>
                    <div className="chord-card__heading">
                      <span>{chord.symbol}</span>
                      <small>
                        {chord.function} · {chord.inversion} · {sourceLabels[chord.status]}
                      </small>
                    </div>
                    <strong>{toneSummary(chord.tones)}</strong>
                    <p>{chord.reason}</p>
                    {chord.evidence[0] && <em>{chord.evidence[0]}</em>}
                  </article>
                ))}
              </div>
            ) : (
              <MissingBlock
                title="和声候选不可用"
                text="调号未可靠确认，因此平台没有写出虚假的和弦音名。"
              />
            )}
            {arrangement.chords.length > SUMMARY_LIMIT && (
              <p className="prep-summary-note">
                此处展示前 {SUMMARY_LIMIT} 个和弦；全部和弦锚点已在 SVG 谱面显示。
              </p>
            )}
          </div>

          <div className="prep-recommendation-grid">
            <RecommendationCard title="左手伴奏型" value={arrangement.accompaniment} />
            <RecommendationCard title="前奏" value={arrangement.intro} />
            <RecommendationCard title="段间衔接" value={arrangement.interlude} />
            <RecommendationCard title="尾奏" value={arrangement.ending} />
          </div>
        </>
      )}
    </section>
  );
}

function RecommendationCard({
  title,
  value,
}: {
  title: string;
  value: PianoArrangementDocument["intro"];
}) {
  return (
    <article>
      <div>
        <h3>{title}</h3>
        <span>{sourceLabels[value.status]}</span>
      </div>
      <strong>{value.text}</strong>
      <p>{value.reason}</p>
    </article>
  );
}

function MissingBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="prep-missing">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}
