import type { ScoreNoteEvent } from "./contracts";
import { scoreNoteName } from "./pitch";

function note(
  degree: ScoreNoteEvent["degree"],
  octave = 0,
): ScoreNoteEvent {
  return {
    id: `note-${degree}-${octave}`,
    kind: "note",
    measure_id: "measure-1",
    beat: 0,
    duration: 1,
    degree,
    accidental: null,
    octave,
    augmentation_dots: 0,
    beams: 0,
    raw_glyphs: String(degree),
    sources: [],
  };
}

describe("实际琴键名称", () => {
  it("按中央 C 为 C4 标注自然音", () => {
    expect(scoreNoteName(note(1), "C")).toBe("C4");
    expect(scoreNoteName(note(5), "C")).toBe("G4");
  });

  it("按原调标注升降号与八度", () => {
    expect(scoreNoteName(note(3), "D")).toBe("F♯4");
    expect(scoreNoteName(note(1), "E♭")).toBe("E♭4");
    expect(scoreNoteName(note(1, 1), "C")).toBe("C5");
  });
});
