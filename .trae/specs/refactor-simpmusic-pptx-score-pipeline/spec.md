# PPTX + SimpMusic 乐谱数据管线重构 Spec

## Why

当前谱面以 JPG、Vision OCR 和百分比 HTML 标记为主，无法可靠表达音高、时值、八度、连线、歌词对位及音符级教学关系，也把 747 份候选数据集中打入前端包。`712首-文字` 已提供 712 份由 `SimpMusic Base`、`SimpMusic Accent` 编写的结构化 PPTX，应将其升级为基础谱面的权威来源，并通过语义 AST 与 SVG 排版支撑逐音指法、手位和左手和弦教学。

## What Changes

- 以 `712首-文字/*.pptx` 作为 1 至 712 首基础曲调的权威谱面源，JPG/OCR 降级为异常回退和视觉校对来源。
- 新增 OOXML 导入器，解析 PPTX 中的幻灯片、文本框、文本 run、字体、字号、坐标、层级、段落、变换和媒体关系，形成可追溯的 Source AST。
- 新增 SimpMusic 字符映射与解码器，将 `SimpMusic Base`、`SimpMusic Accent` 的原始字符组合转换为简谱语义事件，并保留无法识别的原始字形和诊断信息。
- 定义版本化 Piano Score AST，表达调号、拍号、乐句、小节、音符、休止、时值、八度、临时升降、连音、延音、反复、歌词和来源定位。
- 对同一 PPTX 中仅歌词不同、谱面相同的幻灯片按谱面指纹去重，保留歌词段落与原幻灯片的对应关系。
- 将教学编配与原谱事实分层：按实际旋律生成逐音右手指法、手位区段、换位提示、逐和弦左手音名和手指，并记录算法依据、可信度和人工覆盖来源。
- 新增 SVG Layout Engine。SimpMusic 字体只负责字形；系统、音符、歌词、横线、连线、指法、手位色带和和弦的坐标与避让由排版引擎负责。
- 生成构建期审计用 Source AST，以及按曲目拆分的 `score.json` 和 `arrangement.json`；前端进入练习页后只按需加载后两者，曲库目录只保留轻量索引。
- 为 3 份无 `SimpMusic Base` 的 PPTX 和 35 个无独立 PPTX 的第二调保留明确的图片回退，不得复用原调 AST 或伪造结构化音符。
- 增加字体发现、SHA-256 校验和发布授权门禁。未确认分发授权时，不得把 TTF、子集字体或转换后的 SVG path 打入公开产物。
- **BREAKING**：移除 `hymn-ocr.jsonl -> hymn-guides.generated.ts -> JPG + HTML span` 作为默认谱面与教学数据链路。
- **BREAKING**：`ScoreMark` 百分比坐标和同步 `getHymnPracticeGuide()` 不再作为运行时契约；教学标记改为通过稳定的 `eventId`、`measureId` 和 `positionId` 锚定，并由异步曲目资产加载器提供。

## Impact

- Affected specs: 诗歌曲库、谱面导入、简谱语义模型、指法与手位教学、左手和弦教学、SVG 乐谱渲染、字体合规、离线构建。
- Affected code:
  - `scripts/generate-hymn-catalog.mjs`
  - `scripts/generate-hymn-guide-candidates.mjs`
  - `scripts/ocr-hymn-images.swift`
  - `src/data/hymn-guides.generated.ts`
  - `src/data/hymns.generated.ts`
  - `src/features/hymns/guidance.ts`
  - `src/features/hymns/types.ts`
  - `src/components/ScoreViewer.tsx`
  - `src/components/HymnPreparationGuide.tsx`
  - `src/components/ServiceSimulation.tsx`
  - `src/pages/PracticePage.tsx`
  - `src/styles/components.css`
  - `package.json`
- New systems:
  - `scripts/score-pipeline/`：PPTX 解析、SimpMusic 解码、去重、编配生成、字体校验和批量报告。
  - `src/features/score/`：版本化契约、资产加载、SVG 排版和渲染。
  - `data/generated/hymn-sources/`：按曲目拆分的构建期 Source AST 审计资产，不由前端加载。
  - `public/materials/hymns/`：按曲目拆分的生成资产。
- Reference implementation: 可移植 `/Users/bytedance/program/poetry/poetry_parser` 中 ZIP/OOXML、EMU 换算和字体发现思路，但当前项目不得建立跨项目运行时依赖。
- Implementation boundary: 首期使用项目现有 TypeScript/Node/React 技术栈实现 Layout Engine，不新增 Go 服务；AST 与渲染器保持解耦，以便后续 Go、MusicXML 或 MIDI 转换复用。

## Dataset Invariants

- 基础 PPTX 数量为 712，编号完整覆盖 001 至 712。
- 当前语料共 2658 张幻灯片，所有幻灯片必须被导入、去重或记录为异常，不得静默丢弃。
- 709 份 PPTX 含 `SimpMusic Base`。
- 173 份 PPTX 含 `SimpMusic Accent`。
- 以下 3 份 PPTX 不含 `SimpMusic Base`，必须进入显式图片回退：
  - `060 乐哉白白恩典.pptx`
  - `063 恩爱标本.pptx`
  - `444 我魂安息在于羔羊.pptx`
- JPG 曲库共 747 个版本，其中 712 个基础版本、35 个第二调版本。第二调键必须独立，不得读取同编号基础 PPTX 的结构化数据。
- 本机已确认字体及期望哈希：
  - `SimpMusicBase.ttf`: `299d79d5cf40058c70f1c8a5ccedee7cb69142ac444d63925ce6057f9f636797`
  - `SimpMusicAccent.ttf`: `50da44991631cf8a555381359d0dd91d11143e99ac5c80bd9afb62b08a91c792`

## Data Boundaries

### Source AST

Source AST 保存 PPTX 可核验事实，不承担音乐推断。每个节点至少包含：

- 源文件、幻灯片编号、shape 名称和稳定 source reference。
- 幻灯片尺寸及原始 EMU 和标准化坐标。
- 文本框、段落和 run 的原文、字体族、字号、颜色、样式、旋转、层级和边界框。
- 媒体 relationship 和边界框。
- PPTX 原始顺序，不因后续语义解析而丢失或改写。

### Piano Score AST

Piano Score AST 使用 `shiqin-score/v1` 版本标识，至少包含：

- 曲目键、标题、来源摘要、页面尺寸、调号、拍号及其来源。
- score page、system、phrase、measure 的稳定 ID。
- `note`、`rest`、`barline`、`repeat`、`tie`、`slur`、`unknown` 等事件。
- 音符的简谱级数、临时升降、八度、时值、附点和来源 reference。
- 歌词段落、音节及其对应音符或节拍锚点。
- 原始 SimpMusic 字符、解码器版本和诊断信息。

### Arrangement AST

Arrangement AST 使用 `shiqin-arrangement/v1` 版本标识，与 Score AST 分文件保存，至少包含：

- 每个可教学音符的右手手指 `1..5` 和目标 `eventId`。
- 手位区段的起止事件、覆盖音域、各手指对应音名及移动原因。
- 换位动作的起止手位、触发事件和预备说明。
- 每个和弦的目标小节或拍点、功能、实际音名、低音、转位、左手逐音手指和教学理由。
- 伴奏型、前奏、段间衔接和尾奏的曲目级建议及依据。
- `source_confirmed`、`manual_confirmed`、`auto_candidate`、`unavailable` 来源状态和可信度。
- 人工覆盖优先于算法候选，且覆盖范围精确到曲目版本和事件，不得跨第二调复用。

## ADDED Requirements

### Requirement: PPTX 作为基础谱面的权威来源

系统 SHALL 以 `712首-文字` 中编号一致的 PPTX 生成 1 至 712 首基础曲调的结构化谱面，不再用 OCR 数字作为这些曲目的默认音符来源。

#### Scenario: 导入完整基础曲库

- **WHEN** 执行结构化谱面生成命令
- **THEN** 系统发现恰好 712 份基础 PPTX，编号连续覆盖 001 至 712
- **AND** 导入报告记录 2658 张幻灯片的处理结果

#### Scenario: PPTX 与图片标题不完全一致

- **WHEN** 同编号 PPTX 与 JPG 文件名标题存在缩写或尾缀差异
- **THEN** 系统以编号作为曲目身份主键
- **AND** 同时保存两侧原始标题供诊断，不因标题差异错配或漏配

### Requirement: OOXML Source AST 保真解析

系统 SHALL 直接解析 PPTX ZIP 包和 OOXML，不依赖 PowerPoint、LibreOffice 或浏览器截图作为结构化导入前提。

#### Scenario: 解析 SimpMusic 文本 run

- **WHEN** shape 中包含多个字体或字号不同的文本 run
- **THEN** Source AST 按原顺序保存每个 run 的文本、字体、字号、样式、坐标上下文和来源 reference
- **AND** 不把 `SimpMusic Base` 与 `SimpMusic Accent` 合并成不可追溯的纯字符串

#### Scenario: 遇到不支持的 shape 或 relationship

- **WHEN** 导入器遇到暂不支持的 OOXML 节点
- **THEN** 节点类型、源文件和幻灯片编号进入诊断报告
- **AND** 导入器不得静默删除该节点或伪造语义

### Requirement: SimpMusic 字符映射可审计

系统 SHALL 对语料中实际出现的 `SimpMusic Base` 和 `SimpMusic Accent` 字符建立显式、版本化映射，并用黄金样例测试其音乐语义。

#### Scenario: Base 与 Accent 组成一个音符

- **WHEN** Accent 字形按位置覆盖或修饰 Base 字形
- **THEN** 解码器按字体、顺序和空间邻近关系把它们关联到同一语义事件
- **AND** 保存两者各自的原始字符和 source reference

#### Scenario: 出现未知 SimpMusic 字符

- **WHEN** 字符不在当前映射表中
- **THEN** Score AST 生成 `unknown` 事件并保留原始字形
- **AND** 该事件不得获得虚构的音高、时值、指法或和弦
- **AND** 批量校验失败并列出所有受影响曲目，直到映射补齐或进入明确的异常允许清单

### Requirement: 语义谱面事件稳定可引用

系统 SHALL 为 score page、system、measure 和 event 生成确定性的稳定 ID，使教学数据不依赖图片百分比坐标。

#### Scenario: 重复生成同一批 PPTX

- **WHEN** 源文件和解码规则未变化时连续执行两次生成
- **THEN** JSON 内容、节点 ID、文件路径和内容哈希保持一致

#### Scenario: 教学层锚定音符

- **WHEN** Arrangement AST 为某个音符指定右手指法
- **THEN** 该记录通过 `eventId` 指向 Score AST 中唯一的 `note` 事件
- **AND** SVG 排版变化后指法仍跟随该音符，不需要重算图片百分比坐标

### Requirement: 重复谱面与歌词版本分离

系统 SHALL 对同曲 PPTX 的多张幻灯片计算谱面指纹，将谱面相同而歌词不同的页面合并为一个 score page 加多个歌词版本。

#### Scenario: 幻灯片只更换歌词

- **WHEN** 两张幻灯片的 SimpMusic run、相对坐标和谱面样式一致，但中文歌词不同
- **THEN** 只生成一份谱面结构
- **AND** 两段歌词均保留各自的 slide reference 和显示顺序

#### Scenario: 幻灯片谱面真实不同

- **WHEN** 谱面事件、位置或结构指纹不同
- **THEN** 系统保留为独立 score page 或 system
- **AND** 不因标题或歌词相似而错误去重

### Requirement: 曲目定制的指法与手位

系统 SHALL 根据每首曲目的实际音符序列、调性、黑键、乐句、音域和前后文生成逐音指法与手位候选，不得向所有曲目复制固定五指位模板。

#### Scenario: 五指位内可完成的乐句

- **WHEN** 一个乐句可在自然手位内以合理手指完成
- **THEN** 候选优先保持固定手位
- **AND** 每个音符获得对应手指及选择理由

#### Scenario: 需要换位的乐句

- **WHEN** 旋律超出当前手位、包含黑键或需要为下一句预留手指
- **THEN** 候选在明确事件处生成手位移动
- **AND** 记录移动前后各手指对应音名、预备时机和不用硬伸手指的理由

#### Scenario: 黑键指法

- **WHEN** 调号或临时升降使音符落在黑键
- **THEN** 候选优先评估 2、3、4 指
- **AND** 只有在上下文成本更低时才使用 1 或 5 指，并记录原因

### Requirement: 曲目定制的和声与左手手指

系统 SHALL 基于已解码旋律、调性、拍点、乐句和终止位置生成逐曲和声候选，并为每个左手和弦给出实际音名、转位和逐音手指。

#### Scenario: 自动和声候选

- **WHEN** PPTX 未提供明确和弦而旋律语义完整
- **THEN** 系统可生成 `auto_candidate` 和声
- **AND** 每个候选记录适用小节、旋律证据、功能、可信度和替代项
- **AND** UI 不得把候选标为原谱事实或人工确认结论

#### Scenario: 原谱或人工和弦存在

- **WHEN** PPTX 可确认和弦，或该曲目版本存在人工覆盖
- **THEN** `source_confirmed` 或 `manual_confirmed` 记录覆盖同范围的算法候选
- **AND** 仍保留被覆盖候选供审计，但默认不显示

#### Scenario: 左手和弦教学

- **WHEN** SVG 显示一个左手和弦
- **THEN** 同时显示和弦符号、各音音名和每个音对应的左手手指
- **AND** 指法根据实际转位和前后和弦连接计算，不得统一硬编码为所有三和弦 `5-3-1`

### Requirement: SVG Layout Engine

系统 SHALL 使用 SVG 作为结构化谱面的主渲染载体，并由 Layout Engine 计算所有音乐与教学元素的位置。

#### Scenario: 渲染基础谱面

- **WHEN** Score AST 加载成功
- **THEN** 渲染器输出具有稳定 `viewBox` 的 SVG
- **AND** 音符、休止、时值线、八度点、小节线、连线和歌词使用独立 SVG 节点或分组
- **AND** SimpMusic 字体仅用于 `<text>` 字形，不负责元素间的版面关系

#### Scenario: 渲染教学层

- **WHEN** Arrangement AST 包含指法、手位和和弦
- **THEN** 指法位于目标音符上方
- **AND** 手位区段使用可辨识色带及 `Move to ... Position` 提示
- **AND** 和弦及左手手指位于对应小节或拍点的教学层
- **AND** 标签发生碰撞时由排版规则分配教学轨道，不覆盖关键谱面

#### Scenario: 缩放、旋转和打印

- **WHEN** 用户缩放、旋转、全屏或打印谱面
- **THEN** SVG 保持清晰，教学标记与音符保持对齐
- **AND** 不依赖图片加载完成事件决定标记是否出现

### Requirement: 按曲目拆分和动态加载

系统 SHALL 将大体量谱面与教学数据拆分为每曲独立资产，避免把 712 首音符坐标和编配放入应用主 JavaScript 包。

#### Scenario: 审计源数据

- **WHEN** 导入一首可结构化 PPTX
- **THEN** 系统在 `data/generated/hymn-sources/<hymn-key>.json` 保存 Source AST
- **AND** Score AST 的 source reference 可回溯到该审计资产
- **AND** 浏览器正常练习流程不请求 Source AST

#### Scenario: 打开单首练习页

- **WHEN** 用户打开第 N 首基础曲调
- **THEN** 浏览器只请求轻量目录以及该曲目的 `score.json`、`arrangement.json`
- **AND** 不下载其他 711 首结构化谱面

#### Scenario: 曲目资产加载失败

- **WHEN** JSON 请求失败、schema 不兼容或内容损坏
- **THEN** 查看器显示明确错误和重试入口
- **AND** 若 JPG 可用则允许切换到该曲目的图片回退

### Requirement: 图片回退与第二调隔离

系统 SHALL 保留 JPG 查看能力，但必须清楚区分结构化谱面和回退图片。

#### Scenario: 3 份无 Base 字体的 PPTX

- **WHEN** 用户打开 060、063 或 444
- **THEN** 系统使用对应 JPG
- **AND** 显示“PPTX 无结构化 SimpMusic 谱面”的来源说明
- **AND** 不生成伪造音符级教学标记

#### Scenario: 打开第二调

- **WHEN** 用户打开 35 个 `b` 版本中的任意一个
- **THEN** 系统只使用该第二调自己的 JPG 和独立人工数据
- **AND** 不读取或展示同编号原调的 Score AST、指法、手位或和弦

### Requirement: 字体授权与发布门禁

系统 SHALL 将字体发现、渲染可用性和字体分发授权视为三个独立状态。

#### Scenario: 本地已安装已知字体

- **WHEN** 本地字体文件哈希与已知值一致
- **THEN** 开发环境可通过系统字体渲染 SVG
- **AND** 生成流程不得默认复制字体到仓库或 `public`

#### Scenario: 公开构建未确认授权

- **WHEN** 未提供明确的字体分发授权配置
- **THEN** 构建产物不得包含 TTF、WOFF、字体子集、base64 字体或由字体轮廓转换的 SVG path
- **AND** 运行时字体不可用时自动使用 JPG 回退

#### Scenario: 允许打包字体

- **WHEN** 分发授权配置已显式启用且字体哈希匹配
- **THEN** 构建流程可复制已授权字体资源并生成 `@font-face`
- **AND** 哈希不一致时立即失败，不接受同名未知字体

### Requirement: 批量诊断与质量门禁

系统 SHALL 为每次导入生成机器可读报告，报告数量、覆盖率、去重结果、未知字形、回退原因、schema 版本和内容哈希。

#### Scenario: 语料未变化

- **WHEN** 在相同源码和工具版本上重复生成
- **THEN** 报告和曲目资产保持确定性

#### Scenario: 语料结构意外变化

- **WHEN** PPTX 数、幻灯片数、Base/Accent 使用数、异常清单或第二调数偏离已确认基线
- **THEN** 校验命令失败并给出差异
- **AND** 必须显式更新语料清单后才能接受变化

### Requirement: 可访问性与无字体降级

系统 SHALL 为 SVG 提供可访问名称和文本摘要，并在字体缺失时保持用户可读。

#### Scenario: 屏幕阅读器访问

- **WHEN** 查看器呈现结构化谱面
- **THEN** SVG 包含曲目标题、调号、拍号和当前页面说明
- **AND** 交互控件保留可访问名称与键盘操作

#### Scenario: 浏览器未加载 SimpMusic 字体

- **WHEN** `document.fonts` 检测不到所需字体
- **THEN** 系统不显示错误字形组成的谱面
- **AND** 自动切换至 JPG 并说明字体不可用

## MODIFIED Requirements

### Requirement: 曲库目录

曲库目录 SHALL 继续覆盖 747 个版本，并新增 `score_source`、`score_asset_url`、`arrangement_asset_url`、`fallback_reason` 和 schema 版本等轻量元数据。目录本身不得包含整首音符、指法或坐标数组。

#### Scenario: 基础曲调目录项

- **WHEN** 基础 PPTX 已成功结构化
- **THEN** 目录项标记 `score_source` 为 `pptx`
- **AND** 提供该曲目的独立资产 URL

#### Scenario: 图片回退目录项

- **WHEN** 曲目属于第二调或 PPTX 异常清单
- **THEN** 目录项标记 `score_source` 为 `image`
- **AND** 记录明确回退原因

### Requirement: 诗歌预备方案

诗歌预备方案 SHALL 从 Arrangement AST 异步读取逐曲教学数据。状态文案必须区分原谱事实、人工确认、算法候选和不可用，不得再显示“OCR + 指法规则候选”作为基础曲调的默认来源。

#### Scenario: 算法候选已生成

- **WHEN** 曲目有完整 Score AST 和自动 Arrangement AST
- **THEN** 页面显示该曲真实的逐音指法、手位变化、和弦与左手逐音手指
- **AND** 明确标记为自动候选及其依据

#### Scenario: 人工覆盖已存在

- **WHEN** 某个事件或小节有人工确认记录
- **THEN** 页面优先显示人工记录
- **AND** 未覆盖范围继续使用可区分的算法候选

### Requirement: 歌谱查看器

`ScoreViewer` SHALL 优先渲染按需加载的 SVG 结构化谱面，并在来源、字体或资产不可用时回退 JPG。缩放、旋转、适合宽度和全屏能力继续保留。

## REMOVED Requirements

### Requirement: OCR 作为基础曲调的默认音符来源

**Reason**: 图片 OCR 无法稳定识别 SimpMusic 的时值、八度点、连线和精确音符关系，且现有 PPTX 已提供更可靠的结构化文本与坐标。

**Migration**: `ocr:hymns` 保留为图片回退和校对工具，但从 `prebuild`、基础曲调 Score AST 和默认教学候选生成中移除。

### Requirement: HTML span 百分比叠加谱面教学

**Reason**: 标记依赖图片尺寸、加载状态和人工百分比坐标，缩放与排版后不能稳定锚定音符。

**Migration**: 将指法、手位和和弦迁移为 Arrangement AST 中的事件锚点，由 SVG Layout Engine 计算位置。

### Requirement: 集中式 `hymn-guides.generated.ts`

**Reason**: 该文件包含全曲库大量坐标并进入主包，造成首包膨胀，也使单曲数据无法独立校验和缓存。

**Migration**: 生成 `public/materials/hymns/<hymn-key>/score.json`、`arrangement.json`，运行时按曲目异步加载；人工覆盖保留在独立、按曲目版本隔离的数据文件中。

### Requirement: 原调与第二调共用教学方案

**Reason**: 第二调可能具有不同调性、音域、手位和和弦，复用原调 AST 会直接产生错误教学。

**Migration**: 基础键与 `b` 版本使用独立资产身份。无第二调 PPTX 时只显示第二调图片及其独立人工数据。
