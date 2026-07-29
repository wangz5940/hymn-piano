import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  ListPlus,
  ShieldCheck,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Metronome } from "@/components/Metronome";
import { MidiStatus } from "@/components/MidiStatus";
import { HymnPreparationGuide } from "@/components/HymnPreparationGuide";
import { PracticeRecorder } from "@/components/PracticeRecorder";
import { ScoreViewer } from "@/components/ScoreViewer";
import { hymnCatalog } from "@/data/hymns.generated";
import { findHymn } from "@/features/hymns/catalog";
import { useHymnAssets } from "@/hooks/useHymnAssets";
import { useAppStore } from "@/store/useAppStore";

export function PracticePage() {
  const { hymnKey = "" } = useParams();
  const hymn = findHymn(hymnCatalog, hymnKey);
  const progress = useAppStore((state) => state.progress);
  const serviceItems = useAppStore((state) => state.service_set.items);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const addToServiceSet = useAppStore((state) => state.addToServiceSet);
  const rememberHymn = useAppStore((state) => state.rememberHymn);
  const { assets, retry, useImageFallback } = useHymnAssets(hymn);

  useEffect(() => {
    if (hymn) rememberHymn(hymn.key);
  }, [hymn, rememberHymn]);

  if (!hymn) {
    return (
      <div className="page">
        <section className="empty-state empty-state--large">
          <ShieldCheck size={36} aria-hidden="true" />
          <h1>没有找到这份歌谱</h1>
          <p>曲库编号可能已改变，或链接不完整。</p>
          <Link className="button button--primary" to="/hymns">
            <ArrowLeft size={17} aria-hidden="true" />
            回到诗歌曲库
          </Link>
        </section>
      </div>
    );
  }

  const isFavorite = progress.favorite_hymn_keys.includes(hymn.key);
  const isInSet = serviceItems.some((item) => item.hymn_key === hymn.key);

  return (
    <div className="page page--practice">
      <header className="practice-header">
        <div>
          <Link className="back-link" to="/hymns">
            <ArrowLeft size={16} aria-hidden="true" />
            返回曲库
          </Link>
          <p className="eyebrow">
            选本诗歌 · 第 {hymn.key} 首
            {hymn.is_alternate_tune ? " · 第二调" : ""}
          </p>
          <h1>{hymn.title}</h1>
          <p>
            优先按 PPTX 原坐标显示第一段歌词与歌谱；结构化数据继续用于逐音
            指法、手位与左手和弦分析，来源不可用时才回退同版本图片谱。
          </p>
        </div>
        <div className="practice-header__actions">
          <button
            className="button button--secondary"
            type="button"
            aria-pressed={isFavorite}
            onClick={() => toggleFavorite(hymn.key)}
          >
            <Heart
              size={17}
              fill={isFavorite ? "currentColor" : "none"}
              aria-hidden="true"
            />
            {isFavorite ? "已收藏" : "收藏"}
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={isInSet}
            onClick={() => addToServiceSet(hymn.key)}
          >
            {isInSet ? (
              <CheckCircle2 size={17} aria-hidden="true" />
            ) : (
              <ListPlus size={17} aria-hidden="true" />
            )}
            {isInSet ? "已在曲单" : "加入曲单"}
          </button>
        </div>
      </header>

      <div className="practice-layout">
        <ScoreViewer
          hymn={hymn}
          assets={assets}
          onRetry={retry}
          onUseImageFallback={useImageFallback}
        />
        <aside className="practice-sidebar">
          <PracticeRecorder hymnKey={hymn.key} />
          <Metronome />
          <MidiStatus />
        </aside>
      </div>

      <HymnPreparationGuide hymn={hymn} assets={assets} />
    </div>
  );
}
