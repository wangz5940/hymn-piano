import type { HymnCatalogItem, ParsedHymnFilename } from "./types";

const filenamePattern = /^(\d+)([a-z]?)\s+(.+)\.jpg$/i;

export function parseHymnFilename(filename: string): ParsedHymnFilename {
  const match = filename.match(filenamePattern);
  if (!match) {
    throw new Error(`无法解析歌谱文件名：${filename}`);
  }

  const variant = match[2].toLowerCase();
  return {
    number: Number(match[1]),
    variant,
    title: match[3].trim().replace(/\(第二调\)$/, ""),
    filename,
    is_alternate_tune: variant.length > 0,
  };
}

export function searchHymns(
  hymns: readonly HymnCatalogItem[],
  query: string,
): HymnCatalogItem[] {
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  if (!normalized) return [...hymns];

  const keyQuery = normalized.match(/^(\d+)([a-z]?)$/i);
  if (keyQuery) {
    const number = Number(keyQuery[1]);
    const variant = keyQuery[2].toLowerCase();
    return hymns.filter(
      (hymn) =>
        hymn.number === number && (!variant || hymn.variant === variant),
    );
  }

  return hymns.filter((hymn) =>
    `${hymn.number}${hymn.variant} ${hymn.title}`
      .toLocaleLowerCase("zh-CN")
      .includes(normalized),
  );
}

export function findHymn(
  hymns: readonly HymnCatalogItem[],
  hymnKey: string,
): HymnCatalogItem | undefined {
  return hymns.find((hymn) => hymn.key === hymnKey);
}

export function groupHymnVariants(
  hymns: readonly HymnCatalogItem[],
): Map<number, HymnCatalogItem[]> {
  const groups = new Map<number, HymnCatalogItem[]>();
  for (const hymn of hymns) {
    const variants = groups.get(hymn.number) ?? [];
    variants.push(hymn);
    groups.set(hymn.number, variants);
  }
  return groups;
}
