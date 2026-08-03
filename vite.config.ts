import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import {
  inspectSimpMusicFonts,
  SIMPMUSIC_FONT_SPECS,
} from "./scripts/score-pipeline/fonts";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const imageRootCandidates = [
  resolve(projectRoot, "选本诗歌712", "歌谱"),
  resolve(projectRoot, "resource", "歌谱"),
];
const imageRoot =
  imageRootCandidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isDirectory(),
  ) ?? imageRootCandidates[0];
const simpMusicFontInspection = inspectSimpMusicFonts({
  projectRoot,
});
const simpMusicLocalFontsAvailable =
  simpMusicFontInspection.state !== "unavailable";
const simpMusicFontFiles: ReadonlyMap<string, string> = new Map(
  Object.values(simpMusicFontInspection.fonts)
    .filter((font) => font.path !== null)
    .map((font) => [
      SIMPMUSIC_FONT_SPECS[font.key].filename,
      font.path as string,
    ]),
);

function imageMiddleware(): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      next();
      return;
    }

    let relativePath: string;
    try {
      const pathname = new URL(
        request.url ?? "/",
        "http://localhost",
      ).pathname;
      relativePath = decodeURIComponent(pathname).replace(/^\/+/u, "");
    } catch {
      next();
      return;
    }

    const filePath = resolve(imageRoot, relativePath);
    if (
      !filePath.startsWith(`${imageRoot}${sep}`) ||
      !existsSync(filePath) ||
      !statSync(filePath).isFile()
    ) {
      next();
      return;
    }

    response.statusCode = 200;
    response.setHeader("Content-Type", "image/jpeg");
    response.setHeader("Cache-Control", "public, max-age=3600");
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).on("error", next).pipe(response);
  };
}

function hymnImageAssets(): Plugin {
  let outputDirectory = resolve(projectRoot, "dist");
  return {
    name: "hymn-image-assets",
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use("/歌谱", imageMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use("/歌谱", imageMiddleware());
    },
    closeBundle() {
      if (!existsSync(imageRoot)) return;
      cpSync(imageRoot, resolve(outputDirectory, "歌谱"), {
        recursive: true,
        force: true,
      });
    },
  };
}

function simpMusicFontMiddleware(): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      next();
      return;
    }
    let filename: string;
    try {
      filename = decodeURIComponent(
        new URL(request.url ?? "/", "http://localhost").pathname,
      ).replace(/^\/+/u, "");
    } catch {
      next();
      return;
    }
    const fontPath = simpMusicFontFiles.get(filename);
    if (!fontPath) {
      next();
      return;
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", "font/ttf");
    response.setHeader("Cache-Control", "private, max-age=3600");
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(fontPath).on("error", next).pipe(response);
  };
}

function localSimpMusicFontAssets(): Plugin {
  return {
    name: "local-simpmusic-font-assets",
    configureServer(server) {
      server.middlewares.use(
        "/__simpmusic-fonts",
        simpMusicFontMiddleware(),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        "/__simpmusic-fonts",
        simpMusicFontMiddleware(),
      );
    },
  };
}

export default defineConfig({
  publicDir: "public",
  define: {
    __SIMPMUSIC_LOCAL_FONTS_AVAILABLE__: JSON.stringify(
      simpMusicLocalFontsAvailable,
    ),
  },
  build: {
    sourcemap: "hidden",
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react({
      babel: {
        plugins: ["react-dev-locator"],
      },
    }),
    tsconfigPaths(),
    localSimpMusicFontAssets(),
    hymnImageAssets(),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
