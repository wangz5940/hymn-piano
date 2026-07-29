import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ScoreViewer } from "./ScoreViewer";
import { formatDuration } from "@/hooks/usePracticeTimer";
import { useHymnAssets } from "@/hooks/useHymnAssets";
import type { HymnCatalogItem } from "@/features/hymns/types";
import type { ServiceSetItem } from "@/features/progress/types";

interface ServiceSimulationProps {
  items: readonly ServiceSetItem[];
  hymnsByKey: ReadonlyMap<string, HymnCatalogItem>;
  onClose: () => void;
}

export function ServiceSimulation({
  items,
  hymnsByKey,
  onClose,
}: ServiceSimulationProps) {
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const item = items[index];
  const hymn = item ? hymnsByKey.get(item.hymn_key) : undefined;

  useEffect(() => {
    const interval = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (finished) {
    return (
      <div className="simulation-overlay" role="dialog" aria-modal="true" aria-label="聚会模拟完成">
        <section className="simulation-finished">
          <CheckCircle2 size={48} aria-hidden="true" />
          <p className="eyebrow">本次模拟完成</p>
          <h2>{items.length} 首诗歌已连续走完</h2>
          <p>
            总时长 {formatDuration(seconds)}。回到曲单，把换歌犹豫和入口问题写进衔接备注。
          </p>
          <button className="button button--primary" type="button" onClick={onClose}>
            返回曲单复盘
          </button>
        </section>
      </div>
    );
  }

  if (!item || !hymn) return null;
  const nextItem = items[index + 1];
  const nextHymn = nextItem ? hymnsByKey.get(nextItem.hymn_key) : undefined;

  return (
    <div className="simulation-overlay" role="dialog" aria-modal="true" aria-label="聚会曲单模拟">
      <header className="simulation-header">
        <div>
          <span>
            第 {index + 1} / {items.length} 首
          </span>
          <strong>
            {hymn.number} · {hymn.title}
          </strong>
        </div>
        <div className="simulation-meta">
          <span>{item.practice_key} 调</span>
          <span>{item.bpm} BPM</span>
          <span>{item.count_in}</span>
          <span>
            <Clock3 size={14} aria-hidden="true" />
            {formatDuration(seconds)}
          </span>
        </div>
        <button className="icon-button icon-button--dark" type="button" aria-label="退出模拟" onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="simulation-body">
        <SimulationScore hymn={hymn} />
      </div>

      <footer className="simulation-footer">
        <button
          className="button button--secondary"
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          <ChevronLeft size={17} aria-hidden="true" />
          上一首
        </button>
        <div>
          <span>下一首预备</span>
          <strong>
            {nextHymn
              ? `${nextHymn.number} · ${nextHymn.title}`
              : "本次曲单结束"}
          </strong>
          {nextItem && (
            <small>
              {nextItem.practice_key} 调 · {nextItem.bpm} BPM · {nextItem.count_in}
            </small>
          )}
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => {
            if (index === items.length - 1) setFinished(true);
            else setIndex((value) => value + 1);
          }}
        >
          {index === items.length - 1 ? "完成模拟" : "进入下一首"}
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}

function SimulationScore({ hymn }: { hymn: HymnCatalogItem }) {
  const { assets, retry, useImageFallback } = useHymnAssets(hymn);
  return (
    <ScoreViewer
      hymn={hymn}
      assets={assets}
      onRetry={retry}
      onUseImageFallback={useImageFallback}
    />
  );
}
