import { Minus, Pause, Play, Plus } from "lucide-react";
import { useMetronome } from "@/hooks/useMetronome";

export function Metronome() {
  const {
    bpm,
    setBpm,
    beatsPerMeasure,
    setBeatsPerMeasure,
    currentBeat,
    isRunning,
    toggle,
  } = useMetronome();

  return (
    <section className="practice-tool">
      <div className="practice-tool__heading">
        <div>
          <p className="eyebrow">稳定拍点</p>
          <h2>节拍器</h2>
        </div>
        <span className={`live-status${isRunning ? " live-status--on" : ""}`}>
          {isRunning ? "运行中" : "已停止"}
        </span>
      </div>

      <div className="tempo-control">
        <button
          className="icon-button"
          type="button"
          aria-label="速度减一"
          onClick={() => setBpm(bpm - 1)}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <div>
          <strong>{bpm}</strong>
          <span>BPM</span>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="速度加一"
          onClick={() => setBpm(bpm + 1)}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      <input
        className="range-control"
        type="range"
        min="40"
        max="160"
        value={bpm}
        aria-label="节拍器速度"
        onChange={(event) => setBpm(Number(event.target.value))}
      />

      <div className="meter-row">
        <label>
          拍号
          <select
            value={beatsPerMeasure}
            onChange={(event) =>
              setBeatsPerMeasure(Number(event.target.value))
            }
          >
            <option value="2">2/4</option>
            <option value="3">3/4</option>
            <option value="4">4/4</option>
            <option value="6">6/8</option>
          </select>
        </label>
        <div className="beat-dots" aria-label={`当前第 ${currentBeat + 1} 拍`}>
          {Array.from({ length: beatsPerMeasure }, (_, index) => (
            <span
              key={index}
              className={
                isRunning && index === currentBeat ? "beat-dot beat-dot--on" : "beat-dot"
              }
            />
          ))}
        </div>
      </div>

      <button
        className="button button--primary button--full"
        type="button"
        onClick={toggle}
      >
        {isRunning ? (
          <Pause size={17} aria-hidden="true" />
        ) : (
          <Play size={17} aria-hidden="true" />
        )}
        {isRunning ? "停止节拍器" : "开始节拍器"}
      </button>
    </section>
  );
}
