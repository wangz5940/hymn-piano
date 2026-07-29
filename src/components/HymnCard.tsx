import { BookOpen, Check, Heart, ListPlus } from "lucide-react";
import { Link } from "react-router-dom";
import type { HymnCatalogItem } from "@/features/hymns/types";

interface HymnCardProps {
  hymn: HymnCatalogItem;
  isFavorite: boolean;
  isInServiceSet: boolean;
  onToggleFavorite: (hymnKey: string) => void;
  onAddToServiceSet: (hymnKey: string) => void;
}

export function HymnCard({
  hymn,
  isFavorite,
  isInServiceSet,
  onToggleFavorite,
  onAddToServiceSet,
}: HymnCardProps) {
  return (
    <article className="hymn-card">
      <div className="hymn-card__number" aria-label={`诗歌编号 ${hymn.key}`}>
        <span>{hymn.number}</span>
        {hymn.variant && <small>{hymn.variant}</small>}
      </div>
      <div className="hymn-card__body">
        <div className="hymn-card__title-row">
          <h2>{hymn.title}</h2>
          {hymn.is_alternate_tune && (
            <span className="status-badge status-badge--amber">第二调</span>
          )}
        </div>
        <p>选本诗歌 · 本地歌谱</p>
        <div className="hymn-card__actions">
          <Link className="button button--primary button--small" to={`/practice/${hymn.key}`}>
            <BookOpen size={16} aria-hidden="true" />
            打开练习
          </Link>
          <button
            className="icon-button"
            type="button"
            aria-label={isFavorite ? `取消收藏第 ${hymn.key} 首` : `收藏第 ${hymn.key} 首`}
            aria-pressed={isFavorite}
            onClick={() => onToggleFavorite(hymn.key)}
          >
            <Heart
              size={17}
              fill={isFavorite ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={
              isInServiceSet
                ? `第 ${hymn.key} 首已在曲单`
                : `把第 ${hymn.key} 首加入曲单`
            }
            disabled={isInServiceSet}
            onClick={() => onAddToServiceSet(hymn.key)}
          >
            {isInServiceSet ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <ListPlus size={17} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
