#!/usr/bin/env python3
"""Build a program/AI-readable Hanon dataset from OCR and MusicXML.

The generated JSON keeps OCR and notation separate but joins them through a
stable segment_id. MusicXML remains the structured notation source; OCR is
metadata and human-review context only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MUSICXML_DIR = PROJECT_ROOT / ".trae/documents/哈农钢琴练指法_MusicXML"
DEFAULT_OCR_PATH = PROJECT_ROOT / ".trae/documents/哈农钢琴练指法_OCR文本.txt"
DEFAULT_INDEX_PATH = DEFAULT_MUSICXML_DIR / "索引.md"
DEFAULT_OUTPUT_DIR = DEFAULT_MUSICXML_DIR

ROMAN_NUMERALS = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}

PITCH_BASE = {
    "C": 0,
    "D": 2,
    "E": 4,
    "F": 5,
    "G": 7,
    "A": 9,
    "B": 11,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--musicxml-dir", type=Path, default=DEFAULT_MUSICXML_DIR)
    parser.add_argument("--ocr", type=Path, default=DEFAULT_OCR_PATH)
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def read_ocr_pages(path: Path) -> dict[int, str]:
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^## PDF 第 (\d+) 页\s*\n(.*?)(?=^## PDF 第 |\Z)", re.MULTILINE | re.DOTALL)
    return {int(page): body.strip() for page, body in pattern.findall(text)}


def parse_index(path: Path) -> dict[int, list[int]]:
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"\| \[哈农钢琴练指法_乐章_(\d{3})\.musicxml\]\([^)]*\) \| ([^|]+)\|"
    )
    page_map: dict[int, list[int]] = {}
    for segment_number, page_text in pattern.findall(text):
        pages = [int(item) for item in re.findall(r"\d+", page_text)]
        page_map[int(segment_number)] = pages
    return page_map


def normalize_ocr_labels(text: str) -> list[str]:
    normalized = re.sub(r"练习\s+", "练习", text)
    labels = re.findall(r"练习([一二三四五六七八九十百]+)", normalized)
    return list(dict.fromkeys(f"练习{label}" for label in labels))


def chinese_number_to_int(value: str) -> int | None:
    if value.isdigit():
        return int(value)
    if value == "百":
        return 100
    if "百" in value:
        hundreds, remainder = value.split("百", 1)
        return ROMAN_NUMERALS.get(hundreds, 1) * 100 + (chinese_number_to_int(remainder) or 0)
    if "十" in value:
        tens, remainder = value.split("十", 1)
        tens_value = ROMAN_NUMERALS.get(tens, 1) if tens else 1
        return tens_value * 10 + (ROMAN_NUMERALS.get(remainder, 0) if remainder else 0)
    return ROMAN_NUMERALS.get(value)


def ocr_exercise_numbers(labels: list[str]) -> list[int]:
    values = []
    for label in labels:
        number = chinese_number_to_int(label.removeprefix("练习"))
        if number is not None:
            values.append(number)
    return sorted(set(values))


def section_for_pages(pages: list[int]) -> dict[str, str]:
    first_page = min(pages) if pages else 0
    if first_page <= 25:
        return {"id": "part_1", "title": "第一部分：准备练习"}
    if first_page <= 75:
        return {"id": "part_2", "title": "第二部分：高级练习"}
    return {"id": "part_3", "title": "第三部分：专门练习"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def child_text(element: ET.Element | None, tag: str) -> str | None:
    if element is None:
        return None
    value = element.findtext(tag)
    return value.strip() if value else None


def pitch_to_midi(step: str, octave: int, alter: int = 0) -> int:
    return (octave + 1) * 12 + PITCH_BASE[step] + alter


def parse_pitch(note: ET.Element) -> dict[str, Any] | None:
    pitch = note.find("pitch")
    if pitch is None:
        return None
    step = child_text(pitch, "step")
    octave_text = child_text(pitch, "octave")
    if step is None or octave_text is None:
        return None
    alter = int(child_text(pitch, "alter") or "0")
    octave = int(octave_text)
    return {
        "step": step,
        "alter": alter,
        "octave": octave,
        "midi": pitch_to_midi(step, octave, alter),
    }


def parse_source_sheets(root: ET.Element) -> list[int]:
    pages: list[int] = []
    for field in root.findall("./identification/miscellaneous/miscellaneous-field"):
        name = field.attrib.get("name", "")
        if name.startswith("source-sheet-"):
            page = name.removeprefix("source-sheet-")
            if page.isdigit():
                pages.append(int(page))
    return sorted(set(pages))


def parse_musicxml(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    root = ET.parse(path).getroot()
    parts = root.findall("./part")
    notes: list[dict[str, Any]] = []
    measures_count = 0
    rest_count = 0
    chord_note_count = 0
    voices: set[str] = set()
    staves: set[str] = set()
    divisions_seen: set[int] = set()
    time_signatures: list[dict[str, int]] = []
    clefs: list[dict[str, str]] = []
    directions: list[dict[str, Any]] = []

    for part in parts:
        measure_nodes = part.findall("./measure")
        measures_count = max(measures_count, len(measure_nodes))
        for measure_index, measure in enumerate(measure_nodes, start=1):
            cursor = 0
            previous_note_onset = 0
            divisions = 1
            attributes = measure.find("attributes")
            if attributes is not None:
                divisions = int(child_text(attributes, "divisions") or "1")
                divisions_seen.add(divisions)
                time = attributes.find("time")
                if time is not None:
                    beats = child_text(time, "beats")
                    beat_type = child_text(time, "beat-type")
                    if beats and beat_type:
                        signature = {"beats": int(beats), "beat_type": int(beat_type)}
                        if signature not in time_signatures:
                            time_signatures.append(signature)
                for clef in attributes.findall("clef"):
                    clef_value = {
                        "number": clef.attrib.get("number", "1"),
                        "sign": child_text(clef, "sign") or "",
                        "line": child_text(clef, "line") or "",
                    }
                    if clef_value not in clefs:
                        clefs.append(clef_value)

            for child in list(measure):
                if child.tag == "attributes":
                    continue
                if child.tag == "backup":
                    cursor -= int(child_text(child, "duration") or "0")
                    continue
                if child.tag == "forward":
                    cursor += int(child_text(child, "duration") or "0")
                    continue
                if child.tag == "direction":
                    sound = child.find("sound")
                    if sound is not None and sound.attrib.get("tempo"):
                        directions.append(
                            {
                                "measure": measure.attrib.get("number", str(measure_index)),
                                "tempo": float(sound.attrib["tempo"]),
                            }
                        )
                    continue
                if child.tag != "note":
                    continue

                duration = int(child_text(child, "duration") or "0")
                is_chord = child.find("chord") is not None
                onset = previous_note_onset if is_chord else cursor
                if not is_chord:
                    previous_note_onset = onset

                voice = child_text(child, "voice") or "1"
                staff = child_text(child, "staff") or "1"
                voices.add(voice)
                staves.add(staff)
                is_rest = child.find("rest") is not None
                pitch = parse_pitch(child)
                if is_rest:
                    rest_count += 1
                if is_chord:
                    chord_note_count += 1

                event: dict[str, Any] = {
                    "measure_index": measure_index,
                    "measure_number": measure.attrib.get("number", str(measure_index)),
                    "onset_divisions": onset,
                    "duration_divisions": duration,
                    "divisions": divisions,
                    "onset_beats": round(onset / divisions, 6),
                    "duration_beats": round(duration / divisions, 6),
                    "voice": voice,
                    "staff": staff,
                    "is_chord_tone": is_chord,
                    "is_rest": is_rest,
                }
                if pitch:
                    event["pitch"] = pitch
                if child.find("tie[@type='start']") is not None:
                    event["tie_start"] = True
                if child.find("tie[@type='stop']") is not None:
                    event["tie_stop"] = True
                notes.append(event)

                if not is_chord:
                    cursor += duration

    source_pages = parse_source_sheets(root)
    part_names = [
        (name.text or "").strip()
        for name in root.findall("./part-list/score-part/part-name")
        if (name.text or "").strip()
    ]
    metadata = {
        "xml_version": root.attrib.get("version"),
        "part_count": len(parts),
        "part_names": part_names,
        "measure_count": measures_count,
        "note_count": len(notes),
        "pitched_note_count": sum(1 for item in notes if "pitch" in item),
        "rest_count": rest_count,
        "chord_tone_count": chord_note_count,
        "voice_ids": sorted(voices),
        "staff_ids": sorted(staves),
        "divisions": sorted(divisions_seen),
        "time_signatures": time_signatures,
        "clefs": clefs,
        "directions": directions,
        "source_sheets_from_xml": source_pages,
    }
    return metadata, notes


def build_dataset(
    musicxml_dir: Path,
    ocr_path: Path,
    index_path: Path,
    output_dir: Path,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    ocr_pages = read_ocr_pages(ocr_path)
    page_map = parse_index(index_path)
    xml_files = sorted(musicxml_dir.glob("*.musicxml"))

    if len(xml_files) != len(page_map):
        raise ValueError(f"MusicXML count {len(xml_files)} does not match index count {len(page_map)}")

    ocr_jsonl_path = output_dir / "ocr_pages.jsonl"
    with ocr_jsonl_path.open("w", encoding="utf-8") as ocr_file:
        for page_number in sorted(ocr_pages):
            page_record = {
                "schema_version": "1.0",
                "record_type": "ocr_page",
                "source_document_id": "hanon-book",
                "pdf_page": page_number,
                "section": section_for_pages([page_number]),
                "exercise_labels": normalize_ocr_labels(ocr_pages[page_number]),
                "exercise_numbers": ocr_exercise_numbers(
                    normalize_ocr_labels(ocr_pages[page_number])
                ),
                "text": ocr_pages[page_number],
            }
            ocr_file.write(json.dumps(page_record, ensure_ascii=False, separators=(",", ":")) + "\n")

    summaries: list[dict[str, Any]] = []
    with (output_dir / "segments.jsonl").open("w", encoding="utf-8") as segment_file:
        for sequence, xml_path in enumerate(xml_files, start=1):
            match = re.search(r"_(\d{3})\.musicxml$", xml_path.name)
            if not match:
                raise ValueError(f"Unexpected MusicXML filename: {xml_path.name}")
            segment_number = int(match.group(1))
            pages = page_map[segment_number]
            section = section_for_pages(pages)
            music, note_events = parse_musicxml(xml_path)
            ocr_labels = sorted(
                {
                    label
                    for page in pages
                    for label in normalize_ocr_labels(ocr_pages.get(page, ""))
                }
            )
            ocr_context = [
                {
                    "pdf_page": page,
                    "exercise_labels": normalize_ocr_labels(ocr_pages.get(page, "")),
                    "exercise_numbers": ocr_exercise_numbers(
                        normalize_ocr_labels(ocr_pages.get(page, ""))
                    ),
                    "text": ocr_pages.get(page, ""),
                }
                for page in pages
                if page in ocr_pages
            ]
            segment_id = f"hanon.segment.{segment_number:03d}"
            for event_index, event in enumerate(note_events, start=1):
                event["event_id"] = f"{segment_id}.event.{event_index:05d}"
            record = {
                "schema_version": "1.0",
                "record_type": "score_segment",
                "segment_id": segment_id,
                "sequence": sequence,
                "book_id": "hanon-book",
                "section": section,
                "source": {
                    "pdf": "../../pdf/哈农钢琴练指法 (Hanon) (z-library.sk, 1lib.sk, z-lib.sk).pdf",
                    "pdf_pages": pages,
                    "ocr_file": "../哈农钢琴练指法_OCR文本.txt",
                    "ocr_page_refs": pages,
                    "ocr_labels": ocr_labels,
                    "ocr_exercise_numbers": ocr_exercise_numbers(ocr_labels),
                    "ocr_context": ocr_context,
                    "mapping_confidence": "source-page",
                },
                "musicxml": {
                    "path": xml_path.name,
                    "sha256": sha256(xml_path),
                    "format": "MusicXML",
                    "engine": "Audiveris 5.11.0 + ProxyMusic 4.0.3",
                    "status": "candidate",
                },
                "music": music,
                "quality": {
                    "status": "needs_review",
                    "reasons": [
                        "OMR-derived data has not passed manual visual review",
                        "OCR and MusicXML labels are linked by source pages, not asserted as one-to-one exercises",
                    ],
                    "realtime_judgement_allowed": False,
                },
                "note_events": note_events,
            }
            segment_file.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")

            summaries.append(
                {
                    "segment_id": segment_id,
                    "sequence": sequence,
                    "musicxml_path": xml_path.name,
                    "source_pages": pages,
                    "ocr_labels": ocr_labels,
                    "ocr_exercise_numbers": ocr_exercise_numbers(ocr_labels),
                    "section": section,
                    "measure_count": music["measure_count"],
                    "pitched_note_count": music["pitched_note_count"],
                    "status": "needs_review",
                }
            )

    manifest = {
        "schema_version": "1.0",
        "dataset_id": "hanon-book",
        "title": "哈农钢琴练指法结构化资源",
        "description": "OCR metadata joined with OMR-derived MusicXML segments. MusicXML is candidate data until manual review is complete.",
        "language": ["zh-CN", "en"],
        "source": {
            "pdf": "../../pdf/哈农钢琴练指法 (Hanon) (z-library.sk, 1lib.sk, z-lib.sk).pdf",
            "pdf_page_count": 119,
            "ocr": "../哈农钢琴练指法_OCR文本.txt",
            "musicxml_directory": ".",
        },
        "format": {
            "manifest": "manifest.json",
            "records": "segments.jsonl",
            "ocr_records": "ocr_pages.jsonl",
            "schema": "schema.json",
            "join_key": "segment_id",
        },
        "processing": {
            "ocr_engine": "macOS Vision OCR",
            "musicxml_engine": "Audiveris 5.11.0 + ProxyMusic 4.0.3",
            "generated_at": "2026-07-18",
            "realtime_judgement_allowed": False,
        },
        "sections": [
            {"id": "part_1", "title": "第一部分：准备练习", "pdf_pages": [6, 25]},
            {"id": "part_2", "title": "第二部分：高级练习", "pdf_pages": [26, 75]},
            {"id": "part_3", "title": "第三部分：专门练习", "pdf_pages": [76, 119]},
        ],
        "segments": summaries,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    schema = {
        "schema_version": "1.0",
        "record_types": {
            "ocr_page": {
                "required": [
                    "schema_version",
                    "record_type",
                    "source_document_id",
                    "pdf_page",
                    "text",
                ],
                "description": "OCR text and human-readable/numeric exercise labels keyed by PDF page.",
            },
            "score_segment": {
                "required": [
                    "schema_version",
                    "record_type",
                    "segment_id",
                    "source",
                    "musicxml",
                    "music",
                    "quality",
                    "note_events",
                ],
                "description": "One MusicXML segment joined to OCR page references and normalized note events.",
                "quality_status": ["needs_review", "verified", "published", "rejected"],
                "note_event_fields": [
                    "measure_index",
                    "measure_number",
                    "event_id",
                    "onset_divisions",
                    "duration_divisions",
                    "divisions",
                    "onset_beats",
                    "duration_beats",
                    "voice",
                    "staff",
                    "is_chord_tone",
                    "is_rest",
                    "pitch",
                ],
            },
        },
        "join_contract": {
            "segment_id": "Stable key shared by manifest summaries and segments.jsonl records.",
            "source.pdf_pages": "Authoritative PDF page mapping from 索引.md.",
            "source.ocr_page_refs": "Lookup keys in ocr_pages.jsonl.",
            "source.ocr_exercise_numbers": "Numbers extracted only from explicit OCR labels; may be incomplete.",
            "musicxml.path": "Relative path from the dataset directory.",
            "musicxml.sha256": "Content hash required for derived assets.",
        },
    }
    (output_dir / "schema.json").write_text(
        json.dumps(schema, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    readme = f"""# 哈农结构化数据

## 目录

- `manifest.json`：数据集元数据、章节和 68 个片段摘要。
- `segments.jsonl`：程序和 AI 的主读取文件，每行一个 `score_segment`，包含 MusicXML 元数据和规范化音符事件。
- `ocr_pages.jsonl`：每行一个 PDF 页面的 OCR 文本和练习标签。
- `schema.json`：字段契约和关联规则。
- `*.musicxml`：原始 OMR 导出的 MusicXML，当前全部为候选资源。

## 关联方式

```text
segments.jsonl.segment_id
├── source.pdf_pages
├── source.ocr_page_refs → ocr_pages.jsonl.pdf_page
└── musicxml.path + musicxml.sha256
```

MusicXML 片段不是教材练习编号的一对一映射。`ocr_labels` 和 `ocr_exercise_numbers` 只表示对应 PDF 页中 OCR 明确识别到的标签，`ocr_context` 保留该片段对应页面的完整 OCR 文本；标签可能不完整，在人工复核前，程序不得据此自动创建正式课程或实时判定。

## 程序读取示例

```python
import json
from pathlib import Path

dataset = Path("哈农钢琴练指法_MusicXML")
manifest = json.loads((dataset / "manifest.json").read_text())

for line in (dataset / manifest["format"]["records"]).read_text().splitlines():
    segment = json.loads(line)
    if segment["quality"]["status"] != "published":
        continue
    print(segment["segment_id"], len(segment["note_events"]))
```

## AI 使用约束

AI 可以读取：

- `source.ocr_page_refs` 对应的教材说明、章节和练习标签。
- `music` 中的拍号、谱表、小节、声部和音符统计。
- `note_events` 中的音高、时值、声部、谱表和连音信息。
- `musicxml.path` 指向的原始结构化乐谱。

AI 不应把 OMR 候选识别结果当成经过教师确认的正确谱面。`quality.realtime_judgement_allowed` 为 `false` 时，只能用于分析和审核。
"""
    (output_dir / "README.md").write_text(readme, encoding="utf-8")
    return manifest


def main() -> None:
    args = parse_args()
    manifest = build_dataset(
        musicxml_dir=args.musicxml_dir,
        ocr_path=args.ocr,
        index_path=args.index,
        output_dir=args.output_dir,
    )
    print(
        json.dumps(
            {
                "dataset_id": manifest["dataset_id"],
                "segments": len(manifest["segments"]),
                "output_dir": str(args.output_dir),
                "status": "needs_review",
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
