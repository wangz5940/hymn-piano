import {
  ChevronLeft,
  ChevronRight,
  Library,
  Search,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { HymnCard } from "@/components/HymnCard";
import { PageHeader } from "@/components/PageHeader";
import { hymnCatalog } from "@/data/hymns.generated";
import { searchHymns } from "@/features/hymns/catalog";
import { useAppStore } from "@/store/useAppStore";

type LibraryFilter = "all" | "favorites" | "recent" | "alternate";

const PAGE_SIZE = 36;

export function HymnLibraryPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const progress = useAppStore((state) => state.progress);
  const serviceItems = useAppStore((state) => state.service_set.items);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const addToServiceSet = useAppStore((state) => state.addToServiceSet);
  const favoriteKeys = useMemo(
    () => new Set(progress.favorite_hymn_keys),
    [progress.favorite_hymn_keys],
  );
  const recentKeys = useMemo(
    () => new Set(progress.recent_hymn_keys),
    [progress.recent_hymn_keys],
  );
  const serviceKeys = useMemo(
    () => new Set(serviceItems.map((item) => item.hymn_key)),
    [serviceItems],
  );

  const results = useMemo(() => {
    const searched = searchHymns(hymnCatalog, deferredQuery);
    if (filter === "favorites") {
      return searched.filter((hymn) => favoriteKeys.has(hymn.key));
    }
    if (filter === "recent") {
      return searched
        .filter((hymn) => recentKeys.has(hymn.key))
        .sort(
          (left, right) =>
            progress.recent_hymn_keys.indexOf(left.key) -
            progress.recent_hymn_keys.indexOf(right.key),
        );
    }
    if (filter === "alternate") {
      return searched.filter((hymn) => hymn.is_alternate_tune);
    }
    return searched;
  }, [
    deferredQuery,
    favoriteKeys,
    filter,
    progress.recent_hymn_keys,
    recentKeys,
  ]);

  useEffect(() => setPage(1), [deferredQuery, filter]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page">
      <PageHeader
        eyebrow="712 个编号 · 747 个歌谱版本"
        title="选本诗歌曲库"
        description="先按编号或标题找到歌谱，再把练习调、速度、伴奏型和服侍备注沉淀下来。"
      />

      <section className="library-toolbar" aria-label="诗歌曲库筛选">
        <label className="search-field">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">搜索诗歌</span>
          <input
            type="search"
            value={query}
            placeholder="输入编号或标题，例如 118、奇异恩典"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="清除搜索"
              onClick={() => setQuery("")}
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </label>
        <div className="filter-chips" role="group" aria-label="曲库范围">
          {(
            [
              ["all", "全部 747"],
              ["favorites", `收藏 ${favoriteKeys.size}`],
              ["recent", "最近练习"],
              ["alternate", "第二调 35"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "filter-chip filter-chip--active" : "filter-chip"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="result-bar">
        <p>
          找到 <strong>{results.length}</strong> 个歌谱版本
          {deferredQuery && <span> · “{deferredQuery}”</span>}
        </p>
        <span>
          第 {page} / {totalPages} 页
        </span>
      </div>

      {pageItems.length > 0 ? (
        <section className="hymn-grid" aria-label="诗歌搜索结果">
          {pageItems.map((hymn) => (
            <HymnCard
              key={hymn.key}
              hymn={hymn}
              isFavorite={favoriteKeys.has(hymn.key)}
              isInServiceSet={serviceKeys.has(hymn.key)}
              onToggleFavorite={toggleFavorite}
              onAddToServiceSet={addToServiceSet}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <Library size={32} aria-hidden="true" />
          <h2>当前范围没有歌谱</h2>
          <p>尝试更短的标题、准确编号，或切换到“全部”。</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            查看全部诗歌
          </button>
        </section>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="曲库分页">
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
            每页 {PAGE_SIZE} 个 · 共 {results.length} 个
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
    </div>
  );
}
