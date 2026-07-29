import { createHash } from "node:crypto";

export type ContentDocument = Record<string, unknown> & {
  content_hash?: string;
};

export function canonicalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeForHash);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalizeForHash(nested)]),
    );
  }
  return value;
}

export function hashCanonicalContent(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeForHash(value)))
    .digest("hex");
}

export function computeDocumentContentHash(
  document: ContentDocument,
): string {
  const { content_hash: _contentHash, ...content } = document;
  void _contentHash;
  return hashCanonicalContent(content);
}

export function withDocumentContentHash<T extends object>(
  document: T,
): T & { content_hash: string } {
  const { content_hash: _contentHash, ...content } =
    document as T & ContentDocument;
  void _contentHash;
  return {
    ...(content as T),
    content_hash: hashCanonicalContent(content),
  };
}
