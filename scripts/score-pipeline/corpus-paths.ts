import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

function existingDirectory(candidates: string[]): string {
  const found = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isDirectory(),
  );
  return found ?? candidates[0];
}

export const pptxCorpusDirectory = existingDirectory([
  resolve("712首-文字"),
  resolve("resource/712首-文字"),
]);

export const imageCorpusDirectory = existingDirectory([
  resolve("选本诗歌712/歌谱"),
  resolve("resource/歌谱"),
]);

export function resolvePptxCorpusFile(filename: string): string {
  return resolve(pptxCorpusDirectory, filename);
}
