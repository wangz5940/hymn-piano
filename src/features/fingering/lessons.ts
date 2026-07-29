export interface FingeringPrinciple {
  id: string;
  title: string;
  rule: string;
  reason: string;
  practice: string;
}

export interface FingeringWorkflowStep {
  title: string;
  question: string;
  output: string;
}

export interface PositionNote {
  jianpu: string;
  note: string;
  finger: string;
  reason: string;
}

export interface LeftHandChord {
  symbol: string;
  notes: string;
  fingering: string;
  reason: string;
}

export interface PhraseFingering {
  phrase: string;
  chord: string;
  right_hand: string;
  left_hand: string;
  reason: string;
}

export interface HymnFingeringDemo {
  title: string;
  key_signature: string;
  purpose: string;
  right_hand_position: PositionNote[];
  left_hand_chords: LeftHandChord[];
  phrases: PhraseFingering[];
  transfer_rule: string[];
}

export const fingeringPrinciples: readonly FingeringPrinciple[] = [
  {
    id: "stay-in-position",
    title: "能固定手位，就不要移动",
    rule: "五度以内先找一个稳定手位，只有音域超出或下一句需要预备时才移动。",
    reason:
      "频繁换指会让初学者失去键盘方向。先稳定手位，才能把注意力放在节拍、旋律和左手。",
    practice: "拿到新谱先圈最低音和最高音，判断一个五指位能不能覆盖。",
  },
  {
    id: "avoid-thumb-on-black-keys",
    title: "黑键优先给 2、3、4 指",
    rule: "拇指不要为了省事去够黑键，除非后面乐句确实需要。",
    reason:
      "拇指短，硬上黑键会让手腕扭曲。2、3、4 指更适合自然落在黑键上。",
    practice: "遇到 F♯、C♯、B♭ 时，先检查是否能调整手位让中间手指处理。",
  },
  {
    id: "plan-next-phrase",
    title: "指法不是看这一拍，而是看下一句",
    rule: "句尾不要机械用 5 指结束，要为下一句的起音预留舒服的手指。",
    reason:
      "许多停顿不是因为当前音难，而是上一句结束时把手指用死了。",
    practice: "每句结束前先看后两拍或下一小节，写下是否需要换位或穿指。",
  },
  {
    id: "chord-shapes",
    title: "和弦音型优先形成固定手感",
    rule: "右手三和弦音型常用 1-3-5；左手基础三和弦常用 5-3-1。",
    reason:
      "赞美诗伴奏大量依赖功能和弦。固定手感能减少现场反应时间。",
    practice: "把当前调的 I、IV、V、vi 和弦都用同一套手感练到不用看手。",
  },
  {
    id: "explain-the-why",
    title: "平台要教“为什么”，不是只给数字",
    rule: "每个指法都要能解释：调性、音域、手位、和弦、下一句。",
    reason:
      "只记数字只能弹这一首；理解原因，才可以迁移到下一首陌生诗歌。",
    practice: "每次预备诗歌时，至少写出一处“为什么不用另一个指法”。",
  },
];

export const fingeringWorkflow: readonly FingeringWorkflowStep[] = [
  {
    title: "看调性",
    question: "这首是什么调？主音 1 在哪里？有哪些升降号？",
    output: "确定键盘基准和避免误弹的黑键。",
  },
  {
    title: "看音域",
    question: "右手最低音、最高音在哪里？一个五指位能覆盖吗？",
    output: "决定起始手位和是否需要移动。",
  },
  {
    title: "看旋律走向",
    question: "旋律是级进、跳进、重复音，还是三和弦音型？",
    output: "级进用顺指，三和弦用固定形状，跳进提前换位。",
  },
  {
    title: "看和弦",
    question: "谱上标了哪些和弦？左手是不是可以先固定和弦形状？",
    output: "确定左手 5-3-1、七和弦 5-3-2-1 或简化低音。",
  },
  {
    title: "看下一句",
    question: "这一句结束后，下一句从哪里开始？当前指法会不会把手卡住？",
    output: "决定句尾换指、移动手位或保留手指。",
  },
];

export const crossRoadDemo: HymnFingeringDemo = {
  title: "十架窄路",
  key_signature: "D 大调，F♯、C♯",
  purpose:
    "这首不是选本曲库中的图片谱，而是指法文档里的赞美诗示范。它适合训练 D 大调固定手位、左手和弦反应和“先分析再配指”的能力。",
  right_hand_position: [
    { jianpu: "1", note: "D", finger: "1", reason: "主音放拇指，建立 D 大调基准。" },
    { jianpu: "2", note: "E", finger: "2", reason: "级进上行，保持自然顺指。" },
    { jianpu: "3", note: "F♯", finger: "3", reason: "黑键由中间手指处理，避免拇指硬够。" },
    { jianpu: "4", note: "G", finger: "1（换位）", reason: "为 5、6、7、1' 预备新手位。" },
    { jianpu: "5", note: "A", finger: "2", reason: "换位后继续顺指，不频繁跳指。" },
    { jianpu: "6", note: "B", finger: "3", reason: "保持手掌稳定，方便到 C♯。" },
    { jianpu: "7", note: "C♯", finger: "4", reason: "C♯ 是黑键，用 4 指自然落键。" },
    { jianpu: "1'", note: "D", finger: "5", reason: "最高音用 5 指，避免再移动一次。" },
  ],
  left_hand_chords: [
    { symbol: "G", notes: "G B D", fingering: "5-3-1", reason: "IV 级和弦，左手固定形状即可。" },
    { symbol: "A", notes: "A C♯ E", fingering: "5-3-1", reason: "V 级和弦，预备回 D 或进入下句。" },
    { symbol: "Bm", notes: "B D F♯", fingering: "5-3-1", reason: "vi 级小和弦，保持同一手型。" },
    { symbol: "Em", notes: "E G B", fingering: "5-3-1", reason: "ii 级小和弦，适合低音加和弦。" },
    { symbol: "F#m", notes: "F♯ A C♯", fingering: "5-3-1", reason: "iii 级小和弦，黑键不影响左手形状。" },
    { symbol: "D", notes: "D F♯ A", fingering: "5-3-1", reason: "I 级主和弦，是全曲落点。" },
    { symbol: "A7", notes: "A C♯ E G", fingering: "5-3-2-1", reason: "七和弦多一个 G，用 2 指分担更稳。" },
  ],
  phrases: [
    {
      phrase: "1 3 5",
      chord: "G",
      right_hand: "D-F♯-A：1-3-5",
      left_hand: "G-B-D：5-3-1",
      reason: "旋律本身是三和弦骨架，右手用 1-3-5 最自然；左手直接按 G 和弦，不用从旋律猜和弦。",
    },
    {
      phrase: "6 .1 7 2 6 7",
      chord: "A",
      right_hand: "B-D-C♯-E-B-C♯：3-5-4-1-3-4",
      left_hand: "A-C♯-E：5-3-1",
      reason: "D 到 C♯ 用 5-4 顺手，C♯ 到 E 用 4-1 完成换位，为后面 B-C♯ 留出 3-4。",
    },
    {
      phrase: "5 — 5 5 4 3",
      chord: "F#m",
      right_hand: "A-A-A-G-F♯：2-2-2-1-3",
      left_hand: "F♯-A-C♯：5-3-1",
      reason: "不用 5 指连续压 A，是为了马上进入 6 时手不被卡住；这正是“看下一句”。",
    },
    {
      phrase: "6 — 3 6 7 1",
      chord: "Bm",
      right_hand: "B-F♯-B-C♯-D：3-1-3-4-5",
      left_hand: "B-D-F♯：5-3-1",
      reason: "B 到 F♯ 是跳进，用 3-1 让手掌自然回收，再顺指走向高音 D。",
    },
  ],
  transfer_rule: [
    "先确认调性：D 大调有 F♯、C♯。",
    "右手用一个主要手位覆盖大部分旋律，只有到 4 之后才换位。",
    "左手把 D、G、A、Bm、Em、F#m、A7 练成固定形状。",
    "每次写指法时都要写理由：是因为手位、黑键、和弦，还是下一句。",
  ],
};
