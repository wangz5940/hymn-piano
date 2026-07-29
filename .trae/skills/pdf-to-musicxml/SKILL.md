---
name: "pdf-to-musicxml"
description: "将扫描乐谱 PDF、PNG 或 JPG 通过 OMR 转为 MusicXML、文字 OCR 与页码索引。用户要求解析五线谱、导出 MusicXML 或批量识别乐谱时调用。"
---

# 扫描乐谱转 MusicXML

将扫描版乐谱 PDF、PNG 或 JPG 的五线谱转换为结构化 MusicXML，并输出文字 OCR、页码索引和可复现的 OMR 工程。

默认使用 Audiveris 进行光学乐谱识别（OMR），MusicXML 是主输出格式。不要把五线谱交给普通文字 OCR 处理，也不要承诺识别结果达到人工校谱的准确度。

## 适用场景

- 用户要求解析扫描乐谱中的音符、小节、拍号、左右手或声部。
- 用户要求将乐谱 PDF、PNG、JPG 转为 MusicXML、`.mxl`、记谱数据或大模型可读的结构化文本。
- 用户希望将扫描版钢琴教材、练习曲或曲谱批量数字化。

## 输出约定

在项目根目录下创建或复用以下目录：

```text
.trae/omr/<输入文件名>/
  <输入文件名>.omr
  *.mxl
  run.log

.trae/documents/<教材名>_MusicXML/
  <教材名>_乐章_001.musicxml
  ...
  索引.md

.trae/documents/
  <教材名>_OCR文本.txt
  <教材名>_OCR结构.jsonl
  <教材名>_指法候选.jsonl
```

- 原始 PDF、PNG、JPG 绝不修改。
- `.omr` 是 Audiveris 的可编辑工程，必须保留，便于定位和修正识别错误。
- `.mxl` 是压缩 MusicXML；展开后的 `.musicxml` 是大模型优先读取的产物。
- `索引.md` 必须记录每个乐章对应的 `source-sheet-N` 原始页码。
- `_OCR文本.txt` 是面向人工阅读的正文和标题 OCR。
- `_OCR结构.jsonl` 保留 OCR 文本块及坐标，便于后续回查原图位置。
- `_指法候选.jsonl` 只记录普通 OCR 识别到的 1—5 指号候选和教材指法文字线索；默认状态必须是 candidate，不能当作已校准逐音指法。

## 前置条件

本 Skill 的脚本面向 macOS，要求：

- `rg`、`xmllint`、`ditto`、`zip`、`unzip`
- Audiveris macOS 应用包，默认位置：`.trae/tools/Audiveris.app`
- 可选：`swift`，用于 macOS Vision 正文 OCR

若 Audiveris 不在默认位置，设置：

```bash
export AUDIVERIS_APP_PATH="/absolute/path/to/Audiveris.app"
```

首次执行时，`scripts/run_audiveris.sh` 会把 Audiveris 配置、Tesseract 目录和 JavaCPP 缓存重定向到 `.trae/audiveris-home/`，避免依赖用户 Library 目录权限。

## 工作流

### 1. 检查输入与音乐页范围

先检查 PDF 总页数、封面、目录、前言和典型乐谱页。对于教材，通常应只转录包含五线谱的页范围。

```bash
input=".trae/pdf/教材.pdf"
output=".trae/omr/教材"

# 例如：仅处理第 7 至 102 页
.trae/skills/pdf-to-musicxml/scripts/run_audiveris.sh \
  -batch -transcribe -save -swap \
  -output "$output" \
  -sheets 7-102 \
  -- "$input" > "$output/run.log" 2>&1
```

对于单张 PNG 或 JPG，省略 `-sheets`：

```bash
.trae/skills/pdf-to-musicxml/scripts/run_audiveris.sh \
  -batch -transcribe -save -swap \
  -output ".trae/omr/单张乐谱" \
  -- "乐谱.png"
```

多个独立图片应先按页码排序并组合为多页 PDF，或逐张独立处理。不要让文件系统枚举顺序决定乐谱页顺序。

### 2. 生成文字 OCR 与指法候选

普通文字 OCR 用于目录、练习标题、速度术语和说明，不用于解析音符。若用户需要指法，或输入是教材/练习谱，优先使用 `score_ocr.swift`，同时生成正文、带坐标 OCR 和指法候选：

```bash
swift .trae/skills/pdf-to-musicxml/scripts/score_ocr.swift \
  "$input" \
  ".trae/documents/教材" \
  4
```

它会生成：

```text
.trae/documents/教材_OCR文本.txt
.trae/documents/教材_OCR结构.jsonl
.trae/documents/教材_指法候选.jsonl
```

仅当只需要普通正文 OCR 时，才使用旧脚本：

```bash
swift .trae/skills/pdf-to-musicxml/scripts/pdf_ocr.swift \
  "$input" \
  ".trae/documents/教材_OCR文本.txt" \
  3
```

指法处理规则：

- MusicXML 中已经存在 `<notations><technical><fingering>` 时，可作为 `source=score` 的逐音指法。
- `_指法候选.jsonl` 中的数字只代表视觉 OCR 候选，必须标记为 `candidate`。
- 不得把 OCR 候选直接写成正式跟弹指法；需要人工核对后再升级为已确认指法。

### 3. 检查 OMR 工程完整性

识别结束后，确认每个参与导出的乐谱页都已达到 `PAGE` 步骤：

```bash
omr=$(find "$output" -maxdepth 1 -name '*.omr' -print -quit)
unzip -p "$omr" book.xml |
  awk '/<sheet number=/{n=$0; sub(/.*number="/, "", n); sub(/".*/, "", n)}
       /<steps>/{if ($0 !~ /PAGE/) print n ":" $0}'
```

日志中的节奏不一致、跨谱表对齐或连线警告不必立即停止流程，但必须在交付说明中标记为需要结合原谱核对。

### 4. 隔离无法导出的页面

若封面、目录、文字页或异常页阻止整本导出，创建派生 `.omr` 副本并标记这些页面为无效。不要修改原始 `.omr`。

```bash
.trae/skills/pdf-to-musicxml/scripts/mark_invalid_omr_pages.sh \
  "$omr" \
  ".trae/omr/教材-clean/教材_music_pages.omr" \
  "1-6,90"
```

该脚本会同时移除被排除页在乐章页序列中的引用。输出索引和说明必须列出所有被排除页。

### 5. 导出 MusicXML

对清理后的 `.omr` 执行导出：

```bash
clean_omr=".trae/omr/教材-clean/教材_music_pages.omr"
.trae/skills/pdf-to-musicxml/scripts/run_audiveris.sh \
  -batch -export -- "$clean_omr" \
  > ".trae/omr/教材-clean/export.log" 2>&1
```

Audiveris 会按自动识别的乐章边界生成 `*.mvtN.mxl`。乐章数量可能高于曲目或练习数量，这是扫描版面中的缩进和分段识别导致的正常现象；必须依赖页码索引定位。

### 6. 展开 `.mxl` 并生成索引

```bash
.trae/skills/pdf-to-musicxml/scripts/export_musicxml_documents.sh \
  ".trae/omr/教材-clean" \
  ".trae/documents/教材_MusicXML" \
  "教材"
```

### 7. 执行质量门禁

所有交付的 MusicXML 必须通过以下检查：

```bash
musicxml_dir=".trae/documents/教材_MusicXML"

find "$musicxml_dir" -maxdepth 1 -name '*.musicxml' -type f -print0 |
  xargs -0 -n1 xmllint --noout

printf '文件数：'
find "$musicxml_dir" -maxdepth 1 -name '*.musicxml' -type f | wc -l

printf '含音符文件数：'
rg -l '<note[ >]' "$musicxml_dir" --glob '*.musicxml' | wc -l

printf '来源页：'
rg --no-filename -o 'source-sheet-[0-9]+' "$musicxml_dir" --glob '*.musicxml' |
  sed 's/source-sheet-//' |
  sort -n -u |
  paste -sd ',' -
```

完成条件：

- 每个 `.musicxml` 都通过 `xmllint`。
- 每个输出至少包含一个 `<note>`。
- `索引.md` 的行数与 MusicXML 文件数一致。
- 已转录页范围与 `source-sheet-N` 覆盖范围一致，或明确列出排除页。
- 在 `.trae/documents/` 生成转换说明，列出结构化字段、限制和人工核对建议。
- 若生成了 `_指法候选.jsonl`，候选文件必须能按 JSONL 逐行解析，且交付说明需声明候选尚未人工校对。

## LilyPond 与其他格式

优先交付 MusicXML，因为它保留音高、时值、谱表、声部、小节和来源页码，适合作为大模型和记谱软件之间的交换格式。

仅在用户明确需要 LilyPond 时，再使用已验证的 MusicXML 作为输入进行二次转换，并将 LilyPond 视为派生产物。不要以 LilyPond 转换成功替代 MusicXML 校验。

## 常见问题

- `Error in reaching step PAGE`：定位未完成 `PAGE` 的页，在派生 `.omr` 中标记为无效，保留原始工程。
- `Could not export since transcription did not complete successfully`：通常有未处理的封面、目录或异常页；不要重跑整本，先生成清理副本。
- `.mxl` 文件覆盖或 `mvtnull`：不要对原 `.omr` 的选定页段直接导出；应从完整且清理过的 `.omr` 导出，以得到稳定的 `mvtN` 文件名。
- 节奏、连线、跨谱表、装饰音识别不可靠：保留原 PDF 和 `.omr`，在说明中标为人工核对范围。
