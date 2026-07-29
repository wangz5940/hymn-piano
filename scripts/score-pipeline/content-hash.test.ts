import { describe, expect, it } from "vitest";
import {
  computeDocumentContentHash,
  withDocumentContentHash,
} from "./content-hash";

describe("确定性内容哈希", () => {
  it("对象键顺序不同仍生成相同 SHA-256", () => {
    const left = {
      schema: "example/v1",
      nested: { beta: 2, alpha: 1 },
      values: [{ right: 2, left: 1 }],
    };
    const right = {
      values: [{ left: 1, right: 2 }],
      nested: { alpha: 1, beta: 2 },
      schema: "example/v1",
    };

    expect(withDocumentContentHash(left).content_hash).toBe(
      withDocumentContentHash(right).content_hash,
    );
  });

  it("重算时排除旧 content_hash 并保持相同输入稳定", () => {
    const first = withDocumentContentHash({
      schema: "example/v1",
      value: "final",
    });
    const stale = { ...first, content_hash: "0".repeat(64) };
    const repaired = withDocumentContentHash(stale);

    expect(repaired.content_hash).toBe(first.content_hash);
    expect(computeDocumentContentHash(repaired)).toBe(first.content_hash);
  });
});
