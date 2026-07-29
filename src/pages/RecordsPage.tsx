import {
  CalendarCheck2,
  Clock3,
  Flame,
  Music2,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { hymnCatalog } from "@/data/hymns.generated";
import { calculateStatistics } from "@/features/progress/statistics";
import type { SelfRating } from "@/features/progress/types";
import { useAppStore } from "@/store/useAppStore";

const ratingLabels: Record<keyof SelfRating, string> = {
  continuity: "连续性",
  pulse: "节拍",
  left_hand: "左手",
  melody: "旋律",
  leadership: "配合",
};

export function RecordsPage() {
  const records = useAppStore((state) => state.records);
  const clearRecords = useAppStore((state) => state.clearPracticeRecords);
  const statistics = calculateStatistics(records);
  const hymnsByKey = new Map(hymnCatalog.map((hymn) => [hymn.key, hymn]));

  const confirmClear = () => {
    if (window.confirm("确定清除全部练习记录吗？课程进度和收藏不会被删除。")) {
      clearRecords();
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="练习复盘"
        title="记录问题，不记录模糊的努力"
        description="每次只留下一个最明显的问题和一个下一步目标。长期趋势比单次分数更能说明服侍预备是否可靠。"
        actions={
          records.length > 0 ? (
            <button className="button button--danger" type="button" onClick={confirmClear}>
              <Trash2 size={17} aria-hidden="true" />
              清除记录
            </button>
          ) : undefined
        }
      />

      <section className="metric-grid metric-grid--four">
        <MetricCard
          icon={Clock3}
          label="累计练习"
          value={`${statistics.total_minutes} 分`}
          detail={`本周 ${statistics.week_minutes} 分`}
        />
        <MetricCard
          icon={Music2}
          label="已练诗歌"
          value={`${statistics.practiced_hymns} 首`}
          detail="同曲不同调只计一份歌谱"
          tone="ink"
        />
        <MetricCard
          icon={Flame}
          label="连续练习"
          value={`${statistics.streak_days} 天`}
          detail="昨天或今天有练习才延续"
          tone="amber"
        />
        <MetricCard
          icon={CalendarCheck2}
          label="练习次数"
          value={`${records.length} 次`}
          detail="每次包含问题与下次目标"
        />
      </section>

      {records.length > 0 ? (
        <div className="records-layout">
          <section className="paper-panel skill-chart">
            <div className="section-heading">
              <div>
                <p className="eyebrow">五项能力平均</p>
                <h2>哪里最需要下一轮训练</h2>
              </div>
              <TrendingUp size={22} aria-hidden="true" />
            </div>
            <div className="rating-chart">
              {(Object.keys(ratingLabels) as (keyof SelfRating)[]).map((key) => {
                const value = statistics.average_rating[key];
                return (
                  <div key={key}>
                    <span>{ratingLabels[key]}</span>
                    <div className="progress-track">
                      <span style={{ width: `${(value / 5) * 100}%` }} />
                    </div>
                    <strong>{value.toFixed(1)}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="paper-panel records-list-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">最近记录</p>
                <h2>问题与下一步</h2>
              </div>
              <span>{records.length} 条</span>
            </div>
            <div className="records-list">
              {records.map((record) => {
                const hymn = hymnsByKey.get(record.hymn_key);
                return (
                  <article key={record.id} className="record-item">
                    <div className="record-item__date">
                      <strong>
                        {new Intl.DateTimeFormat("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                        }).format(new Date(record.started_at))}
                      </strong>
                      <span>
                        {Math.max(1, Math.round(record.duration_seconds / 60))} 分
                      </span>
                    </div>
                    <div>
                      <p>
                        第 {record.hymn_key} 首
                        <span> · {record.practice_key} 调 · {record.target_bpm} BPM</span>
                      </p>
                      <h3>{hymn?.title ?? "曲库歌谱"}</h3>
                      <dl>
                        <div>
                          <dt>问题</dt>
                          <dd>{record.issue || "本次未填写"}</dd>
                        </div>
                        <div>
                          <dt>下次</dt>
                          <dd>{record.next_goal || "继续保持完整演奏"}</dd>
                        </div>
                      </dl>
                    </div>
                    <Link className="text-link" to={`/practice/${record.hymn_key}`}>
                      再练一次
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <section className="empty-state empty-state--large">
          <TrendingUp size={34} aria-hidden="true" />
          <h2>完成第一次诗歌练习后，这里会形成趋势</h2>
          <p>从任意一首歌开始计时，保存五项自评、问题和下次目标。</p>
          <Link className="button button--primary" to="/hymns">
            打开诗歌曲库
          </Link>
        </section>
      )}
    </div>
  );
}
