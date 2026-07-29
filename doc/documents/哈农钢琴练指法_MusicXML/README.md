# 哈农结构化数据

## 目录

- `manifest.json`：数据集元数据、章节和 68 个片段摘要。
- `segments.jsonl`：程序和 AI 的主读取文件，每行一个 `score_segment`，包含 MusicXML 元数据和规范化音符事件。
- `ocr_pages.jsonl`：每行一个 PDF 页面的 OCR 文本和练习标签。
- `schema.json`：字段契约和关联规则。
- `*.musicxml`：原始 OMR 导出的 MusicXML，当前全部为候选资源。

## 关联方式

```text
segments.jsonl.segment_id
├── source.pdf_pages
├── source.ocr_page_refs → ocr_pages.jsonl.pdf_page
└── musicxml.path + musicxml.sha256
```

MusicXML 片段不是教材练习编号的一对一映射。`ocr_labels` 和 `ocr_exercise_numbers` 只表示对应 PDF 页中 OCR 明确识别到的标签，`ocr_context` 保留该片段对应页面的完整 OCR 文本；标签可能不完整，在人工复核前，程序不得据此自动创建正式课程或实时判定。

## 程序读取示例

```python
import json
from pathlib import Path

dataset = Path("哈农钢琴练指法_MusicXML")
manifest = json.loads((dataset / "manifest.json").read_text())

for line in (dataset / manifest["format"]["records"]).read_text().splitlines():
    segment = json.loads(line)
    if segment["quality"]["status"] != "published":
        continue
    print(segment["segment_id"], len(segment["note_events"]))
```

## AI 使用约束

AI 可以读取：

- `source.ocr_page_refs` 对应的教材说明、章节和练习标签。
- `music` 中的拍号、谱表、小节、声部和音符统计。
- `note_events` 中的音高、时值、声部、谱表和连音信息。
- `musicxml.path` 指向的原始结构化乐谱。

AI 不应把 OMR 候选识别结果当成经过教师确认的正确谱面。`quality.realtime_judgement_allowed` 为 `false` 时，只能用于分析和审核。
