import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(
  resolve(process.cwd(), "src/styles/components.css"),
  "utf8",
);

describe("歌谱打印样式", () => {
  it("[defect-probing] 打印时取消滚动裁切并隐藏交互工具", () => {
    const printBlock = css.match(/@media\s+print\s*\{[\s\S]*\}\s*$/u)?.[0];

    expect(printBlock).toBeDefined();
    expect(printBlock).toMatch(
      /\.score-viewer__toolbar[\s\S]*display\s*:\s*none/u,
    );
    expect(printBlock).toMatch(
      /\.practice-sidebar[\s\S]*display\s*:\s*none/u,
    );
    expect(printBlock).toMatch(
      /\.score-viewer__canvas[\s\S]*max-height\s*:\s*none[\s\S]*overflow\s*:\s*visible/u,
    );
    expect(printBlock).toMatch(
      /\.score-document-frame[\s\S]*transform\s*:\s*none\s*!important/u,
    );
    expect(printBlock).toMatch(
      /\.score-svg[\s\S]*filter\s*:\s*none/u,
    );
  });
});
