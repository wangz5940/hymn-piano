#!/usr/bin/env python3
"""Build browser-ready jianpu textbook assets for Panio."""

from __future__ import annotations

import json
import re
import shutil
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MATERIALS_DIR = PROJECT_ROOT / "public" / "materials"
SOURCE_CATALOG_PATH = MATERIALS_DIR / "catalog.json"
JIANPU_DIR = MATERIALS_DIR / "jianpu"
JIANPU_CATALOG_PATH = MATERIALS_DIR / "jianpu-catalog.json"
PITCH_BASE = {
    "C": 0,
    "D": 2,
    "E": 4,
    "F": 5,
    "G": 7,
    "A": 9,
    "B": 11,
}
PITCH_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
MAJOR_TONICS = {
    -7: "C♭",
    -6: "G♭",
    -5: "D♭",
    -4: "A♭",
    -3: "E♭",
    -2: "B♭",
    -1: "F",
    0: "C",
    1: "G",
    2: "D",
    3: "A",
    4: "E",
    5: "B",
    6: "F♯",
    7: "C♯",
}
MINOR_TONICS = {
    -7: "A♭",
    -6: "E♭",
    -5: "B♭",
    -4: "F",
    -3: "C",
    -2: "G",
    -1: "D",
    0: "A",
    1: "E",
    2: "B",
    3: "F♯",
    4: "C♯",
    5: "G♯",
    6: "D♯",
    7: "A♯",
}
NOTE_TO_PITCH_CLASS = {
    "C": 0,
    "C♯": 1,
    "D♭": 1,
    "D": 2,
    "D♯": 3,
    "E♭": 3,
    "E": 4,
    "F": 5,
    "F♯": 6,
    "G♭": 6,
    "G": 7,
    "G♯": 8,
    "A♭": 8,
    "A": 9,
    "A♯": 10,
    "B♭": 10,
    "B": 11,
    "C♭": 11,
}
HAND_OVERRIDES = {
    "beyer.segment.008": "left",
    "beyer.segment.009": "left",
    "beyer.segment.010": "left",
    "beyer.segment.011": "left",
    "beyer.segment.012": "left",
    "beyer.segment.017": "left",
    "beyer.segment.018": "left",
    "beyer.segment.019": "left",
    "beyer.segment.136": "left",
}


@dataclass(frozen=True)
class book_config:
    material_id: str
    title: str
    description: str
    ocr_path: Path
    hanon_ocr_pages_path: Path | None = None


@dataclass(frozen=True)
class chapter_config:
    id: str
    title: str
    description: str
    page_start: int
    page_end: int


BEYER_CHAPTERS = (
    chapter_config("front-matter", "封面与目录", "查看教材的编排顺序与学习范围。", 1, 2),
    chapter_config("music-literacy", "音乐入门知识", "认识谱表、音名、时值、拍号与琴键位置。", 3, 6),
    chapter_config("touch-exercises", "手指触键练习", "建立单手与双手触键的稳定动作。", 7, 9),
    chapter_config("three-hand-right", "三手练习（一）", "主题一及变奏：学生单用右手弹奏。", 10, 14),
    chapter_config("three-hand-left", "三手练习（二）", "主题二及变奏：学生单用左手弹奏。", 15, 17),
    chapter_config("four-hand-basics", "双手并用的四手练习", "在教师声部支撑下学习学生声部与手位。", 18, 23),
    chapter_config("two-hand-range", "音域扩展的双手练习", "在更宽的键盘范围内连接双手旋律与节奏。", 24, 29),
    chapter_config("four-hand-range-one", "音域扩展的四手练习（一）", "扩展高低音区，练习声部配合。", 30, 31),
    chapter_config("two-hand-range-two", "音域扩展的双手练习（二）", "在移动手位中维持双手同步与音准。", 32, 33),
    chapter_config("four-hand-range-two", "音域扩展的四手练习（二）", "在更大音域中完成连续四手配合。", 34, 35),
    chapter_config("whole-to-eighth", "从全音符到八分音符的四手练习", "把不同时值组织成稳定的合奏节拍。", 36, 37),
    chapter_config("eighth-two-hands", "八分音符的双手练习", "在双手中保持八分音符的均匀流动。", 38, 40),
    chapter_config("bass-clef", "认识低音谱表", "建立低音谱表阅读与左右手分工意识。", 41, 47),
    chapter_config("eighth-four-hands", "八分音符的四手练习", "在四手织体中维持清晰的八分音符节奏。", 48, 49),
    chapter_config("scales-intervals", "音阶、双音与装饰音的双手练习", "练习音阶、双音、三连音与倚音等基础技巧。", 50, 65),
    chapter_config("sixteenth-flow", "十六分音符与流畅性练习", "在四手织体中练习更细的节奏和连贯性。", 66, 69),
    chapter_config("dotted-rhythm", "附点与十六分音符的双手练习", "处理附点、十六分音符与节奏层次。", 70, 86),
    chapter_config("chromatic", "半音音阶的练习", "学习半音进行、双手反向与换指。", 87, 90),
    chapter_config("appendix-fingers", "附录：手指练习", "单用右手、单用左手与双手并用的补充指法练习。", 91, 99),
    chapter_config("appendix-scales", "附录：二十四条大调和小调音阶", "按相似指法比较常用大调与小调音阶。", 100, 101),
    chapter_config("appendix-keys", "附录：调的序列及大小调关系", "理解调性序列、关系大小调与调式。", 102, 102),
)

HANON_CHAPTERS = (
    chapter_config("preface", "前言与使用说明", "理解练习目标、速度安排与使用方法。", 1, 5),
    chapter_config("part-one", "第一部分：准备练习", "建立手指独立、均匀与基本伸张能力。", 6, 25),
    chapter_config("part-two", "第二部分：高级练习", "发展穿指、音阶、琶音与更复杂的手指技术。", 26, 75),
    chapter_config("part-three", "第三部分：专门练习", "针对重复音、颤音、音程、八度与高级技巧练习。", 76, 119),
)

JOHN_THOMPSON_EASIEST_1_CHAPTERS = (
    chapter_config("front-matter", "封面、版权与目录", "查看教材版本、目录和学习范围。", 1, 7),
    chapter_config("keyboard-and-middle-c", "键盘与中央 C", "认识键盘、谱表和中央 C。", 8, 13),
    chapter_config("note-values-and-new-notes", "音符时值与新音", "从全音符、二分音符、四分音符进入 D、B、E、A 等新音。", 14, 29),
    chapter_config("rests-ties-and-review", "休止符、连线与复习", "学习休止符、连线和更多复习曲目。", 30, 43),
    chapter_config("certificate-and-archive", "升级证书与档案页", "保留原 PDF 的证书和扫描档案信息。", 44, 45),
)

JOHN_THOMPSON_EASIEST_2_CHAPTERS = (
    chapter_config("front-matter", "封面、版权与导读", "查看版本信息、教师说明和目录。", 1, 5),
    chapter_config("eighth-notes-and-accidentals", "八分音符与临时记号", "复习第一册内容，学习八分音符、升降号和调号。", 6, 18),
    chapter_config("finger-drills-and-left-hand", "手指操与左手新音", "通过手指操、复习曲和低音谱表新音扩展手位。", 19, 31),
    chapter_config("double-notes-and-bass-patterns", "双音与固定低音和弦", "学习双音、分解和弦、固定低音和左右手跨越。", 32, 41),
    chapter_config("duets-and-performance", "四手联弹与演奏曲", "学习四手联弹、重音和完整演奏曲。", 42, 49),
    chapter_config("certificate-and-archive", "升级证书与档案页", "保留原 PDF 的证书、广告和扫描档案信息。", 50, 52),
)

BEYER_MUSIC_LITERACY_PAGE_TITLES = {
    3: "音乐入门知识：谱表、音名与音程",
    4: "音符的时值和休止符",
    5: "拍号、临时记号与半音音阶",
    6: "钢琴键盘与音名",
}

CHAPTERS_BY_MATERIAL = {
    "beyer": BEYER_CHAPTERS,
    "hanon": HANON_CHAPTERS,
    "john-thompson-easiest-1": JOHN_THOMPSON_EASIEST_1_CHAPTERS,
    "john-thompson-easiest-2": JOHN_THOMPSON_EASIEST_2_CHAPTERS,
}


BOOKS = (
    book_config(
        material_id="beyer",
        title="拜厄钢琴基本教程",
        description="从读谱、触键到双手配合的基础教材。",
        ocr_path=PROJECT_ROOT / ".trae" / "documents" / "拜厄钢琴基本教程_OCR文本.txt",
    ),
    book_config(
        material_id="hanon",
        title="哈农钢琴练指法",
        description="以手指独立、均匀触键与双手同步为核心的技术练习。",
        ocr_path=PROJECT_ROOT / ".trae" / "documents" / "哈农钢琴练指法_OCR文本.txt",
        hanon_ocr_pages_path=(
            PROJECT_ROOT
            / ".trae"
            / "documents"
            / "哈农钢琴练指法_MusicXML"
            / "ocr_pages.jsonl"
        ),
    ),
    book_config(
        material_id="john-thompson-easiest-1",
        title="约翰·汤普森简易钢琴教程 1",
        description="从键盘、中央 C 和基础时值开始的小汤第一册教材。",
        ocr_path=PROJECT_ROOT / ".trae" / "documents" / "约翰·汤普森简易钢琴教程 1_OCR文本.txt",
    ),
    book_config(
        material_id="john-thompson-easiest-2",
        title="约翰·汤普森简易钢琴教程 2",
        description="承接第一册，加入八分音符、临时记号、双音与四手联弹的小汤第二册教材。",
        ocr_path=PROJECT_ROOT / ".trae" / "documents" / "约翰·汤普森简易钢琴教程 2_OCR文本.txt",
    ),
)


def child_text(element: ET.Element, tag: str) -> str | None:
    value = element.findtext(tag)
    return value.strip() if value else None


def pitch_to_midi(pitch: ET.Element) -> int | None:
    step = child_text(pitch, "step")
    octave_text = child_text(pitch, "octave")
    if step not in PITCH_BASE or octave_text is None:
        return None
    alter = int(child_text(pitch, "alter") or "0")
    return (int(octave_text) + 1) * 12 + PITCH_BASE[step] + alter


def midi_to_name(midi: int) -> str:
    return f"{PITCH_NAMES[midi % 12]}{midi // 12 - 1}"


def normalize_ocr_text(raw_text: str) -> str:
    lines: list[str] = []
    for raw_line in raw_text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip(" ·•-—_")
        chinese_char_count = len(re.findall(r"[\u4e00-\u9fff]", line))
        if chinese_char_count < 2:
            continue
        if len(line) < 4:
            continue
        lines.append(line)

    deduplicated_lines: list[str] = []
    for line in lines:
        if not deduplicated_lines or deduplicated_lines[-1] != line:
            deduplicated_lines.append(line)
    return "\n".join(deduplicated_lines)


def extract_page_title(
    page_number: int,
    content: str,
    section_title: str | None = None,
    exercise_labels: list[str] | None = None,
) -> str:
    if exercise_labels:
        return exercise_labels[0]
    if section_title:
        return section_title
    lines = content.splitlines()
    title_keywords = ("练习", "谱表", "音阶", "音符", "拍号", "三手", "四手", "低音")
    for line in lines[:6]:
        if (
            3 <= len(line) <= 32
            and not line.endswith(("。", "，", "、", "："))
            and any(keyword in line for keyword in title_keywords)
        ):
            return line
    for line in lines:
        if 4 <= len(line) <= 28 and not line.endswith(("。", "，", "、", "：")):
            return line
    return f"原谱第 {page_number} 页"


def load_ocr_text_pages(config: book_config) -> dict[int, dict[str, Any]]:
    raw_text = config.ocr_path.read_text(encoding="utf-8")
    page_blocks = re.split(r"^## PDF 第 (\d+) 页\s*$", raw_text, flags=re.MULTILINE)
    pages: dict[int, dict[str, Any]] = {}

    for index in range(1, len(page_blocks), 2):
        page_number = int(page_blocks[index])
        content = normalize_ocr_text(page_blocks[index + 1])
        pages[page_number] = {
            "page": page_number,
            "title": extract_page_title(page_number, content),
            "text": content or "本页以谱例为主。先查看拍号、手别、指法和反复记号，再开始阅读简谱。",
            "exercise_labels": [],
            "section_title": None,
        }
    return pages


def load_hanon_pages(config: book_config) -> dict[int, dict[str, Any]]:
    if config.hanon_ocr_pages_path is None:
        return {}

    pages: dict[int, dict[str, Any]] = {}
    for raw_line in config.hanon_ocr_pages_path.read_text(encoding="utf-8").splitlines():
        record = json.loads(raw_line)
        page_number = int(record["pdf_page"])
        section = record.get("section") or {}
        exercise_labels = [str(label) for label in record.get("exercise_labels", [])]
        content = normalize_ocr_text(str(record.get("text", "")))
        pages[page_number] = {
            "page": page_number,
            "title": extract_page_title(
                page_number,
                content,
                section.get("title"),
                exercise_labels,
            ),
            "text": content or "本页以谱例为主。先确认手指组合、节拍器速度和重复要求，再开始双手阅读。",
            "exercise_labels": exercise_labels,
            "section_title": section.get("title"),
        }
    return pages


def parse_key_signature(root: ET.Element) -> tuple[str, int]:
    key = root.find("./part/measure/attributes/key")
    if key is None:
        return "C 大调（1 = C）", 60

    fifths = int(child_text(key, "fifths") or "0")
    mode = (child_text(key, "mode") or "major").lower()
    is_minor = mode == "minor"
    tonic = (MINOR_TONICS if is_minor else MAJOR_TONICS).get(fifths, "C")
    pitch_class = NOTE_TO_PITCH_CLASS.get(tonic, 0)
    mode_label = "小调" if is_minor else "大调"
    return f"{tonic} {mode_label}（1 = {tonic}）", 60 + pitch_class


def parse_time_signature(root: ET.Element) -> str:
    time = root.find("./part/measure/attributes/time")
    if time is None:
        return "依原谱"
    beats = child_text(time, "beats")
    beat_type = child_text(time, "beat-type")
    return f"{beats}/{beat_type}" if beats and beat_type else "依原谱"


def infer_hand(staff: str | None, midi: int) -> str:
    if staff == "2":
        return "left"
    if staff == "1":
        return "right"
    return "left" if midi < 60 else "right"


def infer_chord_name(notes: list[int]) -> str | None:
    if len(notes) < 3:
        return None
    root = min(notes) % 12
    intervals = {((note % 12) - root) % 12 for note in notes}
    root_name = PITCH_NAMES[root]
    if {0, 4, 7}.issubset(intervals):
        return f"{root_name}7" if 10 in intervals else root_name
    if {0, 3, 7}.issubset(intervals):
        return f"{root_name}m7" if 10 in intervals else f"{root_name}m"
    if {0, 3, 6}.issubset(intervals):
        return f"{root_name}dim"
    if {0, 4, 8}.issubset(intervals):
        return f"{root_name}aug"
    return None


def parse_jianpu_score(
    xml_path: Path,
    segment_id: str,
    hand_override: str | None = None,
) -> dict[str, Any]:
    root = ET.parse(xml_path).getroot()
    key_signature, tonic_midi = parse_key_signature(root)
    time_signature = parse_time_signature(root)
    grouped: dict[int, dict[float, dict[str, Any]]] = defaultdict(dict)
    measure_numbers: dict[int, str] = {}
    directions: dict[int, list[str]] = defaultdict(list)

    for part in root.findall("./part"):
        divisions = 1
        for measure_index, measure in enumerate(part.findall("./measure"), start=1):
            measure_numbers.setdefault(measure_index, measure.attrib.get("number", str(measure_index)))
            attributes = measure.find("attributes")
            if attributes is not None:
                divisions = max(1, int(child_text(attributes, "divisions") or divisions))

            cursor = 0
            last_onset = 0
            for child in list(measure):
                if child.tag == "backup":
                    cursor = max(0, cursor - int(child_text(child, "duration") or "0"))
                    continue
                if child.tag == "forward":
                    cursor += int(child_text(child, "duration") or "0")
                    continue
                if child.tag == "direction":
                    words = child.findtext("./direction-type/words")
                    if words and words.strip():
                        directions[measure_index].append(words.strip())
                    continue
                if child.tag != "note":
                    continue

                duration = int(child_text(child, "duration") or "0")
                is_chord_tone = child.find("chord") is not None
                onset = last_onset if is_chord_tone else cursor
                if not is_chord_tone:
                    last_onset = onset

                if child.find("rest") is None:
                    pitch = child.find("pitch")
                    midi = pitch_to_midi(pitch) if pitch is not None else None
                    if midi is not None:
                        onset_beats = round(onset / divisions, 6)
                        event = grouped[measure_index].setdefault(
                            onset_beats,
                            {
                                "onset_beats": onset_beats,
                                "duration_beats": 0,
                                "right_notes": set(),
                                "left_notes": set(),
                            },
                        )
                        hand = hand_override or infer_hand(child_text(child, "staff"), midi)
                        event[f"{hand}_notes"].add(midi)
                        event["duration_beats"] = max(
                            event["duration_beats"],
                            round(max(duration, 1) / divisions, 6),
                        )

                if not is_chord_tone:
                    cursor += duration

    measures: list[dict[str, Any]] = []
    for measure_index in sorted(grouped):
        events: list[dict[str, Any]] = []
        for event in sorted(grouped[measure_index].values(), key=lambda item: item["onset_beats"]):
            right_notes = sorted(event["right_notes"])
            left_notes = sorted(event["left_notes"])
            notes = sorted(set(right_notes + left_notes))
            events.append(
                {
                    "onset_beats": event["onset_beats"],
                    "duration_beats": max(0.125, event["duration_beats"]),
                    "right_notes": right_notes,
                    "left_notes": left_notes,
                    "chord": infer_chord_name(notes),
                },
            )
        measures.append(
            {
                "index": measure_index,
                "number": measure_numbers.get(measure_index, str(measure_index)),
                "directions": list(dict.fromkeys(directions[measure_index])),
                "events": events,
            },
        )

    return {
        "schema_version": "1.0",
        "segment_id": segment_id,
        "key_signature": key_signature,
        "tonic_midi": tonic_midi,
        "time_signature": time_signature,
        "measures": measures,
    }


def source_page_label(pages: list[int]) -> str:
    return "原谱第 " + "、".join(str(page) for page in pages) + " 页"


def get_chapter_for_page(
    chapters: tuple[chapter_config, ...],
    page: int,
) -> chapter_config:
    for chapter in chapters:
        if chapter.page_start <= page <= chapter.page_end:
            return chapter
    raise ValueError(f"未配置 PDF 第 {page} 页的教材章节")


def get_page_title(
    pages: dict[int, dict[str, Any]],
    page: int,
    chapter: chapter_config,
) -> str:
    if chapter.id == "music-literacy" and page in BEYER_MUSIC_LITERACY_PAGE_TITLES:
        return BEYER_MUSIC_LITERACY_PAGE_TITLES[page]
    title = str(pages.get(page, {}).get("title", f"原谱第 {page} 页"))
    if (
        title == f"原谱第 {page} 页"
        or len(title) <= 2
        or title.endswith(("。", "，", "、", "："))
        or title.startswith("（")
    ):
        return f"{chapter.title} · 第 {page} 页"
    return title


def get_page_measure_ranges(
    xml_path: Path,
    source_pages: list[int],
    measure_count: int,
) -> list[tuple[int, int]] | None:
    root = ET.parse(xml_path).getroot()
    page_starts: list[int] | None = None

    for part in root.findall("./part"):
        measures = part.findall("./measure")
        if len(measures) != measure_count:
            return None
        part_page_starts = [1] + [
            measure_index
            for measure_index, measure in enumerate(measures, start=1)
            if measure_index > 1 and measure.find("./print[@new-page='yes']") is not None
        ]
        if page_starts is None:
            page_starts = part_page_starts
        elif page_starts != part_page_starts:
            return None

    if page_starts is None or len(page_starts) != len(source_pages):
        return None
    return [
        (start, (page_starts[index + 1] - 1) if index + 1 < len(page_starts) else measure_count)
        for index, start in enumerate(page_starts)
    ]


def build_page_slices(
    xml_path: Path,
    source_pages: list[int],
    pages: dict[int, dict[str, Any]],
    measure_count: int,
    chapters: tuple[chapter_config, ...],
) -> list[dict[str, Any]]:
    measure_ranges = get_page_measure_ranges(xml_path, source_pages, measure_count)
    default_text = "本页以谱例为主。先查看拍号、手别、指法和反复记号，再开始阅读简谱。"

    if measure_ranges is not None:
        return [
            {
                "source_pages": [page],
                "title": get_page_title(
                    pages,
                    page,
                    get_chapter_for_page(chapters, page),
                ),
                "text": pages.get(page, {}).get("text", default_text),
                "measure_start": measure_start,
                "measure_end": measure_end,
                "chapter_id": get_chapter_for_page(chapters, page).id,
                "chapter_title": get_chapter_for_page(chapters, page).title,
                "mapping": "verified",
            }
            for page, (measure_start, measure_end) in zip(source_pages, measure_ranges)
        ]

    page_chapters = [get_chapter_for_page(chapters, page) for page in source_pages]
    chapter_titles = list(dict.fromkeys(chapter.title for chapter in page_chapters))
    return [{
        "source_pages": source_pages,
        "title": "跨页教材片段",
        "text": "\n\n".join(
            f"原谱第 {page} 页\n{pages.get(page, {}).get('text', default_text)}"
            for page in source_pages
        ),
        "measure_start": 1,
        "measure_end": measure_count,
        "chapter_id": page_chapters[0].id,
        "chapter_title": " / ".join(chapter_titles),
        "mapping": "cross_page",
    }]


def build_book(
    config: book_config,
    source_material: dict[str, Any],
    pages: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    output_dir = JIANPU_DIR / config.material_id
    output_dir.mkdir(parents=True, exist_ok=True)
    segments: list[dict[str, Any]] = []
    chapters = CHAPTERS_BY_MATERIAL[config.material_id]

    for source_segment in source_material["segments"]:
        sequence = int(source_segment["sequence"])
        source_pages = [int(page) for page in source_segment["source_pages"]]
        first_page = source_pages[0]
        first_chapter = get_chapter_for_page(chapters, first_page)
        musicxml_path = PROJECT_ROOT / "public" / str(source_segment["musicxml_url"]).lstrip("/")
        score = parse_jianpu_score(
            musicxml_path,
            str(source_segment["id"]),
            HAND_OVERRIDES.get(str(source_segment["id"])),
        )
        if not any(measure["events"] for measure in score["measures"]):
            continue
        has_right_hand = any(
            event["right_notes"]
            for measure in score["measures"]
            for event in measure["events"]
        )
        has_left_hand = any(
            event["left_notes"]
            for measure in score["measures"]
            for event in measure["events"]
        )
        hand_mode = (
            "both"
            if has_right_hand and has_left_hand
            else "right"
            if has_right_hand
            else "left"
        )
        output_file_name = f"{sequence:03d}.json"
        (output_dir / output_file_name).write_text(
            json.dumps(score, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        segments.append(
            {
                "id": source_segment["id"],
                "sequence": sequence,
                "title": get_page_title(pages, first_page, first_chapter),
                "source_pages": source_pages,
                "source_page_label": source_page_label(source_pages),
                "page_slices": build_page_slices(
                    musicxml_path,
                    source_pages,
                    pages,
                    len(score["measures"]),
                    chapters,
                ),
                "exercise_labels": source_segment.get("ocr_labels", []),
                "section_title": source_segment.get("section", {}).get("title")
                if source_segment.get("section")
                else None,
                "jianpu_url": f"/materials/jianpu/{config.material_id}/{output_file_name}",
                "musicxml_url": source_segment["musicxml_url"],
                "measure_count": len(score["measures"]),
                "time_signature": score["time_signature"],
                "key_signature": score["key_signature"],
                "tonic_midi": score["tonic_midi"],
                "hand_mode": hand_mode,
                "has_left_hand": has_left_hand,
                "chord_count": sum(
                    1
                    for measure in score["measures"]
                    for event in measure["events"]
                    if event["chord"]
                ),
            },
        )

    return {
        "id": config.material_id,
        "title": config.title,
        "description": config.description,
        "page_count": int(source_material["page_count"]),
        "pages": [
            {
                **pages[page],
                "title": get_page_title(
                    pages,
                    page,
                    get_chapter_for_page(chapters, page),
                ),
            }
            for page in sorted(pages)
        ],
        "chapters": [
            {
                "id": chapter.id,
                "title": chapter.title,
                "description": chapter.description,
                "page_start": chapter.page_start,
                "page_end": chapter.page_end,
            }
            for chapter in chapters
        ],
        "segments": sorted(segments, key=lambda item: item["sequence"]),
    }


def main() -> None:
    source_catalog = json.loads(SOURCE_CATALOG_PATH.read_text(encoding="utf-8"))
    source_materials = {
        str(material["id"]): material
        for material in source_catalog["materials"]
    }

    if JIANPU_DIR.exists():
        shutil.rmtree(JIANPU_DIR)
    JIANPU_DIR.mkdir(parents=True)

    materials: list[dict[str, Any]] = []
    for config in BOOKS:
        pages = (
            load_hanon_pages(config)
            if config.material_id == "hanon"
            else load_ocr_text_pages(config)
        )
        materials.append(build_book(config, source_materials[config.material_id], pages))

    JIANPU_CATALOG_PATH.write_text(
        json.dumps(
            {
                "schema_version": "1.0",
                "generated_at": date.today().isoformat(),
                "materials": materials,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    summary = "，".join(
        f"{material['title']} {len(material['segments'])} 个片段"
        for material in materials
    )
    print(f"Generated jianpu textbook library: {summary}")


if __name__ == "__main__":
    main()
