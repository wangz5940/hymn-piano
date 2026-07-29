import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  enforceSimpMusicFontBuildPolicy,
  inspectSimpMusicFonts,
  isDistributionAuthorized,
  type FontInspectionOptions,
} from "./score-pipeline/fonts";

export function checkSimpMusicFontPolicy(
  options: FontInspectionOptions = {},
) {
  const inspection = inspectSimpMusicFonts({
    ...options,
    distributionAuthorized:
      options.distributionAuthorized ?? isDistributionAuthorized(),
  });
  return {
    inspection,
    policy: enforceSimpMusicFontBuildPolicy(inspection),
  };
}

function main() {
  const result = checkSimpMusicFontPolicy();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";
if (
  invokedFile &&
  pathToFileURL(invokedFile).href === pathToFileURL(currentFile).href
) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
