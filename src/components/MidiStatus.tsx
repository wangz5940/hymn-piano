import { Cable, CircleOff, Piano } from "lucide-react";
import { useMidi } from "@/hooks/useMidi";

const pitchNames = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];

const midiName = (midi: number): string =>
  `${pitchNames[midi % 12]}${Math.floor(midi / 12) - 1}`;

export function MidiStatus() {
  const midi = useMidi();

  if (!midi.supported) {
    return (
      <section className="practice-tool practice-tool--quiet">
        <div className="practice-tool__heading">
          <div>
            <p className="eyebrow">可选输入</p>
            <h2>MIDI 电钢琴</h2>
          </div>
          <CircleOff size={19} aria-hidden="true" />
        </div>
        <p className="muted-copy">
          当前浏览器不支持 Web MIDI，不影响计时、看谱和手动练习。
        </p>
      </section>
    );
  }

  return (
    <section className="practice-tool practice-tool--quiet">
      <div className="practice-tool__heading">
        <div>
          <p className="eyebrow">可选输入</p>
          <h2>MIDI 电钢琴</h2>
        </div>
        <Piano size={20} aria-hidden="true" />
      </div>

      {midi.permission !== "granted" ? (
        <>
          <p className="muted-copy">
            只显示当前设备与按键，不保存或上传原始 MIDI 事件。
          </p>
          {midi.permission === "denied" && (
            <p className="inline-error" role="status">
              连接权限已被拒绝，可继续手动练习。
            </p>
          )}
          <button
            className="button button--secondary button--full"
            type="button"
            disabled={midi.permission === "requesting"}
            onClick={() => void midi.connect()}
          >
            <Cable size={17} aria-hidden="true" />
            {midi.permission === "requesting" ? "正在请求权限" : "连接 MIDI"}
          </button>
        </>
      ) : (
        <div className="midi-connected">
          <span className="status-badge status-badge--green">已连接</span>
          <p>
            {midi.devices.length > 0
              ? midi.devices.map((device) => device.name).join("、")
              : "尚未检测到输入设备"}
          </p>
          <div className="active-notes">
            <span>当前按键</span>
            <strong>
              {midi.active_notes.length > 0
                ? midi.active_notes.map(midiName).join(" · ")
                : "—"}
            </strong>
          </div>
        </div>
      )}
    </section>
  );
}
