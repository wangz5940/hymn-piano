import {
  Expand,
  Maximize2,
  RotateCw,
  Settings2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import type { HymnCatalogItem } from "@/features/hymns/types";
import type { ScoreDisplayLayer } from "@/features/score/display-preferences";
import type { HymnAssets } from "@/features/score/loadHymnAssets";
import { PptScore } from "@/features/score/PptScore";
import { ScoreSvg } from "@/features/score/ScoreSvg";
import { useAppStore } from "@/store/useAppStore";

interface ScoreViewerProps {
  hymn: HymnCatalogItem;
  assets: HymnAssets;
  onRetry?: () => void;
  onUseImageFallback?: () => void;
}

const displayOptions: Array<{
  layer: ScoreDisplayLayer;
  label: string;
  description: string;
}> = [
  {
    layer: "positions",
    label: "手位",
    description: "显示每句的固定手位与换位提示",
  },
  {
    layer: "fingerings",
    label: "指法",
    description: "显示右手逐音指法标记",
  },
  {
    layer: "noteNames",
    label: "键位",
    description: "在每个旋律音下显示实际琴键与八度",
  },
  {
    layer: "chords",
    label: "左手和弦",
    description: "在对应谱行下显示和弦与左手指法",
  },
  {
    layer: "lyrics",
    label: "歌词",
    description: "显示与当前谱行对应的第一段歌词",
  },
];

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const viewerRef = useRef<HTMLElement>(null);
  const settingsId = `score-display-settings-${useId().split(":").join("")}`;
  const scoreDisplay = useAppStore((state) => state.score_display);
  const setScoreDisplayLayer = useAppStore(
    (state) => state.setScoreDisplayLayer,
  );

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
  const hasTeachingLayers =
    assets.status === "structured" || assets.status === "faithful";
  const scoreMetadata =
    assets.status === "structured" || assets.status === "faithful"
      ? assets.score
      : assets.status === "image"
        ? assets.score
        : undefined;
  const metadataPending = assets.status === "loading";
  const originalKey = metadataPending
    ? "读取中"
    : scoreMetadata?.key_signature?.value
      ? `1 = ${scoreMetadata.key_signature.value}`
      : "未标明";
  const originalMeter = metadataPending
    ? "读取中"
    : scoreMetadata?.meter?.value
      ? `${scoreMetadata.meter.value} 拍`
      : "未标明";

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
          <div
            className="score-viewer__metadata"
            aria-label="原曲调性与节拍"
          >
            <span>
              原调 <b>{originalKey}</b>
            </span>
            <span>
              节拍 <b>{originalMeter}</b>
            </span>
          </div>
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
          <button
            className="toolbar-settings-button"
            type="button"
            aria-label="教学标记设置"
            aria-expanded={settingsOpen}
            aria-controls={settingsId}
            disabled={!hasTeachingLayers}
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <Settings2 size={18} aria-hidden="true" />
            <span>标记设置</span>
          </button>
        </div>
      </header>

      {hasTeachingLayers && settingsOpen && (
        <fieldset
          className="score-viewer__settings"
          id={settingsId}
        >
          <legend>教学标记显示</legend>
          <div className="score-viewer__settings-body">
            <p>设置会保存在本机，并应用到所有诗歌。</p>
            <div className="score-display-options">
              {displayOptions.map(({ layer, label, description }) => (
                <label className="score-display-option" key={layer}>
                  <span className="score-display-option__copy">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`显示${label}`}
                    checked={scoreDisplay[layer]}
                    onChange={(event) =>
                      setScoreDisplayLayer(layer, event.currentTarget.checked)
                    }
                  />
                  <span
                    className="score-display-option__switch"
                    aria-hidden="true"
                  />
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      )}

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
                visibility={scoreDisplay}
              />
            ) : (
              <ScoreSvg
                className="score-svg"
                score={assets.score}
                arrangement={assets.arrangement}
                visibility={scoreDisplay}
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
              score={assets.score}
              arrangement={assets.arrangement}
              visibility={scoreDisplay}
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
