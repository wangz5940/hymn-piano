import { useCallback, useEffect, useRef, useState } from "react";
import type { HymnCatalogItem } from "@/features/hymns/types";
import type { HymnAssets, LoadHymnAssetsOptions } from "@/features/score/loadHymnAssets";
import {
  HymnAssetError,
  initialHymnAssets,
  loadHymnAssets,
} from "@/features/score/loadHymnAssets";

export interface UseHymnAssetsResult {
  assets: HymnAssets;
  retry: () => void;
  useImageFallback: () => void;
}

type LoadOptions = Pick<
  LoadHymnAssetsOptions,
  "fetch" | "fontSet" | "measureText" | "hashDocument"
>;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useHymnAssets(
  hymn: HymnCatalogItem | undefined,
  options: LoadOptions = {},
): UseHymnAssetsResult {
  const [assets, setAssets] = useState<HymnAssets>(() =>
    initialHymnAssets(hymn),
  );
  const [retryToken, setRetryToken] = useState(0);
  const requestIdRef = useRef(0);

  const { fetch: fetchImpl, fontSet, measureText, hashDocument } = options;

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!hymn) {
      setAssets({ status: "loading" });
      return;
    }

    const canLoadFaithfulRender = Boolean(
      hymn.render_asset_url &&
        Number.isInteger(hymn.render_variant) &&
        Number(hymn.render_variant) >= 0,
    );
    if (hymn.score_source !== "pptx" && !canLoadFaithfulRender) {
      setAssets(initialHymnAssets(hymn));
      return;
    }

    setAssets({ status: "loading" });
    const controller = new AbortController();

    loadHymnAssets(hymn, {
      fetch: fetchImpl,
      fontSet,
      measureText,
      hashDocument,
      signal: controller.signal,
    })
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setAssets(result);
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if (isAbortError(error)) return;
        const message =
          error instanceof HymnAssetError || error instanceof Error
            ? error.message
            : "加载谱面资产时发生未知错误。";
        setAssets({ status: "error", message });
      });

    return () => {
      controller.abort();
    };
  }, [hymn, retryToken, fetchImpl, fontSet, measureText, hashDocument]);

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  const useImageFallback = useCallback(() => {
    if (!hymn) return;
    setAssets((current) => {
      if (current.status !== "error") return current;
      return {
        status: "image",
        reason: `结构化谱面加载失败，已改用图片谱：${current.message}`,
      };
    });
  }, [hymn]);

  return { assets, retry, useImageFallback };
}
