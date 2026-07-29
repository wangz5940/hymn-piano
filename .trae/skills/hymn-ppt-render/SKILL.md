---
name: "hymn-ppt-render"
description: "Extracts hymn PPTX source data and renders lyrics plus jianpu HTML. Invoke when parsing hymn PPTs or generating score-rendered HTML."
---

# Hymn PPT Render

用于把诗歌 PPTX 中的源数据抽离出来，并稳定渲染成“歌词 + 简谱”的 HTML。

## 触发条件

使用本 Skill，当用户提出以下任一需求：

- 从 `Hymns_ppt` 或其他诗歌 PPTX 目录抽取诗歌源数据。
- 把 PPT 里的歌词、简谱、谱面图片渲染成 HTML。
- 要求“不是仅歌词，要歌词 + 歌谱”。
- 要求使用 `SimpMusic Base` / `SimpMusic Accent` 稳定显示简谱。
- 要求为 PPT 简谱 HTML 生成 Docker 可部署包。

不要把本 Skill 用于普通 JPG/PNG 歌谱 OCR，除非用户明确要求把 PPTX 流程和图片 OCR 流程合并。

## 项目入口

本项目已有实现，优先复用，不要重新发明解析器：

- PPTX 抽取与 HTML 渲染：`poetry_parser/ppt.py`
- CLI：`poetry_parser/cli.py`
- 测试：`tests/test_ppt.py`
- 默认输出：`output/Hymns_ppt_html`

主要命令：

```bash
python3 -m poetry_parser ppt-batch Hymns_ppt -o output/Hymns_ppt_html
```

单首调试：

```bash
python3 -m poetry_parser ppt-render "Hymns_ppt/02 祢是我异象.pptx" \
  -o output/debug.html \
  --json output/debug.ppt.json \
  --txt output/debug.lyrics.txt
```

## 数据模型

PPTX 解析结果使用 `poetry-ppt/v1` 风格 JSON。核心字段：

- `slides[].boxes[]`: PPT 文本框，必须保留 `label`、`lyric`、`score` 三类。
- `slides[].media[]`: PPT 中嵌入的谱面图片元素。
- `lyrics[]`: 从歌词框抽出的连续歌词，供检索、展示和 TXT 输出。
- `metadata.score_box_count`: 识别出的谱行文本框数量。
- `page`: PPT 页面尺寸，用于按原坐标复排。

关键约束：

- 不要过滤掉 `score` 文本框。只输出歌词是不合格结果。
- `SimpMusic Base` / `SimpMusic Accent` 字体编码的谱行应按原字体显示。
- HTML 版式层必须包含歌词框、谱行框、段号框和谱面图片元素。

## 字体策略

最稳策略是同时满足两点：

1. 生成 HTML 时内嵌 `@font-face` data URI。
2. 输出目录保留字体文件，供 Docker 或外部服务使用。

默认字体查找位置包括：

- `./fonts`
- `output/Hymns_ppt_html/fonts`
- `~/Library/Fonts`
- `/Library/Fonts`
- `/usr/local/share/fonts`
- `/usr/share/fonts`

字体文件名：

- `SimpMusicBase.ttf`
- `SimpMusicAccent.ttf`

如果字体不在默认目录，用：

```bash
python3 -m poetry_parser ppt-batch Hymns_ppt -o output/Hymns_ppt_html \
  --font-dir /path/to/fonts
```

如果找不到字体，命令应失败并提示用户提供字体；不要生成无法显示简谱的 HTML。

## Docker 部署

批量输出会生成：

- `output/Hymns_ppt_html/Dockerfile`
- `output/Hymns_ppt_html/fonts/SimpMusicBase.ttf`
- `output/Hymns_ppt_html/fonts/SimpMusicAccent.ttf`

构建与运行：

```bash
docker build -t hymns-ppt-html output/Hymns_ppt_html
docker run --rm -p 8000:8000 hymns-ppt-html
```

访问：

```text
http://127.0.0.1:8000/index.html
```

如果端口占用：

```bash
docker run --rm -p 18080:8000 hymns-ppt-html
```

访问：

```text
http://127.0.0.1:18080/index.html
```

## 验证流程

每次修改解析或渲染逻辑后至少执行：

```bash
python3 -m unittest discover -s tests
python3 -m compileall poetry_parser tests
python3 -m poetry_parser ppt-batch Hymns_ppt -o output/Hymns_ppt_html
```

检查输出中是否确实包含谱行和字体：

```bash
python3 - <<'PY'
import json
from pathlib import Path

root = Path("output/Hymns_ppt_html")
idx = json.loads((root / "index.json").read_text(encoding="utf-8"))
score_total = 0
missing_score = []
for item in idx["items"]:
    data = json.loads((root / item["json_path"]).read_text(encoding="utf-8"))
    score_count = data.get("metadata", {}).get("score_box_count", 0)
    score_total += score_count
    if not score_count:
        missing_score.append(item["title"])

html = (root / "02 祢是我异象.html").read_text(encoding="utf-8")
print("count", idx["count"])
print("score_total", score_total)
print("missing_score", missing_score)
print("font_face", "@font-face" in html)
print("simp_music_base", "SimpMusic Base" in html)
print("ppt_score", "ppt-score" in html)
PY
```

期望：

- `count` 等于实际 PPTX 诗歌数量。
- `missing_score` 为空。
- `font_face`、`simp_music_base`、`ppt_score` 都是 `True`。

Docker daemon 可用时，继续验证：

```bash
docker build -t hymns-ppt-html output/Hymns_ppt_html
docker run --rm hymns-ppt-html python3 -c "from pathlib import Path; print(sorted(p.name for p in Path('/usr/local/share/fonts').glob('SimpMusic*.ttf'))); print(Path('/site/index.html').exists())"
```

需要端到端 HTTP 检查时：

```bash
docker rm -f hymns-ppt-html-test 2>/dev/null || true
docker run --rm -d --name hymns-ppt-html-test -p 127.0.0.1:18080:8000 hymns-ppt-html
curl -I --max-time 5 http://127.0.0.1:18080/index.html
docker stop hymns-ppt-html-test
```

## 实现守则

- 只读源 PPTX，不改动 `Hymns_ppt` 下的原文件。
- 保持输出可重复生成，允许覆盖 `output/Hymns_ppt_html` 中的生成物。
- 对解析逻辑做最小改动，避免影响图片 OCR 路径。
- 手工编辑文件时使用 `apply_patch`。
- 如果 Docker 构建因外部网络卡住，优先改成不依赖外部包源的构建方式；HTML 自身的字体内嵌是首要稳定保障。
