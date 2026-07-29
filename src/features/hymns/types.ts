export interface HymnCatalogItem {
  key: string;
  number: number;
  variant: string;
  title: string;
  filename: string;
  image_url: string;
  is_alternate_tune: boolean;
  score_source?: "pptx" | "image";
  score_schema?: "shiqin-score/v1" | null;
  arrangement_schema?: "shiqin-arrangement/v1" | null;
  render_schema?: "shiqin-render/v1" | null;
  score_asset_url?: string | null;
  arrangement_asset_url?: string | null;
  render_asset_url?: string | null;
  render_variant?: number | null;
  fallback_reason?: string | null;
}

export type ParsedHymnFilename = Omit<
  HymnCatalogItem,
  "key" | "image_url"
>;
