import {
  BookOpenText,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { curriculum, curriculumPhases } from "@/data/curriculum";
import { hymnCatalog } from "@/data/hymns.generated";
import { useAppStore } from "@/store/useAppStore";

export function CoursePage() {
  const currentWeek = useAppStore((state) => state.progress.current_week);
  const initialPhase =
    curriculumPhases.find(
      (phase) =>
        currentWeek >= phase.week_start && currentWeek <= phase.week_end,
    ) ?? curriculumPhases[0];
  const [phaseId, setPhaseId] = useState(initialPhase.id);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const phase = curriculumPhases.find((item) => item.id === phaseId)!;
  const phaseWeeks = useMemo(
    () =>
      curriculum.filter(
        (week) =>
          week.week >= phase.week_start && week.week <= phase.week_end,
      ),
    [phase],
  );
  const week = curriculum[selectedWeek - 1];
  const selectedInPhase =
    selectedWeek >= phase.week_start && selectedWeek <= phase.week_end;
  const visibleWeek = selectedInPhase ? week : phaseWeeks[0];

  const selectPhase = (nextPhaseId: string) => {
    const nextPhase = curriculumPhases.find(
      (item) => item.id === nextPhaseId,
    );
    if (!nextPhase) return;
    setPhaseId(nextPhaseId);
    setSelectedWeek(
      Math.min(
        Math.max(currentWeek, nextPhase.week_start),
        nextPhase.week_end,
      ),
    );
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="48 周 · 144 次练习"
        title="从手位，到聚会中的双手"
        description="每一阶段都以可迁移能力为目标。未达到通过标准时，重复本周比勉强向前更有效。"
      />

      <div className="phase-tabs" role="tablist" aria-label="课程阶段">
        {curriculumPhases.map((item) => {
          const isActive = item.id === phaseId;
          const isComplete = currentWeek > item.week_end;
          return (
            <button
              key={item.id}
              className={`phase-tab${isActive ? " phase-tab--active" : ""}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectPhase(item.id)}
            >
              <span>{String(item.order).padStart(2, "0")}</span>
              <div>
                <strong>{item.title}</strong>
                <small>
                  第 {item.week_start}—{item.week_end} 周
                </small>
              </div>
              {isComplete ? (
                <Check size={17} aria-label="已完成阶段" />
              ) : (
                <ChevronRight size={17} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <section className="course-stage">
        <header className="course-stage__header">
          <div>
            <p className="eyebrow">
              阶段 {phase.order} · {phase.week_end - phase.week_start + 1} 周
            </p>
            <h2>{phase.title}</h2>
            <p>{phase.outcome}</p>
          </div>
          <span className="status-badge status-badge--green">
            {currentWeek > phase.week_end
              ? "已完成"
              : currentWeek >= phase.week_start
                ? "进行中"
                : "未开始"}
          </span>
        </header>

        <div className="week-strip" role="list" aria-label={`${phase.title}周次`}>
          {phaseWeeks.map((item) => {
            const status =
              item.week < currentWeek
                ? "complete"
                : item.week === currentWeek
                  ? "current"
                  : "locked";
            return (
              <button
                key={item.week}
                className={`week-card week-card--${status}${visibleWeek.week === item.week ? " week-card--selected" : ""}`}
                type="button"
                role="listitem"
                onClick={() => setSelectedWeek(item.week)}
              >
                <span>W{String(item.week).padStart(2, "0")}</span>
                <strong>{item.title}</strong>
                <small>
                  {status === "complete"
                    ? "已完成"
                    : status === "current"
                      ? "本周"
                      : "可预览"}
                </small>
                {status === "complete" ? (
                  <Check size={16} aria-hidden="true" />
                ) : status === "locked" ? (
                  <LockKeyhole size={15} aria-hidden="true" />
                ) : (
                  <Circle size={15} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="week-detail-grid">
        <section className="paper-panel week-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">第 {visibleWeek.week} 周能力</p>
              <h2>{visibleWeek.title}</h2>
            </div>
            <span className="duration-badge">
              <Clock3 size={15} aria-hidden="true" />
              3 × 60 分
            </span>
          </div>
          <p className="lead-copy">{visibleWeek.capability}</p>
          <div className="day-summary-grid">
            {visibleWeek.days.map((day) => (
              <article key={day.id} className="day-summary">
                <span>第 {day.day} 次</span>
                <h3>{day.focus}</h3>
                <ol>
                  {day.tasks.map((task) => (
                    <li key={task.id}>
                      {task.title}
                      <small>{task.minutes} 分</small>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>

        <aside className="paper-panel week-materials">
          <p className="eyebrow">本周材料</p>
          <h2>教材与诗歌</h2>
          <ul className="plain-list">
            {visibleWeek.materials.map((material) => (
              <li key={material}>{material}</li>
            ))}
          </ul>
          <div className="suggested-hymns">
            {visibleWeek.hymn_numbers.map((number) => {
              const hymn = hymnCatalog.find(
                (item) => item.number === number && item.variant === "",
              );
              return hymn ? (
                <Link key={number} to={`/practice/${hymn.key}`}>
                  <span>{hymn.number}</span>
                  {hymn.title}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              ) : null;
            })}
          </div>
          <Link className="fingering-course-link" to="/fingering">
            <BookOpenText size={18} aria-hidden="true" />
            <span>
              指法与手位专项
              <small>学习“为什么这样按”</small>
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
