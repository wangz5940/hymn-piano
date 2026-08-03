import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Library,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HymnCard } from "@/components/HymnCard";
import { PageHeader } from "@/components/PageHeader";
import { hymnCatalog } from "@/data/hymns.generated";
import {
  buildLearningPath,
  LEARNING_STAGES,
  type LearningStageId,
} from "@/features/hymns/recommendations";
import { useAppStore } from "@/store/useAppStore";

const PAGE_SIZE = 36;

export function HymnRecommendationsPage() {
  const learningPath = useMemo(() => buildLearningPath(hymnCatalog), []);
  const [stageId, setStageId] = useState<LearningStageId>(
    LEARNING_STAGES[0].id,
  );
  const [page, setPage] = useState(1);
  const progress = useAppStore((state) => state.progress);
  const serviceItems = useAppStore((state) => state.service_set.items);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const addToServiceSet = useAppStore((state) => state.addToServiceSet);
  const favoriteKeys = useMemo(
    () => new Set(progress.favorite_hymn_keys),
    [progress.favorite_hymn_keys],
  );
  const serviceKeys = useMemo(
    () => new Set(serviceItems.map((item) => item.hymn_key)),
    [serviceItems],
  );
  const stage = learningPath.find((item) => item.id === stageId)!;
  const totalPages = Math.max(
    1,
    Math.ceil(stage.hymns.length / PAGE_SIZE),
  );
  const pageItems = stage.hymns.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const selectStage = (nextStageId: LearningStageId) => {
    setStageId(nextStageId);
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="651 首已分析 · 7 阶学习曲线"
        title="先把 C 大调弹熟，再认识其他调"
        description="推荐顺序综合原调、拍号和整首手位变换次数。先在白键上建立稳定感，再逐步增加换位、拍号与黑键。"
        actions={
          <Link className="button button--secondary" to="/hymns">
            <Library size={17} aria-hidden="true" />
            查看编号曲库
          </Link>
        }
      />

      <section
        className="learning-path-summary"
        aria-label="推荐学习顺序"
      >
        <div>
          <span>01</span>
          <strong>只弹 C 大调</strong>
          <small>先认熟全部白键</small>
        </div>
        <ArrowRight size={18} aria-hidden="true" />
        <div>
          <span>02</span>
          <strong>逐步增加换位</strong>
          <small>从 0–2 次到 5 次以上</small>
        </div>
        <ArrowRight size={18} aria-hidden="true" />
        <div>
          <span>03</span>
          <strong>再进入其他调</strong>
          <small>先少换位，再综合进阶</small>
        </div>
      </section>

      <div
        className="recommendation-stage-tabs"
        role="tablist"
        aria-label="学习难度阶段"
      >
        {learningPath.map((item) => (
          <button
            key={item.id}
            className={`recommendation-stage-tab${
              item.id === stageId
                ? " recommendation-stage-tab--active"
                : ""
            }`}
            type="button"
            role="tab"
            aria-selected={item.id === stageId}
            aria-controls={`learning-stage-${item.id}`}
            onClick={() => selectStage(item.id)}
          >
            <span>{String(item.order).padStart(2, "0")}</span>
            <strong>{item.shortTitle}</strong>
            <small>{item.hymns.length} 首</small>
          </button>
        ))}
      </div>

      <section
        className="recommendation-stage-panel"
        id={`learning-stage-${stage.id}`}
        role="tabpanel"
        aria-label={stage.title}
      >
        <header>
          <div>
            <p className="eyebrow">阶段 {stage.order}</p>
            <h2>{stage.title}</h2>
            <p>{stage.description}</p>
          </div>
          <div className="recommendation-stage-panel__criteria">
            <span>筛选标准</span>
            <strong>{stage.criteria}</strong>
          </div>
        </header>

        <div className="result-bar">
          <p>
            本阶段 <strong>{stage.hymns.length}</strong> 首
          </p>
          <span>
            第 {page} / {totalPages} 页
          </span>
        </div>

        <div className="hymn-grid" aria-label={`${stage.title}推荐诗歌`}>
          {pageItems.map((hymn) => (
            <HymnCard
              key={hymn.key}
              hymn={hymn}
              isFavorite={favoriteKeys.has(hymn.key)}
              isInServiceSet={serviceKeys.has(hymn.key)}
              onToggleFavorite={toggleFavorite}
              onAddToServiceSet={addToServiceSet}
              showLearningProfile
            />
          ))}
        </div>

        {totalPages > 1 && (
          <nav className="pagination" aria-label="推荐诗歌分页">
            <button
              className="button button--secondary button--small"
              type="button"
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              上一页
            </button>
            <span>
              每页 {PAGE_SIZE} 首 · 共 {stage.hymns.length} 首
            </span>
            <button
              className="button button--secondary button--small"
              type="button"
              disabled={page === totalPages}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
            >
              下一页
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
