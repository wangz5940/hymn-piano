# 验收清单

## 数据源与身份

- [ ] 生成器发现恰好 712 份 PPTX，基础编号完整覆盖 001 至 712。
- [ ] 2658 张幻灯片均在导入报告中有 imported、deduplicated 或 fallback 结果，无静默丢弃。
- [ ] 709 份含 `SimpMusic Base`、173 份含 `SimpMusic Accent` 的语料基线通过校验。
- [ ] 060、063、444 仅使用明确标注原因的图片回退，不生成伪造 Score AST。
- [ ] 747 个 JPG 版本完整入册，其中 35 个第二调保持独立版本键。
- [ ] 第二调不引用同编号原调的 score、arrangement、人工覆盖或教学标记。
- [ ] PPTX 与 JPG 标题差异只产生诊断，不影响按编号正确关联。

## OOXML 与 Source AST

- [ ] PPTX 通过 ZIP/OOXML 直接解析，不依赖 PowerPoint、LibreOffice 或截图。
- [ ] Source AST 保留 slide、shape、paragraph、run、字体、字号、样式、层级、媒体和原始顺序。
- [ ] 坐标同时保存原始 EMU 和标准化页面值。
- [ ] 每个可解析节点具有稳定 source reference。
- [ ] 不支持的 OOXML 节点进入带文件和 slide 信息的诊断，不被静默忽略。
- [ ] 当前项目未建立对 `/Users/bytedance/program/poetry/poetry_parser` 的运行时依赖。

## SimpMusic 解码与 Score AST

- [ ] 语料实际出现的 Base/Accent 字符 inventory 已版本化并有明确映射。
- [ ] Base 与 Accent 可按顺序和空间关系合并，同时保留各自原始字符与来源。
- [ ] `note`、`rest`、时值、八度、临时升降、小节、反复、连线和装饰符黄金样例通过。
- [ ] 调号、拍号、歌词和音乐事件均保留来源与解析诊断。
- [ ] page、system、phrase、measure、event ID 在重复生成时保持稳定。
- [ ] 非 allowlist 的未知 SimpMusic 字符会使校验失败。
- [ ] `unknown` 事件不会获得虚构音高、指法或和弦。

## 去重与生成资产

- [ ] 相同谱面、不同歌词的幻灯片共享 score page，并保留各歌词版本及 slide reference。
- [ ] 真正不同的谱面不会因标题或歌词相似而被错误去重。
- [ ] 709 首结构化基础曲调各自拥有构建期 Source AST 审计资产，Score AST 的 source reference 可正确回溯。
- [ ] 709 首结构化基础曲调各自拥有独立 `score.json`。
- [ ] 浏览器正常练习流程不请求或打包 Source AST 审计资产。
- [ ] 曲库目录只保存轻量元数据和资产 URL，不包含全曲音符或坐标数组。
- [ ] 导入报告包含语料计数、去重统计、异常、未知字形、schema、生成器版本和内容哈希。
- [ ] 相同输入连续生成两次时，文件清单、稳定 ID、JSON 和 SHA-256 一致。

## 指法、手位与和声

- [ ] 每个可教学音符的右手指法通过 `eventId` 锚定同曲 Score AST。
- [ ] 固定手位可完成的乐句优先保持固定手位。
- [ ] 需要换位的乐句记录移动事件、前后手位、预备时机和原因。
- [ ] 黑键默认优先评估 2、3、4 指，例外使用 1 或 5 指时有上下文理由。
- [ ] 指法求解考虑前后乐句，不按单个音符或固定级数表机械赋值。
- [ ] 和声候选按曲目、小节、拍点和旋律证据生成，不向所有曲目复制固定 `I-V7-I`。
- [ ] 自动和声标记为 `auto_candidate`，不会显示为原谱事实或人工确认。
- [ ] 原谱或人工确认和弦优先于同范围算法候选，被覆盖候选仍可审计。
- [ ] 每个左手和弦包含实际音名、低音、转位和逐音手指。
- [ ] 左手指法考虑前后和弦连接，不对所有三和弦统一硬编码 `5-3-1`。
- [ ] 伴奏型、前奏、衔接和尾奏建议与实际拍号和乐句相关，并记录依据。
- [ ] 118 人工方案只作用于版本 `118`，不再自动作用于 `118b`。
- [ ] 所有 arrangement reference 均通过同曲同版本完整性校验。

## SVG Layout Engine

- [ ] 结构化谱面使用 SVG 主渲染，不使用 HTML span 排列音乐元素。
- [ ] SimpMusic 字体只负责 `<text>` 字形，音符间距和教学层位置由 Layout Engine 计算。
- [ ] 音符、休止、八度点、时值线、小节线、反复、连线和歌词具有独立 SVG layer。
- [ ] 指法显示在对应音符上方，并随布局、缩放和旋转保持对齐。
- [ ] 手位区段显示色带，换位点显示目标手位提示。
- [ ] 和弦、实际音名和左手手指锚定对应 measure/beat。
- [ ] 教学轨道执行碰撞避让，不覆盖目标音符和关键谱面。
- [ ] SVG 具有稳定 `viewBox`、曲目可访问名称、调号、拍号和页面摘要。
- [ ] 打印、全屏、适合宽度、缩放和旋转功能保持可用。

## 字体合规与回退

- [ ] 本地字体发现支持显式目录、macOS 用户/系统目录和常见 Linux 目录。
- [ ] Base 字体 SHA-256 匹配 `299d79d5cf40058c70f1c8a5ccedee7cb69142ac444d63925ce6057f9f636797`。
- [ ] Accent 字体 SHA-256 匹配 `50da44991631cf8a555381359d0dd91d11143e99ac5c80bd9afb62b08a91c792`。
- [ ] 未确认分发授权时，构建产物不含 TTF、WOFF、字体子集、base64 字体或字体轮廓 SVG path。
- [ ] 只有授权开关显式启用且哈希匹配时才允许打包字体。
- [ ] 同名字体哈希不匹配时构建失败。
- [ ] 浏览器字体不可用时自动显示同版本 JPG，并说明回退原因。
- [ ] 字体不可用时不会显示由错误替代字体组成的结构化谱面。

## 动态加载与 UI

- [ ] 打开基础曲调时只加载 catalog 和当前曲目的 `score.json`、`arrangement.json`。
- [ ] 主 JavaScript 包不包含 712 首完整 Score/Arrangement 或 `autoHymnGuideSeeds`。
- [ ] 加载中、成功、无字体、image source、网络失败、schema 不兼容和重试状态均有测试。
- [ ] `ScoreViewer` 优先显示 SVG，异常时回退同版本 JPG。
- [ ] `HymnPreparationGuide` 区分 `source_confirmed`、`manual_confirmed`、`auto_candidate`、`unavailable`。
- [ ] 教学面板显示逐音指法、手位变化、和声来源、左手逐音手指及原因。
- [ ] service simulation 复用同一按需加载和回退逻辑。
- [ ] 060、063、444、118b 和其他第二调的来源说明正确。
- [ ] 屏幕阅读器可获取曲名、调号、拍号、页面状态和控件名称。

## 旧链迁移与质量门禁

- [ ] `predev`、`prebuild` 不再生成 `hymn-guides.generated.ts`。
- [ ] 运行时代码不再导入 `ScoreMark` 百分比 overlay 或 OCR guide seed。
- [ ] `src/data/hymn-guides.generated.ts` 已移除。
- [ ] `scripts/ocr-hymn-images.swift` 和 `data/hymn-ocr.jsonl` 仅用于图片回退与校对。
- [ ] 基础曲调默认 Score AST 不读取 OCR 音符。
- [ ] `npm run generate:scores` 成功且导入报告无未解释异常。
- [ ] `npm run test:run` 全部通过。
- [ ] `npm run check` 全部通过。
- [ ] `npm run lint` 全部通过。
- [ ] `npm run build` 全部通过。
