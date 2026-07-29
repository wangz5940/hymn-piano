import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SIMPMUSIC_FONT_SPECS,
  SimpMusicFontIntegrityError,
  assertFontsMayBeDistributed,
  classifyVerifiedFont,
  defaultFontSearchDirectories,
  enforceSimpMusicFontBuildPolicy,
  findSimpMusicFonts,
  inspectSimpMusicFonts,
  isDistributionAuthorized,
} from "./fonts";

function tempDirectory(): string {
  return mkdtempSync(join(tmpdir(), "shiqin-fonts-"));
}

describe("SimpMusic 字体发现与发布门禁", () => {
  it("按显式目录、项目、macOS 和 Linux 的顺序去重搜索", () => {
    expect(
      defaultFontSearchDirectories({
        explicitDirectories: ["/custom/fonts", "/custom/fonts"],
        projectRoot: "/project",
        homeDirectory: "/home/tester",
        platform: "darwin",
      }),
    ).toEqual([
      "/custom/fonts",
      "/project/fonts",
      "/home/tester/Library/Fonts",
      "/Library/Fonts",
      "/usr/local/share/fonts",
      "/usr/share/fonts",
    ]);

    expect(
      defaultFontSearchDirectories({
        projectRoot: "/project",
        homeDirectory: "/home/tester",
        platform: "linux",
      }),
    ).toEqual([
      "/project/fonts",
      "/home/tester/.local/share/fonts",
      "/home/tester/.fonts",
      "/usr/local/share/fonts",
      "/usr/share/fonts",
    ]);
  });

  it("显式目录优先发现字体，且不会复制或生成任何字体文件", () => {
    const explicit = tempDirectory();
    const project = tempDirectory();
    mkdirSync(join(project, "fonts"));
    writeFileSync(join(explicit, "SimpMusicBase.ttf"), "explicit-base");
    writeFileSync(join(explicit, "SimpMusicAccent.ttf"), "explicit-accent");
    writeFileSync(join(project, "fonts", "SimpMusicBase.ttf"), "project-base");
    const before = readdirSync(explicit);

    const found = findSimpMusicFonts({
      explicitDirectories: [explicit],
      projectRoot: project,
      homeDirectory: tempDirectory(),
      platform: "linux",
    });

    expect(found.base).toBe(join(explicit, "SimpMusicBase.ttf"));
    expect(found.accent).toBe(join(explicit, "SimpMusicAccent.ttf"));
    expect(readdirSync(explicit)).toEqual(before);
  });

  it("缺少字体时标记 unavailable，未授权环境不会获得分发资格", () => {
    const root = tempDirectory();
    const inspection = inspectSimpMusicFonts({
      explicitDirectories: [root],
      projectRoot: root,
      homeDirectory: root,
      platform: "linux",
      distributionAuthorized: false,
    });

    expect(inspection.state).toBe("unavailable");
    expect(inspection.fonts.base.path).toBeNull();
    expect(inspection.fonts.accent.path).toBeNull();
    expect(() => assertFontsMayBeDistributed(inspection)).toThrow(
      "必须显式授权",
    );
  });

  it("同名字体哈希错误时立即失败", () => {
    const root = tempDirectory();
    writeFileSync(join(root, SIMPMUSIC_FONT_SPECS.base.filename), "not-font");

    expect(() =>
      inspectSimpMusicFonts({
        explicitDirectories: [root],
        projectRoot: root,
        homeDirectory: root,
        platform: "linux",
      }),
    ).toThrow(SimpMusicFontIntegrityError);
  });

  it("哈希匹配时按授权状态区分 local 与 distributable", () => {
    const hash = SIMPMUSIC_FONT_SPECS.base.sha256;

    expect(
      classifyVerifiedFont("base", "/fonts/base.ttf", hash, false),
    ).toMatchObject({
      state: "local",
      sha256: hash,
    });
    expect(
      classifyVerifiedFont("base", "/fonts/base.ttf", hash, true),
    ).toMatchObject({
      state: "distributable",
      sha256: hash,
    });
  });

  it("只有显式授权值 1 才允许进入授权流程", () => {
    expect(isDistributionAuthorized({})).toBe(false);
    expect(
      isDistributionAuthorized({
        SHIQIN_ALLOW_SIMPMUSIC_DISTRIBUTION: "true",
      }),
    ).toBe(false);
    expect(
      isDistributionAuthorized({
        SHIQIN_ALLOW_SIMPMUSIC_DISTRIBUTION: "1",
      }),
    ).toBe(true);
  });

  it("[defect-probing] 未授权且完全缺少字体时允许构建并使用图片回退", () => {
    const root = tempDirectory();
    const inspection = inspectSimpMusicFonts({
      explicitDirectories: [root],
      projectRoot: root,
      homeDirectory: root,
      platform: "linux",
      distributionAuthorized: false,
    });

    expect(enforceSimpMusicFontBuildPolicy(inspection)).toEqual({
      mode: "image-fallback",
      message: "未发现完整的 SimpMusic 字体，本次构建保留 JPG 回退。",
    });
  });

  it("[defect-probing] 已授权分发时缺少任一字体必须阻断构建", () => {
    const root = tempDirectory();
    const inspection = inspectSimpMusicFonts({
      explicitDirectories: [root],
      projectRoot: root,
      homeDirectory: root,
      platform: "linux",
      distributionAuthorized: true,
    });

    expect(() => enforceSimpMusicFontBuildPolicy(inspection)).toThrow(
      "Base/Accent 哈希全部匹配",
    );
  });
});
