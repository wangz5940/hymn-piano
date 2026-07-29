import { render, screen } from "@testing-library/react";
import {
  ARRANGEMENT_SCHEMA,
  SCORE_SCHEMA,
} from "./contracts";
import type {
  PianoArrangementDocument,
  PianoScoreDocument,
  SourceReference,
} from "./contracts";
import { ScoreSvg } from "./ScoreSvg";

const HASH = "b".repeat(64);
const source: SourceReference = {
  asset: "data/generated/hymn-sources/1.json",
  slide: 1,
  shape_id: "shape-1",
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
    meter: { value: "6/8", sources: [source] },
    diagnostics: [],
    pages: [
      {
        id: "page-1",
        source_slides: [1],
        systems: [
          {
            id: "system-1",
            phrases: [{ id: "phrase-1", measure_ids: ["measure-1"] }],
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
                    duration: 0.5,
                    degree: 1,
                    accidental: "flat",
                    octave: 1,
                    augmentation_dots: 1,
                    beams: 1,
                    raw_glyphs: "e",
                    sources: [source],
                  },
                  {
                    id: "rest-1",
                    kind: "rest",
                    measure_id: "measure-1",
                    beat: 0.5,
                    duration: 0.5,
                    augmentation_dots: 0,
                    beams: 1,
                    raw_glyphs: "0",
                    sources: [source],
                  },
                  {
                    id: "note-2",
                    kind: "note",
                    measure_id: "measure-1",
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
                    id: "tie-1",
                    kind: "tie",
                    measure_id: "measure-1",
                    beat: 0,
                    duration: 0,
                    from_event_id: "note-1",
                    to_event_id: "note-2",
                    raw_glyphs: "tie",
                    sources: [source],
                  },
                  {
                    id: "slur-1",
                    kind: "slur",
                    measure_id: "measure-1",
                    beat: 0,
                    duration: 0,
                    from_event_id: "note-1",
                    to_event_id: "note-2",
                    raw_glyphs: "slur",
                    sources: [source],
                  },
                  {
                    id: "bar-1",
                    kind: "barline",
                    measure_id: "measure-1",
                    beat: 2,
                    duration: 0,
                    style: "double",
                    raw_glyphs: "||",
                    sources: [source],
                  },
                  {
                    id: "repeat-1",
                    kind: "repeat",
                    measure_id: "measure-1",
                    beat: 2,
                    duration: 0,
                    direction: "end",
                    raw_glyphs: ":|",
                    sources: [source],
                  },
                  {
                    id: "unknown-1",
                    kind: "unknown",
                    measure_id: "measure-1",
                    beat: 1.5,
                    duration: 0,
                    raw_glyphs: "?",
                    reason: "测试未知字形",
                    sources: [source],
                  },
                ],
              },
            ],
            lyrics: [
              {
                id: "lyric-1",
                verse: "1",
                text: "至大医生",
                event_ids: ["note-1", "note-2"],
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
        finger: 1,
        hand: "right",
        status: "auto_candidate",
        confidence: 0.8,
        reason: "起句",
      },
    ],
    positions: [
      {
        id: "position-1",
        start_event_id: "note-1",
        end_event_id: "note-2",
        label: "E♭ Position",
        finger_notes: { 1: "E♭", 2: "F", 3: "G" },
        status: "auto_candidate",
        confidence: 0.8,
        reason: "固定手位",
      },
      {
        id: "position-2",
        start_event_id: "note-1",
        end_event_id: "note-2",
        label: "B♭ Position",
        finger_notes: { 1: "B♭", 2: "C", 3: "D" },
        status: "auto_candidate",
        confidence: 0.6,
        reason: "碰撞轨道测试",
      },
    ],
    moves: [
      {
        id: "move-1",
        trigger_event_id: "note-2",
        from_position_id: "position-1",
        to_position_id: "position-2",
        instruction: "Move to B♭ Position",
        reason: "预备下一句",
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
        confidence: 0.8,
        evidence: ["主音"],
        alternatives: [],
        reason: "建立调性",
      },
    ],
    accompaniment: recommendation("两大拍"),
    intro: recommendation("末句"),
    interlude: recommendation("重复末句"),
    ending: recommendation("V-I"),
  };
}

describe("ScoreSvg", () => {
  it("提供稳定 viewBox 与可访问的曲目摘要", () => {
    const { container, rerender } = render(
      <ScoreSvg score={makeScore()} arrangement={makeArrangement()} />,
    );
    const svg = screen.getByRole("img", {
      name: /第 1 首《至大医生》简谱/,
    });
    const viewBox = svg.getAttribute("viewBox");

    expect(viewBox).toMatch(/^0 0 960 \d+$/);
    expect(svg).toHaveAccessibleDescription(
      /E♭，6\/8，共 1 页。谱面含音符/,
    );
    expect(container.querySelector("title")).toHaveTextContent(
      "第 1 首《至大医生》简谱",
    );

    rerender(
      <ScoreSvg score={makeScore()} arrangement={makeArrangement()} />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("viewBox", viewBox);
  });

  it("将所有谱面语义渲染为独立 SVG layer", () => {
    const { container } = render(<ScoreSvg score={makeScore()} />);
    const expectedLayers = [
      "notes",
      "rests",
      "octave",
      "duration",
      "barlines",
      "repeats",
      "ties",
      "slurs",
      "lyrics",
    ];

    expectedLayers.forEach((layer) => {
      expect(
        container.querySelector(`[data-layer="${layer}"]`),
      ).toBeInTheDocument();
    });
    expect(
      container.querySelector('[data-layer="notes"] [data-event-id="note-1"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-layer="ties"] path'),
    ).toHaveAttribute("d", expect.stringMatching(/^M /));
    expect(
      container.querySelector('[data-layer="slurs"] path'),
    ).toHaveAttribute("d", expect.stringMatching(/^M /));
    expect(screen.getByText("至大医生")).toBeInTheDocument();
  });

  it("只在乐谱字形 text 上使用 SimpMusic，并按事件叠加教学标记", () => {
    const { container } = render(
      <ScoreSvg score={makeScore()} arrangement={makeArrangement()} />,
    );
    const glyphs = container.querySelectorAll(".score-svg__glyph");

    expect(glyphs.length).toBeGreaterThan(0);
    glyphs.forEach((glyph) => {
      expect(glyph).toHaveStyle({ fontFamily: '"SimpMusic Base"' });
    });
    expect(
      container.querySelector(
        '[data-layer="fingerings"] [data-event-id="note-1"]',
      ),
    ).toHaveTextContent("①");
    expect(screen.getByText("E♭ Position")).toBeInTheDocument();
    expect(screen.getByText("Move to B♭ Position")).toBeInTheDocument();
    expect(screen.getByText("E♭ · I")).toBeInTheDocument();
    expect(screen.getByText("E♭⑤ · G③ · B♭①")).toBeInTheDocument();
  });

  it("为重叠手位分配不同教学轨道", () => {
    const { container } = render(
      <ScoreSvg score={makeScore()} arrangement={makeArrangement()} />,
    );
    const lanes = Array.from(
      container.querySelectorAll('[data-layer="positions"] [data-lane]'),
    ).map((element) => element.getAttribute("data-lane"));

    expect(new Set(lanes)).toEqual(new Set(["0", "1"]));
  });
});
