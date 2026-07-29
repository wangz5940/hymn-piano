import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const SIMPMUSIC_FONT_SPECS = {
  base: {
    family: "SimpMusic Base",
    filename: "SimpMusicBase.ttf",
    candidates: ["SimpMusicBase.ttf", "SimpMusic Base.ttf"],
    sha256: "299d79d5cf40058c70f1c8a5ccedee7cb69142ac444d63925ce6057f9f636797",
  },
  accent: {
    family: "SimpMusic Accent",
    filename: "SimpMusicAccent.ttf",
    candidates: ["SimpMusicAccent.ttf", "SimpMusic Accent.ttf"],
    sha256: "50da44991631cf8a555381359d0dd91d11143e99ac5c80bd9afb62b08a91c792",
  },
} as const;

export type SimpMusicFontKey = keyof typeof SIMPMUSIC_FONT_SPECS;
export type SimpMusicFontState = "local" | "distributable" | "unavailable";

export interface FontSearchOptions {
  explicitDirectories?: readonly string[];
  projectRoot?: string;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
}

export interface FontInspectionOptions extends FontSearchOptions {
  distributionAuthorized?: boolean;
}

export interface InspectedSimpMusicFont {
  key: SimpMusicFontKey;
  family: string;
  path: string | null;
  sha256: string | null;
  state: SimpMusicFontState;
}

export interface SimpMusicFontInspection {
  state: SimpMusicFontState;
  distributionAuthorized: boolean;
  searchDirectories: string[];
  fonts: Record<SimpMusicFontKey, InspectedSimpMusicFont>;
}

export type SimpMusicFontBuildPolicy =
  | {
      mode: "local";
      message: string;
    }
  | {
      mode: "image-fallback";
      message: string;
    }
  | {
      mode: "distributable";
      message: string;
    };

export class SimpMusicFontIntegrityError extends Error {
  readonly fontKey: SimpMusicFontKey;
  readonly path: string;
  readonly expected: string;
  readonly actual: string;

  constructor(
    fontKey: SimpMusicFontKey,
    path: string,
    expected: string,
    actual: string,
  ) {
    super(
      `${SIMP_MUSIC_LABELS[fontKey]} 字体哈希不匹配：${path}（期望 ${expected}，实际 ${actual}）`,
    );
    this.name = "SimpMusicFontIntegrityError";
    this.fontKey = fontKey;
    this.path = path;
    this.expected = expected;
    this.actual = actual;
  }
}

const SIMP_MUSIC_LABELS: Record<SimpMusicFontKey, string> = {
  base: "SimpMusic Base",
  accent: "SimpMusic Accent",
};

function uniquePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  return paths
    .map((path) => resolve(path))
    .filter((path) => {
      if (seen.has(path)) return false;
      seen.add(path);
      return true;
    });
}

export function defaultFontSearchDirectories(
  options: FontSearchOptions = {},
): string[] {
  const projectRoot = options.projectRoot ?? process.cwd();
  const homeDirectory = options.homeDirectory ?? homedir();
  const platform = options.platform ?? process.platform;
  const directories = [
    ...(options.explicitDirectories ?? []),
    join(projectRoot, "fonts"),
  ];

  if (platform === "darwin") {
    directories.push(join(homeDirectory, "Library", "Fonts"), "/Library/Fonts");
  }

  if (platform === "linux") {
    directories.push(
      join(homeDirectory, ".local", "share", "fonts"),
      join(homeDirectory, ".fonts"),
    );
  }

  directories.push("/usr/local/share/fonts", "/usr/share/fonts");
  return uniquePaths(directories);
}

export function findSimpMusicFonts(
  options: FontSearchOptions = {},
): Partial<Record<SimpMusicFontKey, string>> {
  const found: Partial<Record<SimpMusicFontKey, string>> = {};

  for (const directory of defaultFontSearchDirectories(options)) {
    for (const key of Object.keys(SIMPMUSIC_FONT_SPECS) as SimpMusicFontKey[]) {
      if (found[key]) continue;
      for (const filename of SIMPMUSIC_FONT_SPECS[key].candidates) {
        const candidate = join(directory, filename);
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          found[key] = candidate;
          break;
        }
      }
    }
  }

  return found;
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function isDistributionAuthorized(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.SHIQIN_ALLOW_SIMPMUSIC_DISTRIBUTION === "1";
}

export function classifyVerifiedFont(
  key: SimpMusicFontKey,
  path: string,
  actualHash: string,
  distributionAuthorized: boolean,
): InspectedSimpMusicFont {
  const spec = SIMPMUSIC_FONT_SPECS[key];
  if (actualHash !== spec.sha256) {
    throw new SimpMusicFontIntegrityError(
      key,
      path,
      spec.sha256,
      actualHash,
    );
  }

  return {
    key,
    family: spec.family,
    path,
    sha256: actualHash,
    state: distributionAuthorized ? "distributable" : "local",
  };
}

export function inspectSimpMusicFonts(
  options: FontInspectionOptions = {},
): SimpMusicFontInspection {
  const searchDirectories = defaultFontSearchDirectories(options);
  const found = findSimpMusicFonts(options);
  const distributionAuthorized =
    options.distributionAuthorized ?? isDistributionAuthorized();
  const fonts = {} as Record<SimpMusicFontKey, InspectedSimpMusicFont>;

  for (const key of Object.keys(SIMPMUSIC_FONT_SPECS) as SimpMusicFontKey[]) {
    const spec = SIMPMUSIC_FONT_SPECS[key];
    const path = found[key] ?? null;
    if (!path) {
      fonts[key] = {
        key,
        family: spec.family,
        path: null,
        sha256: null,
        state: "unavailable",
      };
      continue;
    }

    const actualHash = sha256File(path);
    fonts[key] = classifyVerifiedFont(
      key,
      path,
      actualHash,
      distributionAuthorized,
    );
  }

  const states = Object.values(fonts).map((font) => font.state);
  const state: SimpMusicFontState = states.includes("unavailable")
    ? "unavailable"
    : distributionAuthorized
      ? "distributable"
      : "local";

  return {
    state,
    distributionAuthorized,
    searchDirectories,
    fonts,
  };
}

export function assertFontsMayBeDistributed(
  inspection: SimpMusicFontInspection,
): void {
  if (
    !inspection.distributionAuthorized ||
    inspection.state !== "distributable"
  ) {
    throw new Error(
      "SimpMusic 字体不可公开分发：必须显式授权且 Base/Accent 哈希全部匹配。",
    );
  }
}

export function enforceSimpMusicFontBuildPolicy(
  inspection: SimpMusicFontInspection,
): SimpMusicFontBuildPolicy {
  if (inspection.distributionAuthorized) {
    assertFontsMayBeDistributed(inspection);
    return {
      mode: "distributable",
      message: "SimpMusic Base/Accent 字体完整且已显式授权分发。",
    };
  }

  if (inspection.state === "unavailable") {
    return {
      mode: "image-fallback",
      message: "未发现完整的 SimpMusic 字体，本次构建保留 JPG 回退。",
    };
  }

  return {
    mode: "local",
    message: "SimpMusic 字体仅供本地渲染，不会复制到构建产物。",
  };
}
