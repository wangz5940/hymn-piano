import {
  ARRANGEMENT_SCHEMA,
  SCORE_SCHEMA,
} from "./contracts";
import type {
  PianoArrangementDocument,
  PianoScoreDocument,
  SourceReference,
} from "./contracts";
import { layoutScore } from "./layout";

const HASH = "a".repeat(64);
const source: SourceReference = {
  asset: "data/generated/hymn-sources/1.json",
  slide: 1,
  shape_id: "score-1",
};

function makeScore(): PianoScoreDocument {
  return {
    schema: SCORE_SCHEMA,
    hymn_key: "1",
    title: "至大医生",
    content_hash: HASH,
    source: {
      asset: source.asset,
      source_hash: HASH,
      decoder_version: "test",
    },
    key_signature: { value: "E♭", sources: [source] },
    meter: { value: "4/4", sources: [source] },
    diagnostics: [],
    pages: [
      {
        id: "page-1",
        source_slides: [1],
        systems: [
          {
            id: "system-1",
            phrases: [
              { id: "phrase-1", measure_ids: ["measure-1", "measure-2"] },
            ],
            measures: [
              {
                id: "measure-1",
                number: 1,
                events: [
                  {
                    id: "note-1",
                    kind: "note",
                    measure_id: "measure-1",
                    beat: 0,
                    duration: 1,
                    degree: 1,
                    accidental: "flat",
                    octave: 1,
                    augmentation_dots: 0,
                    beams: 1,
                    raw_glyphs: "e",
                    sources: [source],
                  },
                  {
                    id: "note-2",
                    kind: "note",
                    measure_id: "measure-1",
                    beat: 2,
                    duration: 2,
                    degree: 5,
                    accidental: null,
                    octave: -1,
                    augmentation_dots: 1,
                    beams: 0,
                    raw_glyphs: "d",
                    sources: [source],
                  },
                  {
                    id: "tie-1",
                    kind: "tie",
                    measure_id: "measure-1",
                    beat: 2,
                    duration: 0,
                    from_event_id: "note-1",
                    to_event_id: "note-2",
                    raw_glyphs: "tie",
                    sources: [source],
                  },
                  {
                    id: "bar-1",
                    kind: "barline",
                    measure_id: "measure-1",
                    beat: 4,
                    duration: 0,
                    style: "single",
                    raw_glyphs: "|",
                    sources: [source],
                  },
                ],
              },
              {
                id: "measure-2",
                number: 2,
                events: [
                  {
                    id: "rest-1",
                    kind: "rest",
                    measure_id: "measure-2",
                    beat: 0,
                    duration: 1,
                    augmentation_dots: 0,
                    beams: 1,
                    raw_glyphs: "0",
                    sources: [source],
                  },
                  {
                    id: "note-3",
                    kind: "note",
                    measure_id: "measure-2",
                    beat: 1,
                    duration: 1,
                    degree: 3,
                    accidental: null,
                    octave: 0,
                    augmentation_dots: 0,
                    beams: 0,
                    raw_glyphs: "o",
                    sources: [source],
                  },
                  {
                    id: "slur-1",
                    kind: "slur",
                    measure_id: "measure-2",
                    beat: 1,
                    duration: 0,
                    from_event_id: "rest-1",
                    to_event_id: "note-3",
                    raw_glyphs: "slur",
                    sources: [source],
                  },
                  {
                    id: "repeat-1",
                    kind: "repeat",
                    measure_id: "measure-2",
                    beat: 2,
                    duration: 0,
                    direction: "end",
                    raw_glyphs: ":|",
                    sources: [source],
                  },
                ],
              },
            ],
            lyrics: [
              {
                id: "lyric-1",
                verse: "1",
                text: "至大医生现今可近",
                event_ids: ["note-1", "note-2", "note-3"],
                sources: [source],
              },
            ],
          },
        ],
      },
    ],
  };
}

function recommendation(text: string) {
  return {
    status: "auto_candidate" as const,
    text,
    reason: "测试依据",
  };
}

function makeArrangement(): PianoArrangementDocument {
  return {
    schema: ARRANGEMENT_SCHEMA,
    hymn_key: "1",
    score_hash: HASH,
    content_hash: HASH,
    fingerings: [
      {
        event_id: "note-1",
        finger: 2,
        hand: "right",
        status: "auto_candidate",
        confidence: 0.8,
        reason: "黑键优先中间手指",
      },
      {
        event_id: "note-2",
        finger: 5,
        hand: "right",
        status: "auto_candidate",
        confidence: 0.8,
        reason: "保持手位",
      },
    ],
    positions: [
      {
        id: "position-1",
        start_event_id: "note-1",
        end_event_id: "note-2",
        label: "E♭ Position",
        finger_notes: { 2: "E♭", 3: "F", 4: "G" },
        status: "auto_candidate",
        confidence: 0.8,
        reason: "覆盖起句",
      },
      {
        id: "position-2",
        start_event_id: "note-1",
        end_event_id: "note-2",
        label: "Move to B♭ Position",
        finger_notes: { 1: "B♭", 2: "C", 3: "D" },
        status: "auto_candidate",
        confidence: 0.7,
        reason: "为后句预备",
      },
    ],
    moves: [
      {
        id: "move-1",
        trigger_event_id: "note-2",
        from_position_id: "position-1",
        to_position_id: "position-2",
        instruction: "Move to B♭ Position",
        reason: "下一句超出原手位",
      },
    ],
    chords: [
      {
        id: "chord-1",
        measure_id: "measure-1",
        beat: 0,
        display_default: true,
        symbol: "E♭",
        function: "I",
        bass: "E♭",
        inversion: "root",
        tones: [
          { note: "E♭", finger: 5 },
          { note: "G", finger: 3 },
          { note: "B♭", finger: 1 },
        ],
        status: "source_confirmed",
        confidence: 0.7,
        evidence: ["强拍主音"],
        alternatives: [],
        reason: "建立调性",
      },
      {
        id: "chord-2",
        measure_id: "measure-1",
        beat: 0,
        display_default: true,
        symbol: "Cm/E♭",
        function: "vi6",
        bass: "E♭",
        inversion: "first",
        tones: [
          { note: "E♭", finger: 5 },
          { note: "G", finger: 3 },
          { note: "C", finger: 1 },
        ],
        status: "manual_confirmed",
        confidence: 0.4,
        evidence: ["旋律三音"],
        alternatives: ["E♭"],
        reason: "重叠标签轨道测试",
      },
    ],
    accompaniment: recommendation("低音加和弦"),
    intro: recommendation("末句两小节"),
    interlude: recommendation("重复末句"),
    ending: recommendation("V-I"),
  };
}

describe("乐谱 SVG 布局", () => {
  it("相同输入产生完全稳定的页面、系统和 viewBox", () => {
    const first = layoutScore(makeScore(), makeArrangement());
    const second = layoutScore(makeScore(), makeArrangement());

    expect(first).toEqual(second);
    expect(first.viewBox).toBe(`0 0 960 ${first.height}`);
    expect(first.pages[0]).toMatchObject({
      id: "page-1",
      width: 960,
    });
    expect(first.pages[0].systems[0]).toMatchObject({
      id: "system-1",
      page_id: "page-1",
    });
  });

  it("按小节实际时值跨度分配宽度，并按 beat 定位事件", () => {
    const layout = layoutScore(makeScore());
    const first = layout.measure_index["measure-1"];
    const second = layout.measure_index["measure-2"];

    expect(first.beat_span).toBe(4);
    expect(second.beat_span).toBe(2);
    expect(first.width / second.width).toBeCloseTo(2, 2);
    expect(layout.event_index["note-2"].x).toBeGreaterThan(
      layout.event_index["note-1"].x,
    );
    expect(layout.event_index["bar-1"].x).toBeGreaterThan(
      layout.event_index["note-2"].x,
    );
  });

  it("用事件锚点放置教学层，并给重叠标记分配不同轨道", () => {
    const layout = layoutScore(makeScore(), makeArrangement());
    const note = layout.event_index["note-1"];
    const finger = layout.fingers.find(
      (item) => item.assignment.event_id === "note-1",
    );

    expect(finger).toMatchObject({ x: note.x });
    expect(finger!.y).toBeLessThan(note.y);
    expect(new Set(layout.positions.map((item) => item.lane)).size).toBe(2);
    expect(new Set(layout.chords.map((item) => item.lane)).size).toBe(2);
    expect(layout.moves[0]).toMatchObject({
      page_id: "page-1",
      system_id: "system-1",
    });
    expect(layout.relations.map((item) => item.event.kind)).toEqual([
      "tie",
      "slur",
    ]);
  });

  it("默认谱面不放置自动候选和弦", () => {
    const arrangement = makeArrangement();
    arrangement.chords = arrangement.chords.map((chord) => ({
      ...chord,
      display_default: false,
      status: "auto_candidate",
    }));

    expect(layoutScore(makeScore(), arrangement).chords).toEqual([]);
  });

  it("拒绝把第二调编配挂到原调谱面", () => {
    const arrangement = makeArrangement();
    arrangement.hymn_key = "1b";

    expect(() => layoutScore(makeScore(), arrangement)).toThrow(
      "编配曲目 1b 与谱面曲目 1 不一致",
    );
  });
});
