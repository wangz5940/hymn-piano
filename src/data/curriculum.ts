import type {
  CurriculumPhase,
  CurriculumWeek,
  PracticeDay,
  PracticeTask,
} from "@/features/curriculum/types";

interface WeekSpec {
  title: string;
  capability: string;
  technical: string;
  accompaniment: string;
  reading: string;
  hymn_numbers: number[];
  pass: string;
}

const weekSpecs: readonly WeekSpec[] = [
  { title: "认识十根手指", capability: "看到指号就能指出对应手指", technical: "中央 C、黑键分组与左右手 1—5 指", accompaniment: "左手单音 C 与 G，保持放松", reading: "C 大调 2 小节级进简谱", hymn_numbers: [371], pass: "左右手指号反应正确，并连续弹完 2 小节" },
  { title: "建立 C 五指位", capability: "固定手位内不临时乱换指", technical: "右手 C4—G4、左手 C3—G3 五指位", accompaniment: "左手根音每小节一次", reading: "C 大调 4 小节重复音与级进", hymn_numbers: [371, 461], pass: "不看手完成 C 五指位上下行" },
  { title: "把节拍放进手里", capability: "全音符、二分音符、四分音符不抢拍", technical: "小汤 1 节奏与休止训练", accompaniment: "C、G 根音按 4/4 拍进入", reading: "先拍手再弹 4 小节", hymn_numbers: [461], pass: "节拍器 52 BPM 连续演奏且不停顿" },
  { title: "第一次最小双手", capability: "右手旋律时左手按计划进入", technical: "小汤 1 固定手位双手片段", accompaniment: "每小节第一拍加入左手根音", reading: "4—8 小节最小双手", hymn_numbers: [371, 461], pass: "以 52—56 BPM 完成 8 小节最小双手" },
  { title: "认识 C、F、G 和弦", capability: "看见和弦名能摆出基本形", technical: "小汤 2 固定手位与三和弦", accompaniment: "C、F、G 柱式和弦", reading: "4 小节旋律配每小节一个和弦", hymn_numbers: [240, 285], pass: "三种和弦各连续找到五次且无明显紧张" },
  { title: "和弦切换不停拍", capability: "左手提前准备下一个和弦", technical: "C—F—G—C 慢速循环", accompaniment: "低音—和弦的二拍型", reading: "8 小节简谱，先右手后合手", hymn_numbers: [240], pass: "56 BPM 完成四轮 C—F—G—C" },
  { title: "三拍子伴奏", capability: "保持强弱弱并让旋律在上方", technical: "3/4 拍与附点二分音符", accompaniment: "低音—和弦—和弦", reading: "三拍子 8 小节新谱", hymn_numbers: [285, 214], pass: "三拍子重拍清楚，左手不盖过旋律" },
  { title: "完成第一首双手诗歌", capability: "从第一小节连续到尾奏位置", technical: "小汤 2 已学手位总复习", accompaniment: "在柱式与低音—和弦间选择", reading: "8 小节陌生诗歌片段", hymn_numbers: [371, 240], pass: "完成一首简易诗歌并说出调、拍号和和弦" },
  { title: "从小汤进入拜厄", capability: "在拜厄学生声部中继续使用手位思维", technical: "拜厄 PDF 7—9 页的学生练习", accompaniment: "左手 C、G 单音与五度", reading: "五线谱与简谱对照 4 小节", hymn_numbers: [256], pass: "能指出学生声部并解释前三个音的指法" },
  { title: "左手独立进入", capability: "右手保持时左手弹不同节奏", technical: "拜厄 11—13 页学生声部", accompaniment: "1—5—1 低音型", reading: "8 小节双手不同节奏", hymn_numbers: [256, 207], pass: "60 BPM 下左右手不同节奏连续 8 小节" },
  { title: "分解和弦入门", capability: "左手按和弦形状逐音展开", technical: "C、F、G 分解三和弦", accompaniment: "1—5—3—5 四拍型", reading: "和弦标记每两小节变化", hymn_numbers: [207], pass: "三种分解和弦各完成四轮不看手" },
  { title: "乐句与呼吸", capability: "知道哪里连接、哪里抬手", technical: "拜厄 15—17 页连奏与乐句", accompaniment: "句尾减弱，下一句提前准备", reading: "8—12 小节含连音线的新谱", hymn_numbers: [340, 214], pass: "完成两句有清楚呼吸的双手演奏" },
  { title: "进入 G 大调", capability: "把 1 定位到 G 并记住 F♯", technical: "G 大调五指位与音阶前半段", accompaniment: "G、C、D 和弦", reading: "G 大调 8 小节简谱", hymn_numbers: [347], pass: "不把 F♯弹成 F，并完成 I—IV—V—I" },
  { title: "进入 F 大调", capability: "把 1 定位到 F 并记住 B♭", technical: "F 大调五指位与拇指避黑键", accompaniment: "F、B♭、C 和弦", reading: "F 大调 8 小节简谱", hymn_numbers: [285], pass: "说出 B♭位置并稳定换三个主和弦" },
  { title: "进入 D 大调", capability: "识别 F♯、C♯并规划黑键指法", technical: "D 大调五指位与一组音阶", accompaniment: "D、G、A 和弦", reading: "D 大调 8 小节简谱", hymn_numbers: [119], pass: "D 大调音阶分手正确，和弦切换不停拍" },
  { title: "关系小调", capability: "听辨大调与小调色彩并找到主和弦", technical: "A、E、D 自然小调音型", accompaniment: "Am、Dm、E 与 Em、Am、B7", reading: "小调 8 小节简谱", hymn_numbers: [37], pass: "能为 A 小调旋律选择 i—iv—V" },
  { title: "和弦转位", capability: "用最近距离换和弦", technical: "C、F、G 与 Am 三和弦转位", accompaniment: "C—G/B—Am—F", reading: "标出共同音并慢速连接", hymn_numbers: [461, 240], pass: "四和弦循环中每次移动不超过必要距离" },
  { title: "六八拍律动", capability: "感受两大拍而不是数成六个重拍", technical: "6/8 拍分组与附点四分音符", accompaniment: "低音—分解和弦的六拍型", reading: "6/8 拍 8 小节新谱", hymn_numbers: [214], pass: "以两大拍口数完成 8 小节" },
  { title: "移动手位", capability: "在乐句边界整体移动而非硬撑手指", technical: "C 位、G 位与返回动作", accompaniment: "低音八度预备", reading: "含六度跨度的 12 小节旋律", hymn_numbers: [250], pass: "提前说出移动位置并无停顿完成" },
  { title: "特殊指法动作", capability: "识别扩指、缩指、穿指、跨指与换指", technical: "每种动作 2—4 次慢练与放松检查", accompaniment: "音阶式低音连接", reading: "圈出特殊动作后再视奏", hymn_numbers: [220], pass: "能说明动作目的，手腕无扭转与僵硬" },
  { title: "读懂和弦标记", capability: "从调内级数理解和弦而非死记键位", technical: "C、G、F、D 调 I、IV、V、vi", accompaniment: "按级数快速找到三和弦", reading: "8 小节只看和弦标记配左手", hymn_numbers: [227], pass: "四个调中各完成一次 I—IV—V—I" },
  { title: "低音加和弦", capability: "左手第一拍给方向，后拍保持和声", technical: "根音与三和弦交替", accompaniment: "4/4 低音—和弦—和弦—和弦", reading: "16 小节连续换和弦", hymn_numbers: [207], pass: "16 小节左手不断，右手旋律清楚" },
  { title: "分解伴奏型", capability: "按拍号选择分解顺序", technical: "1—5—3—5 与 1—3—5—3", accompaniment: "四拍分解和弦", reading: "每小节一到两个和弦变化", hymn_numbers: [256], pass: "两种伴奏型可在同一和弦进行中切换" },
  { title: "半分解伴奏", capability: "低音与上方和弦形成稳定层次", technical: "低音—五度—和弦组合", accompaniment: "适合中速诗歌的半分解型", reading: "12 小节陌生谱连续演奏", hymn_numbers: [240], pass: "左手层次清楚且音量低于旋律" },
  { title: "提前看一拍", capability: "眼睛始终走在手前面", technical: "遮住已弹小节的视奏训练", accompaniment: "提前观察下一和弦", reading: "16 小节不停顿视奏", hymn_numbers: [347], pass: "少量错音时仍保持拍点完成 16 小节" },
  { title: "附点与切分", capability: "复杂一点的节奏仍有稳定内拍", technical: "附点四分、八分与简单切分", accompaniment: "保持左手基本拍", reading: "先口数再弹 12 小节", hymn_numbers: [445], pass: "节奏型连续三遍一致" },
  { title: "同旋律换调", capability: "先移动主音，再迁移级数与和弦", technical: "C 到 G、F 到 G 的短句移调", accompaniment: "按级数迁移 I—IV—V", reading: "同一 8 小节用两个调完成", hymn_numbers: [371], pass: "移调后旋律关系和和弦功能保持一致" },
  { title: "十六小节连续视奏", capability: "用结构和重复句降低阅读负担", technical: "先标段落、重复和跳进", accompaniment: "选择最简单可持续伴奏", reading: "16 小节全曲视奏", hymn_numbers: [285, 461], pass: "不停顿完成 16 小节并复盘三个位置" },
  { title: "二十四小节连续演奏", capability: "长段落中保持速度和方向", technical: "拜厄 51—60 页流畅性片段", accompaniment: "整曲使用一种稳定伴奏型", reading: "24 小节低速视奏", hymn_numbers: [340], pass: "全曲最多一次明显停顿" },
  { title: "力度与句法", capability: "旋律有方向，重复段不机械复制", technical: "渐强、渐弱与句尾处理", accompaniment: "左手保持柔和并支持高潮", reading: "标出两处力度层次", hymn_numbers: [136], pass: "录音中可听出主次和两处句法变化" },
  { title: "踏板随和声更换", capability: "踏板不混浊、不替代手指连接", technical: "先弹后踩、换和弦时同步更换", accompaniment: "慢速柱式和弦踏板", reading: "8 小节和弦变化练习", hymn_numbers: [214], pass: "录音中和弦更换清楚，无持续混响" },
  { title: "突出右手旋律", capability: "同一双手动作中做出音量层次", technical: "右手旋律强、内声和左手轻", accompaniment: "减少左手重复重音", reading: "16 小节旋律层次检查", hymn_numbers: [37], pass: "不看画面也能从录音辨认完整旋律" },
  { title: "设计前奏", capability: "从末句或主旋律给出明确起唱提示", technical: "提取末句 2—4 小节", accompaniment: "前奏保持原调、原拍与目标速度", reading: "为两首诗歌写入口提示", hymn_numbers: [240, 256], pass: "前奏后能在正确拍点自然进入第一句" },
  { title: "设计间奏", capability: "段落之间保持呼吸又不失去拍点", technical: "复制末句、缩短或延长一小节", accompaniment: "维持和声方向与下段起拍", reading: "两种段间衔接方案", hymn_numbers: [207, 347], pass: "间奏长度稳定，下一段进入无犹豫" },
  { title: "设计尾奏", capability: "给领诗者和会众明确结束", technical: "终止式、延长主和弦与渐慢", accompaniment: "V—I 终止与主音收束", reading: "为两首诗歌比较两种结束", hymn_numbers: [285, 340], pass: "不靠口头说明也能听出结束位置" },
  { title: "三十二小节与阶段曲目", capability: "从分析、预备到完整录音形成闭环", technical: "拜厄 71—90 页按能力选段", accompaniment: "稳定型、层次与踏板综合", reading: "32 小节连续演奏", hymn_numbers: [136, 461], pass: "完整录音最多一次停顿，并写出下一目标" },
  { title: "四类诗歌伴奏型", capability: "根据速度与气质选择而非固定套型", technical: "柱式、低音加和弦、分解、八度低音", accompaniment: "同一和弦进行使用四种织体", reading: "比较四种伴奏的会众可跟随性", hymn_numbers: [371, 240], pass: "能说明每种伴奏型适用场景" },
  { title: "为诗歌选择伴奏", capability: "从拍号、速度、歌词语气作选择", technical: "先简后繁的编配决策", accompaniment: "每段最多一种主伴奏型", reading: "三首不同速度诗歌快速预备", hymn_numbers: [136, 256, 445], pass: "三首诗歌都能给出有理由的伴奏选择" },
  { title: "服侍前奏与起唱", capability: "让领诗者清楚听见调、速度和入口", technical: "末句前奏、主和弦预备与数拍", accompaniment: "前奏末拍保留呼吸", reading: "随机抽两首做 4 小节前奏", hymn_numbers: [207, 285], pass: "模拟领诗者三次都能准确进入" },
  { title: "间奏与尾奏协同", capability: "段落衔接和结束不靠临场猜测", technical: "间奏长度、末段提示与终止式", accompaniment: "最后一遍适度扩展但不拖拍", reading: "完整主歌—间奏—副歌—尾奏", hymn_numbers: [214, 347], pass: "完整结构一遍完成且段落边界明确" },
  { title: "相邻常用调移调", capability: "把级数、和弦功能和手位整体迁移", technical: "C↔D、F↔G 的旋律与和弦", accompaniment: "罗马数字先行的移调", reading: "一首熟诗歌用两个调演奏", hymn_numbers: [371, 461], pass: "20 分钟内完成相邻调基础伴奏" },
  { title: "完成一首服侍编配", capability: "把看谱、和声、伴奏与段落整合", technical: "固定指法、难点和踏板方案", accompaniment: "主歌、副歌的织体层次", reading: "从前奏到尾奏完整录音", hymn_numbers: [240, 256], pass: "录音可供会众跟唱，且自评五项均不低于 3" },
  { title: "跟随领诗者", capability: "根据重复、延长与结束手势及时反应", technical: "保持左手拍点，右手简化也不中断", accompaniment: "预留可延长的主和弦与属和弦", reading: "模拟重复一段与提前结束", hymn_numbers: [285, 136], pass: "三种临时指令均在两拍内响应" },
  { title: "建立会众速度", capability: "选择可唱、可呼吸而非只顾钢琴流畅", technical: "用唱词检查速度与句长", accompaniment: "节奏清楚但不抢领诗者", reading: "三种 BPM 比较并记录", hymn_numbers: [214, 340], pass: "能说明目标速度并稳定保持全曲" },
  { title: "弱起、数拍与入口", capability: "弱起诗歌也能给出准确预备拍", technical: "完整小节、弱起小节与数拍手势", accompaniment: "前奏末尾保留弱起空间", reading: "识别并模拟三种入口", hymn_numbers: [347, 207], pass: "领诗者在弱起位置三次进入正确" },
  { title: "现场错误恢复", capability: "错音、漏拍或翻页后不从头重来", technical: "保持左手、简化右手、在下一强拍会合", accompaniment: "准备主和弦安全落点", reading: "人为设置三处中断再恢复", hymn_numbers: [240, 461], pass: "每次错误后两拍内恢复稳定拍点" },
  { title: "预备一组聚会曲单", capability: "统一考虑调性、速度、顺序和换歌时间", technical: "逐首写调、拍号、入口和结束", accompaniment: "控制相邻曲目织体与音量差异", reading: "完成 3—5 首顺序模拟", hymn_numbers: [136, 371, 240, 285, 347], pass: "完整曲单无换歌中断，备注可由他人读懂" },
  { title: "结业服侍模拟", capability: "独立预备陌生诗歌并稳定支持会众", technical: "10 首抽样分析与三首连续模拟", accompaniment: "按曲目选择最稳妥的基础织体", reading: "陌生谱限时预备与完整演奏", hymn_numbers: [461, 207, 256, 340, 445], pass: "10 首中 8 首连续弹完，3 首曲单无中断性错误" },
];

export const curriculumPhases: readonly CurriculumPhase[] = [
  { id: "phase-1", order: 1, title: "手指与手位", week_start: 1, week_end: 4, outcome: "建立指号、键盘定位和最小双手" },
  { id: "phase-2", order: 2, title: "基础双手", week_start: 5, week_end: 8, outcome: "使用 C、F、G 和弦完成简单伴奏" },
  { id: "phase-3", order: 3, title: "左右手独立", week_start: 9, week_end: 12, outcome: "从小汤迁移到拜厄与分解和弦" },
  { id: "phase-4", order: 4, title: "调性扩展", week_start: 13, week_end: 20, outcome: "掌握常用调、转位和移动手位" },
  { id: "phase-5", order: 5, title: "简谱双手", week_start: 21, week_end: 28, outcome: "根据简谱与和弦标记组织双手" },
  { id: "phase-6", order: 6, title: "完整演奏", week_start: 29, week_end: 36, outcome: "形成连续性、层次、踏板和完整结构" },
  { id: "phase-7", order: 7, title: "诗歌伴奏", week_start: 37, week_end: 42, outcome: "设计伴奏、前奏、间奏、尾奏与移调" },
  { id: "phase-8", order: 8, title: "聚会服侍", week_start: 43, week_end: 48, outcome: "跟随领诗、恢复错误并完成曲单模拟" },
];

function getPhase(week: number): CurriculumPhase {
  const phase = curriculumPhases.find(
    (candidate) => week >= candidate.week_start && week <= candidate.week_end,
  );
  if (!phase) throw new Error(`第 ${week} 周没有阶段定义`);
  return phase;
}

function getMaterials(week: number): string[] {
  if (week <= 4) return ["小汤 1", "C 大调五指练习", "选本诗歌简易片段"];
  if (week <= 8) return ["小汤 2", "C/F/G 和弦", "选本诗歌简易伴奏"];
  if (week <= 12) return ["拜厄 PDF 7—17 页学生声部", "小汤复习", "简谱视奏"];
  if (week <= 20) return ["拜厄 PDF 18—40 页", "音阶与和弦转位", "哈农 1—5 条可选 3—5 分钟"];
  if (week <= 28) return ["拜厄 PDF 41—70 页", "简谱与和弦标记", "陌生诗歌视奏"];
  if (week <= 36) return ["拜厄 PDF 71—90 页", "完整曲目", "录音复盘"];
  return ["选本诗歌 712", "和弦与伴奏型", "聚会服侍模拟"];
}

function makeTask(
  week: number,
  day: 1 | 2 | 3,
  index: number,
  task: Omit<PracticeTask, "id">,
): PracticeTask {
  return { ...task, id: `w${week}-d${day}-t${index}` };
}

function makeDay(week: number, day: 1 | 2 | 3, spec: WeekSpec): PracticeDay {
  const focus = day === 1 ? "学习" : day === 2 ? "连接" : "服侍模拟";
  const dayGuidance =
    day === 1
      ? "先慢速确认动作与位置"
      : day === 2
        ? "连接前后乐句并减少看手"
        : "保持连续，结束后再修错";
  const finalKind = week >= 37 && day === 3 ? "service_simulation" : "sight_reading";
  const finalTitle = finalKind === "service_simulation" ? "聚会情境模拟" : "陌生谱视奏";

  const tasks: PracticeTask[] = [
    makeTask(week, day, 1, {
      kind: "warmup",
      title: "放松与定位",
      minutes: 5,
      objective: `${spec.technical}；先检查肩、腕和指尖是否放松。`,
      completion_criteria: ["呼吸自然", "手腕无僵硬", "能说出本次起始手位"],
    }),
    makeTask(week, day, 2, {
      kind: "method",
      title: "方法与技术",
      minutes: 15,
      objective: `${spec.technical}。${dayGuidance}。`,
      completion_criteria: ["动作可解释", "指法固定", "慢速连续两遍"],
    }),
    makeTask(week, day, 3, {
      kind: "accompaniment",
      title: "伴奏语汇",
      minutes: 15,
      objective: `${spec.accompaniment}。先左手，再加入右手或唱旋律。`,
      completion_criteria: ["和弦位置正确", "左手节拍稳定", "音量不盖过旋律"],
    }),
    makeTask(week, day, 4, {
      kind: "repertoire",
      title: "本周诗歌",
      minutes: 15,
      objective: `练习建议诗歌 ${spec.hymn_numbers.map((number) => `第 ${number} 首`).join("、")}；${dayGuidance}。`,
      completion_criteria: ["确认调号与拍号", "记录一个难点", "从当前范围起点弹到终点"],
      suggested_hymn_numbers: spec.hymn_numbers,
    }),
    makeTask(week, day, 5, {
      kind: finalKind,
      title: finalTitle,
      minutes: 10,
      objective:
        finalKind === "service_simulation"
          ? `${spec.reading}；加入前奏、入口或尾奏，并允许小错后继续。`
          : `${spec.reading}；先用 30 秒看调、拍号、重复与手位，再开始。`,
      completion_criteria:
        finalKind === "service_simulation"
          ? ["入口明确", "全程不停拍", "结束清楚"]
          : ["视线领先一拍", "少量错音不停下", "记录最需要复习的小节"],
      suggested_hymn_numbers: spec.hymn_numbers,
    }),
  ];

  return { id: `w${week}-d${day}`, week, day, focus, tasks };
}

export const curriculum: readonly CurriculumWeek[] = weekSpecs.map(
  (spec, index) => {
    const week = index + 1;
    const phase = getPhase(week);
    return {
      week,
      phase_id: phase.id,
      phase_title: phase.title,
      title: spec.title,
      capability: spec.capability,
      materials: getMaterials(week),
      hymn_numbers: spec.hymn_numbers,
      pass_criteria: [
        spec.pass,
        "能说出本周一个具体问题与下一次目标",
        "演奏过程中出现小错时不立即从头开始",
      ],
      days: ([1, 2, 3] as const).map((day) => makeDay(week, day, spec)),
    };
  },
);
