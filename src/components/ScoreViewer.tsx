import {
  Expand,
  Maximize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRef, useState } from "react";
import type { HymnCatalogItem } from "@/features/hymns/types";
import type { HymnAssets } from "@/features/score/loadHymnAssets";
import { PptScore } from "@/features/score/PptScore";
import { ScoreSvg } from "@/features/score/ScoreSvg";

interface ScoreViewerProps {
  hymn: HymnCatalogItem;
  assets: HymnAssets;
  onRetry?: () => void;
  onUseImageFallback?: () => void;
}

export function ScoreViewer({
  hymn,
  assets,
  onRetry,
  onUseImageFallback,
}: ScoreViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const viewerRef = useRef<HTMLElement>(null);

  const enterFullscreen = () => {
    void viewerRef.current?.requestFullscreen?.();
  };

  const frameStyle = {
    width: `${zoom}%`,
    transform: `rotate(${rotation}deg)`,
  };
  const hasFaithfulRender =
    assets.status === "faithful" ||
    (assets.status === "structured" && Boolean(assets.render));

  return (
    <section className="score-viewer" ref={viewerRef} aria-label="歌谱查看器">
      <header className="score-viewer__toolbar">
        <div>
          <strong>
            第 {hymn.key} 首 · {hymn.title}
          </strong>
          <span>
            {hasFaithfulRender
              ? "PPT 原版谱 · 第一段"
              : assets.status === "structured"
                ? "SVG 教学谱"
                : "图片谱"}{" "}
            · {zoom}%
          </span>
        </div>
        <div className="toolbar-actions" aria-label="歌谱显示控制">
          <button
            className="icon-button"
            type="button"
            aria-label="缩小歌谱"
            disabled={zoom <= 50}
            onClick={() => setZoom((value) => Math.max(50, value - 25))}
          >
            <ZoomOut size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="放大歌谱"
            disabled={zoom >= 250}
            onClick={() => setZoom((value) => Math.min(250, value + 25))}
          >
            <ZoomIn size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="适合宽度"
            onClick={() => setZoom(100)}
          >
            <Expand size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="顺时针旋转歌谱"
            onClick={() => setRotation((value) => (value + 90) % 360)}
          >
            <RotateCw size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="全屏查看歌谱"
            onClick={enterFullscreen}
          >
            <Maximize2 size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="score-viewer__canvas">
        {assets.status === "loading" && (
          <div className="score-skeleton" aria-label="歌谱加载中">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}

        {assets.status === "error" && (
          <div className="score-error" role="alert">
            <strong>结构化谱面未能加载</strong>
            <p>{assets.message}</p>
            <div className="score-error__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={onRetry}
              >
                重新加载结构化谱面
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={onUseImageFallback}
              >
                改用图片谱
              </button>
            </div>
          </div>
        )}

        {assets.status === "structured" && (
          <div className="score-document-frame" style={frameStyle}>
            {assets.render && assets.renderVariant !== undefined ? (
              <PptScore
                className="score-ppt"
                document={assets.render}
                variantIndex={assets.renderVariant}
                score={assets.score}
                arrangement={assets.arrangement}
              />
            ) : (
              <ScoreSvg
                className="score-svg"
                score={assets.score}
                arrangement={assets.arrangement}
              />
            )}
          </div>
        )}

        {assets.status === "faithful" && (
          <div className="score-document-frame" style={frameStyle}>
            <PptScore
              className="score-ppt"
              document={assets.render}
              variantIndex={assets.renderVariant}
            />
          </div>
        )}

        {assets.status === "image" && (
          <>
            <p className="score-source-note">{assets.reason}</p>
            {imageFailed ? (
              <div className="score-error" role="alert">
                <strong>歌谱图片未能加载</strong>
                <p>{hymn.filename}</p>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => {
                    setImageFailed(false);
                    setImageAttempt((value) => value + 1);
                  }}
                >
                  重新加载图片
                </button>
              </div>
            ) : (
              <div className="score-document-frame" style={frameStyle}>
                <img
                  key={`${hymn.image_url}-${imageAttempt}`}
                  src={hymn.image_url}
                  alt={`第 ${hymn.key} 首《${hymn.title}》歌谱`}
                  className="score-image"
                  onError={() => setImageFailed(true)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
