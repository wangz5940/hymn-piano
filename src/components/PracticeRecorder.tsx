import { Check, Pause, Play, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import type {
  AccompanimentPattern,
  PracticeMode,
  Rating,
  SelfRating,
} from "@/features/progress/types";
import { usePracticeTimer } from "@/hooks/usePracticeTimer";
import { useAppStore } from "@/store/useAppStore";

interface PracticeRecorderProps {
  hymnKey: string;
}

const modes: readonly [PracticeMode, string][] = [
  ["right_hand", "右手"],
  ["left_hand", "左手"],
  ["hands_together", "合手"],
  ["service", "服侍模拟"],
];

const ratingFields: readonly [keyof SelfRating, string][] = [
  ["continuity", "连续性"],
  ["pulse", "节拍"],
  ["left_hand", "左手"],
  ["melody", "旋律"],
  ["leadership", "配合"],
];

export function PracticeRecorder({ hymnKey }: PracticeRecorderProps) {
  const addRecord = useAppStore((state) => state.addPracticeRecord);
  const timer = usePracticeTimer();
  const [practiceKey, setPracticeKey] = useState("C");
  const [targetBpm, setTargetBpm] = useState(72);
  const [pattern, setPattern] =
    useState<AccompanimentPattern>("bass_chord");
  const [mode, setMode] = useState<PracticeMode>("hands_together");
  const [introReady, setIntroReady] = useState(false);
  const [endingReady, setEndingReady] = useState(false);
  const [rating, setRating] = useState<SelfRating>({
    continuity: 3,
    pulse: 3,
    left_hand: 3,
    melody: 3,
    leadership: 3,
  });
  const [issue, setIssue] = useState("");
  const [nextGoal, setNextGoal] = useState("");
  const [saved, setSaved] = useState(false);

  const updateRating = (key: keyof SelfRating, value: number) => {
    setRating((current) => ({
      ...current,
      [key]: Math.min(5, Math.max(1, value)) as Rating,
    }));
  };

  const save = () => {
    addRecord({
      id: `practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      hymn_key: hymnKey,
      started_at: new Date().toISOString(),
      duration_seconds: timer.seconds,
      practice_key: practiceKey,
      target_bpm: targetBpm,
      pattern,
      mode,
      intro_ready: introReady,
      ending_ready: endingReady,
      self_rating: rating,
      issue: issue.trim(),
      next_goal: nextGoal.trim(),
    });
    timer.reset();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3500);
  };

  return (
    <section className="practice-recorder">
      <div className="timer-block">
        <div>
          <p className="eyebrow">本次练习</p>
          <strong>{timer.formatted}</strong>
        </div>
        <div>
          <button
            className="button button--primary"
            type="button"
            onClick={timer.toggle}
          >
            {timer.isRunning ? (
              <Pause size={17} aria-hidden="true" />
            ) : (
              <Play size={17} aria-hidden="true" />
            )}
            {timer.isRunning ? "暂停" : "开始计时"}
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="重置计时"
            onClick={timer.reset}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="recorder-form">
        <div className="field-row field-row--three">
          <label>
            练习调
            <select value={practiceKey} onChange={(event) => setPracticeKey(event.target.value)}>
              {["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"].map(
                (key) => (
                  <option key={key}>{key}</option>
                ),
              )}
            </select>
          </label>
          <label>
            目标速度
            <input
              type="number"
              min="40"
              max="160"
              value={targetBpm}
              onChange={(event) =>
                setTargetBpm(
                  Math.min(160, Math.max(40, Number(event.target.value))),
                )
              }
            />
          </label>
          <label>
            伴奏型
            <select
              value={pattern}
              onChange={(event) =>
                setPattern(event.target.value as AccompanimentPattern)
              }
            >
              <option value="block_chords">柱式和弦</option>
              <option value="bass_chord">低音加和弦</option>
              <option value="broken_chord">分解和弦</option>
              <option value="octave_bass">八度低音</option>
              <option value="custom">自定义</option>
            </select>
          </label>
        </div>

        <fieldset>
          <legend>练习模式</legend>
          <div className="segmented-control">
            {modes.map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`practice-mode-${hymnKey}`}
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="check-row">
          <label>
            <input
              type="checkbox"
              checked={introReady}
              onChange={(event) => setIntroReady(event.target.checked)}
            />
            前奏已准备
          </label>
          <label>
            <input
              type="checkbox"
              checked={endingReady}
              onChange={(event) => setEndingReady(event.target.checked)}
            />
            尾奏已准备
          </label>
        </div>

        <fieldset className="rating-fields">
          <legend>本次自评 · 1 需要重练，5 可以服侍</legend>
          {ratingFields.map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="range"
                min="1"
                max="5"
                value={rating[key]}
                aria-label={`${label}自评`}
                onChange={(event) => updateRating(key, Number(event.target.value))}
              />
              <strong>{rating[key]}</strong>
            </label>
          ))}
        </fieldset>

        <label>
          今天最明显的问题
          <textarea
            value={issue}
            maxLength={300}
            placeholder="例如：第 2 段左手换和弦会停一下"
            onChange={(event) => setIssue(event.target.value)}
          />
        </label>
        <label>
          下次目标
          <textarea
            value={nextGoal}
            maxLength={300}
            placeholder="例如：60 BPM 下完整弹两遍，不从头重来"
            onChange={(event) => setNextGoal(event.target.value)}
          />
        </label>

        <button className="button button--primary button--full" type="button" onClick={save}>
          {saved ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Save size={17} aria-hidden="true" />
          )}
          {saved ? "练习已保存" : "完成并保存"}
        </button>
      </div>
    </section>
  );
}
