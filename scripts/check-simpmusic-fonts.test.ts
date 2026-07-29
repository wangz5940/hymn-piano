import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSimpMusicFontPolicy } from "./check-simpmusic-fonts";

function emptyFontRoot(): string {
  return mkdtempSync(join(tmpdir(), "shiqin-font-policy-"));
}

describe("SimpMusic prebuild policy gate", () => {
  it("未授权且字体完全缺失时允许构建使用 JPG 回退", () => {
    const root = emptyFontRoot();

    expect(
      checkSimpMusicFontPolicy({
        explicitDirectories: [root],
        projectRoot: root,
        homeDirectory: root,
        platform: "linux",
        distributionAuthorized: false,
      }).policy,
    ).toMatchObject({ mode: "image-fallback" });
  });

  it("显式授权后缺少 Base 或 Accent 时阻断构建", () => {
    const root = emptyFontRoot();

    expect(() =>
      checkSimpMusicFontPolicy({
        explicitDirectories: [root],
        projectRoot: root,
        homeDirectory: root,
        platform: "linux",
        distributionAuthorized: true,
      }),
    ).toThrow("Base/Accent 哈希全部匹配");
  });
});
