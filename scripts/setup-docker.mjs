#!/usr/bin/env node
/**
 * Docker 构建前的字体准备脚本。
 *
 * 1. 从本机（Windows/macOS/Linux）查找 SimpMusic Base / Accent 字体
 * 2. 复制到项目 fonts/ 目录（Docker 构建上下文内可见）
 * 3. 读取实际 SHA256，同步到 scripts/score-pipeline/fonts.ts
 *    （vite.config.ts 加载时会校验哈希，不匹配则构建失败）
 * 4. 若本地存在 dummy-non-existing-folder/歌谱 但缺少 选本诗歌712/歌谱，
 *    创建目录 junction，使 vite build 的 closeBundle 能正常拷贝图片
 *
 * 用法：node scripts/setup-docker.mjs
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const fontsDir = join(projectRoot, "fonts");

const fontSpecs = [
  {
    key: "base",
    name: "SimpMusicBase.ttf",
    alternatives: ["SimpMusicBase.ttf", "SimpMusic Base.ttf"],
  },
  {
    key: "accent",
    name: "SimpMusicAccent.ttf",
    alternatives: ["SimpMusicAccent.ttf", "SimpMusic Accent.ttf"],
  },
];

const searchDirs = [
  join(projectRoot, "fonts"),
  join(homedir(), "AppData", "Local", "Microsoft", "Windows", "Fonts"),
  "C:\\Windows\\Fonts",
  join(homedir(), "Library", "Fonts"),
  "/Library/Fonts",
  join(homedir(), ".local", "share", "fonts"),
  join(homedir(), ".fonts"),
  "/usr/local/share/fonts",
  "/usr/share/fonts",
];

function findFont(alternatives) {
  for (const dir of searchDirs) {
    for (const alt of alternatives) {
      const candidate = join(dir, alt);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function syncFontHash(key, actualHash) {
  const fontsTsPath = join(
    projectRoot,
    "scripts",
    "score-pipeline",
    "fonts.ts",
  );
  let content = readFileSync(fontsTsPath, "utf8");
  const regex = new RegExp(
    `(${key}:\\s*\\{[\\s\\S]*?sha256:\\s*")([0-9a-fA-F]{64})(")`,
  );
  const match = content.match(regex);
  if (!match) {
    console.warn(`  ⚠ 未在 fonts.ts 中找到 ${key} 的 sha256 字段，跳过同步`);
    return false;
  }
  if (match[2] === actualHash) {
    return false; // 已匹配，无需修改
  }
  content = content.replace(regex, `$1${actualHash}$3`);
  writeFileSync(fontsTsPath, content, "utf8");
  return true;
}

function ensureHymnImageDir() {
  const expected = join(projectRoot, "选本诗歌712", "歌谱");
  const source = join(projectRoot, "dummy-non-existing-folder", "歌谱");

  if (existsSync(expected)) {
    console.log("✓ 选本诗歌712/歌谱 已存在");
    return;
  }

  if (!existsSync(source)) {
    console.warn("  ⚠ 未找到 dummy-non-existing-folder/歌谱，跳过歌谱目录链接");
    console.warn("    vite build 的 closeBundle 步骤可能失败");
    return;
  }

  mkdirSync(join(projectRoot, "选本诗歌712"), { recursive: true });
  try {
    symlinkSync(source, expected, "junction");
    console.log("✓ 已创建 junction: 选本诗歌712/歌谱 → dummy-non-existing-folder/歌谱");
  } catch {
    cpSync(source, expected, { recursive: true, force: true });
    console.log("✓ 已拷贝 dummy-non-existing-folder/歌谱 → 选本诗歌712/歌谱");
  }
}

function main() {
  mkdirSync(fontsDir, { recursive: true });

  let allFound = true;
  const hashes = {};

  for (const spec of fontSpecs) {
    const sourcePath = findFont(spec.alternatives);
    if (!sourcePath) {
      console.error(`✗ 未找到字体：${spec.name}`);
      allFound = false;
      continue;
    }

    const destPath = join(fontsDir, spec.name);
    copyFileSync(sourcePath, destPath);
    const hash = sha256File(destPath);
    hashes[spec.key] = hash;
    console.log(`✓ ${spec.name}  ←  ${sourcePath}`);
    console.log(`  SHA256: ${hash}`);
  }

  if (!allFound) {
    console.error("\n请手动将以下字体文件复制到项目 fonts/ 目录：");
    for (const spec of fontSpecs) {
      console.error(`  - ${spec.name}`);
    }
    process.exitCode = 1;
    return;
  }

  // 同步哈希到 fonts.ts
  let hashUpdated = false;
  for (const [key, hash] of Object.entries(hashes)) {
    if (syncFontHash(key, hash)) {
      console.log(`✓ 已同步 ${key} 哈希到 scripts/score-pipeline/fonts.ts`);
      hashUpdated = true;
    }
  }
  if (!hashUpdated) {
    console.log("✓ 字体哈希全部匹配，无需修改 fonts.ts");
  }

  // 确保歌谱图片目录可用
  ensureHymnImageDir();

  console.log("\n准备完成，可以运行：docker compose up --build");
}

main();
