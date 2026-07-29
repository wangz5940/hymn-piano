import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  Music2,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { curriculum } from "@/data/curriculum";
import { hymnCatalog } from "@/data/hymns.generated";
import { calculateStatistics } from "@/features/progress/statistics";
import type { PracticeKind } from "@/features/curriculum/types";
import { MetricCard } from "@/components/MetricCard";
import { useAppStore } from "@/store/useAppStore";

const kindLabels: Record<PracticeKind, string> = {
  warmup: "热身",
  method: "方法",
  accompaniment: "伴奏",
  repertoire: "曲目",
  sight_reading: "视奏",
  service_simulation: "模拟",
};

export function DashboardPage() {
  const progress = useAppStore((state) => state.progress);
  const records = useAppStore((state) => state.records);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const advancePracticeDay = useAppStore(
    (state) => state.advancePracticeDay,
  );
  const week = curriculum[progress.current_week - 1];
  const day = week.days[progress.current_day - 1];
  const completedIds = new Set(
    progress.completed_tasks.map((completion) => completion.task_id),
  );
  const completedCount = day.tasks.filter((task) =>
    completedIds.has(task.id),
  ).length;
  const allCompleted = completedCount === day.tasks.length;
  const statistics = calculateStatistics(records);
  const suggestedNumber = week.hymn_numbers[0];
  const suggestedHymn = hymnCatalog.find(
    (hymn) => hymn.number === suggestedNumber && hymn.variant === "",
  );
  const coursePercent = Math.round((progress.current_week / 48) * 100);

  return (
    <div className="page page--dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero__copy">
          <p className="eyebrow">
            第 {progress.current_week} 周 · 第 {progress.current_day} 次
          </p>
          <h1>
            今天，把手放稳，
            <br />
            再让诗歌向前。
          </h1>
          <p>{week.capability}</p>
          <div className="dashboard-hero__actions">
            {suggestedHymn ? (
              <Link
                className="button button--paper"
                to={`/practice/${suggestedHymn.key}`}
              >
                <Music2 size={18} aria-hidden="true" />
                练习第 {suggestedHymn.key} 首
              </Link>
            ) : (
              <Link className="button button--paper" to="/hymns">
                打开诗歌曲库
              </Link>
            )}
            <Link className="text-link text-link--light" to="/course">
              查看 48 周路径
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="course-progress-card">
          <span>全课程进度</span>
          <strong>{coursePercent}%</strong>
          <div className="progress-track progress-track--light">
            <span style={{ width: `${coursePercent}%` }} />
          </div>
          <p>
            阶段 {week.phase_id.replace("phase-", "")} / 8 · {week.phase_title}
          </p>
        </div>
      </section>

      <section className="metric-grid" aria-label="练习概览">
        <MetricCard
          icon={Flame}
          label="连续练习"
          value={`${statistics.streak_days} 天`}
          detail="稳定比突击更重要"
          tone="amber"
        />
        <MetricCard
          icon={Clock3}
          label="本周投入"
          value={`${statistics.week_minutes} 分`}
          detail="目标 180 分钟"
        />
        <MetricCard
          icon={Target}
          label="已练诗歌"
          value={`${statistics.practiced_hymns} 首`}
          detail="从会弹走向会预备"
          tone="ink"
        />
      </section>

      <div className="dashboard-grid">
        <section className="paper-panel today-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{day.focus}</p>
              <h2>{week.title}</h2>
            </div>
            <span className="duration-badge">
              <Clock3 size={15} aria-hidden="true" />
              60 分钟
            </span>
          </div>

          <div className="task-list">
            {day.tasks.map((task, index) => {
              const isCompleted = completedIds.has(task.id);
              return (
                <article
                  key={task.id}
                  className={`practice-task${isCompleted ? " practice-task--done" : ""}`}
                >
                  <span className="practice-task__index">
                    {isCompleted ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <div>
                    <span className="task-kind">{kindLabels[task.kind]}</span>
                    <h3>{task.title}</h3>
                    <p>{task.objective}</p>
                  </div>
                  <div className="practice-task__end">
                    <span>{task.minutes} 分</span>
                    <button
                      className={
                        isCompleted
                          ? "button button--quiet button--small"
                          : "button button--secondary button--small"
                      }
                      type="button"
                      onClick={() => toggleTask(task.id)}
                    >
                      {isCompleted ? "已完成" : "标记完成"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="today-panel__footer">
            <p>
              今日 {completedCount} / {day.tasks.length} 项
            </p>
            <button
              className="button button--primary"
              type="button"
              disabled={!allCompleted}
              onClick={advancePracticeDay}
            >
              {progress.current_week === 48 && progress.current_day === 3
                ? "课程已完成"
                : "进入下一次练习"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </section>

        <aside className="dashboard-aside">
          <section className="paper-panel focus-card">
            <CalendarDays size={22} aria-hidden="true" />
            <p className="eyebrow">本周通过标准</p>
            <h2>做到，再向前</h2>
            <ul className="check-list">
              {week.pass_criteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </section>
          <section className="quote-card">
            <p>“少量错音，不要让整首诗歌停下来。”</p>
            <span>本周服侍提醒</span>
          </section>
        </aside>
      </div>
    </div>
  );
}
