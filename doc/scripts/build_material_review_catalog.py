#!/usr/bin/env python3
"""Build browser review assets and candidate practice events for Panio.

The browser receives MusicXML, a compact catalog, and deterministic
MusicXML-derived practice events for manual review. The generated catalog
must not mark OMR candidates as published only because practice events exist.
It intentionally excludes source PDFs, OCR text, Audiveris work files, logs,
and offline normalized datasets.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DIR = PROJECT_ROOT / "public" / "materials"
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


@dataclass(frozen=True)
class book_config:
    material_id: str
    title: str
    source_dir: Path
    file_prefix: str
    page_count: int
    ocr_path: Path | None = None
    fingering_candidates_path: Path | None = None


BOOKS = (
    book_config(
        material_id="beyer",
        title="拜厄钢琴基本教程",
        source_dir=PROJECT_ROOT / ".trae" / "documents" / "拜厄钢琴基本教程_MusicXML",
        file_prefix="拜厄钢琴基本教程",
        page_count=102,
    ),
    book_config(
        material_id="hanon",
        title="哈农钢琴练指法",
        source_dir=PROJECT_ROOT / ".trae" / "documents" / "哈农钢琴练指法_MusicXML",
        file_prefix="哈农钢琴练指法",
        page_count=119,
    ),
    book_config(
        material_id="john-thompson-easiest-1",
        title="约翰·汤普森简易钢琴教程 1",
        source_dir=PROJECT_ROOT / ".trae" / "documents" / "约翰·汤普森简易钢琴教程 1_MusicXML",
        file_prefix="约翰·汤普森简易钢琴教程 1",
        page_count=45,
        ocr_path=PROJECT_ROOT / ".trae" / "documents" / "约翰·汤普森简易钢琴教程 1_OCR文本.txt",
        fingering_candidates_path=PROJECT_ROOT / ".trae" / "documents" / "约翰·汤普森简易钢琴教程 1_指法候选.jsonl",
    ),
    book_config(
        material_id="john-thompson-easiest-2",
        title="约翰·汤普森简易钢琴教程 2",
        source_dir=PROJECT_ROOT / ".trae" / "documents" / "约翰·汤普森简易钢琴教程 2_MusicXML",
        file_prefix="约翰·汤普森简易钢琴教程 2",
        page_count=52,
        ocr_path=PROJECT_ROOT / ".trae" / "documents" / "约翰·汤普森简易钢琴教程 2_OCR文本.txt",
        fingering_candidates_path=PROJECT_ROOT / ".trae" / "documents" / "约翰·汤普森简易钢琴教程 2_指法候选.jsonl",
    ),
)


FINGERING_RULE_KEYWORDS = (
    "指法",
    "手指",
    "手指操",
    "大拇指",
    "拇指",
    "右手",
    "左手",
    "换指",
    "抬指",
    "五指",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_source_pages(root: ET.Element) -> list[int]:
    pages: list[int] = []
    for field in root.findall("./identification/miscellaneous/miscellaneous-field"):
        name = field.attrib.get("name", "")
        if name.startswith("source-sheet-"):
            page_text = name.removeprefix("source-sheet-")
            if page_text.isdigit():
                pages.append(int(page_text))
    return sorted(set(pages))


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


def parse_musicxml_summary(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    root = ET.parse(path).getroot()
    measure_count = max(
        (len(part.findall("./measure")) for part in root.findall("./part")),
        default=0,
    )
    time_signatures: list[str] = []
    for time in root.findall("./part/measure/attributes/time"):
        beats = (time.findtext("beats") or "").strip()
        beat_type = (time.findtext("beat-type") or "").strip()
        if beats and beat_type:
            signature = f"{beats}/{beat_type}"
            if signature not in time_signatures:
                time_signatures.append(signature)

    summary = {
        "xml_version": root.attrib.get("version", ""),
        "part_count": len(root.findall("./part")),
        "measure_count": measure_count,
        "time_signatures": time_signatures,
        "source_pages": parse_source_pages(root),
    }
    return summary, parse_practice_events(root)


def parse_practice_events(root: ET.Element) -> list[dict[str, Any]]:
    grouped: dict[tuple[int, float], dict[str, Any]] = {}

    for part in root.findall("./part"):
        divisions = 1
        measures = part.findall("./measure")
        for measure_index, measure in enumerate(measures, start=1):
            attributes = measure.find("attributes")
            if attributes is not None:
                divisions = int(child_text(attributes, "divisions") or divisions or "1")
                divisions = max(divisions, 1)

            cursor = 0
            previous_note_onset = 0
            measure_number = measure.attrib.get("number", str(measure_index))

            for child in list(measure):
                if child.tag == "attributes":
                    continue
                if child.tag == "backup":
                    cursor = max(0, cursor - int(child_text(child, "duration") or "0"))
                    continue
                if child.tag == "forward":
                    cursor += int(child_text(child, "duration") or "0")
                    continue
                if child.tag != "note":
                    continue

                duration = int(child_text(child, "duration") or "0")
                is_chord_tone = child.find("chord") is not None
                onset = previous_note_onset if is_chord_tone else cursor
                if not is_chord_tone:
                    previous_note_onset = onset

                if child.find("rest") is None:
                    pitch = child.find("pitch")
                    midi = pitch_to_midi(pitch) if pitch is not None else None
                    if midi is not None:
                        onset_beats = round(onset / divisions, 6)
                        key = (measure_index, onset_beats)
                        event = grouped.setdefault(
                            key,
                            {
                                "measure_index": measure_index,
                                "measure_number": measure_number,
                                "onset_beats": onset_beats,
                                "duration_beats": 0,
                                "notes": set(),
                                "staffs": set(),
                            },
                        )
                        event["notes"].add(midi)
                        event["staffs"].add(child_text(child, "staff") or "")
                        event.setdefault("fingerings", []).extend(
                            parse_note_fingerings(child, midi, child_text(child, "staff"))
                        )
                        event["duration_beats"] = max(
                            event["duration_beats"],
                            round(max(duration, 1) / divisions, 6),
                        )

                if not is_chord_tone:
                    cursor += duration

    events: list[dict[str, Any]] = []
    by_measure: dict[int, list[dict[str, Any]]] = {}
    for event in grouped.values():
        by_measure.setdefault(event["measure_index"], []).append(event)

    for measure_index in sorted(by_measure):
        measure_events = sorted(by_measure[measure_index], key=lambda item: item["onset_beats"])
        for index, event in enumerate(measure_events):
            next_event = measure_events[index + 1] if index + 1 < len(measure_events) else None
            duration_beats = (
                max(0.125, round(next_event["onset_beats"] - event["onset_beats"], 6))
                if next_event
                else max(0.125, event["duration_beats"])
            )
            notes = sorted(event["notes"])
            staffs = event["staffs"]
            if "1" in staffs and "2" in staffs:
                hand = "both"
            elif "2" in staffs:
                hand = "left"
            elif "1" in staffs:
                hand = "right"
            else:
                hand = "left" if max(notes) < 60 else "right"

            practice_event = {
                "measure_index": measure_index,
                "measure_number": event["measure_number"],
                "onset_beats": event["onset_beats"],
                "duration_beats": duration_beats,
                "notes": notes,
                "note_names": [midi_to_name(midi) for midi in notes],
                "notation": f"第 {measure_index} 小节",
                "hand": hand,
                "match_mode": "chord" if len(notes) > 1 else "single_note",
            }
            score_fingerings = dedupe_fingerings(event.get("fingerings", []), notes)
            if score_fingerings:
                practice_event["fingerings"] = score_fingerings
            events.append(practice_event)

    return events


def parse_note_fingerings(note: ET.Element, midi: int, staff: str | None) -> list[dict[str, Any]]:
    fingerings: list[dict[str, Any]] = []
    for fingering in note.findall("./notations/technical/fingering"):
        text = (fingering.text or "").strip()
        if not re.fullmatch(r"[1-5]", text):
            continue
        hand = "left" if staff == "2" else "right"
        placement = fingering.attrib.get("placement")
        if placement == "below":
            hand = "left"
        elif placement == "above":
            hand = "right"
        fingerings.append(
            {
                "note": midi,
                "finger": int(text),
                "hand": hand,
                "source": "score",
            }
        )
    return fingerings


def dedupe_fingerings(
    fingerings: list[dict[str, Any]],
    notes: list[int],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    used: set[tuple[int, int, str]] = set()
    note_set = set(notes)
    for fingering in fingerings:
        note = int(fingering["note"])
        finger = int(fingering["finger"])
        hand = str(fingering["hand"])
        key = (note, finger, hand)
        if note not in note_set or key in used:
            continue
        used.add(key)
        result.append(
            {
                "note": note,
                "finger": finger,
                "hand": hand,
                "source": "score",
            }
        )
    return result


def load_hanon_metadata(source_dir: Path) -> dict[int, dict[str, Any]]:
    manifest_path = source_dir / "manifest.json"
    if not manifest_path.exists():
        return {}

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    return {
        int(segment["sequence"]): segment
        for segment in manifest.get("segments", [])
        if isinstance(segment.get("sequence"), int)
    }


def sequence_from_name(path: Path, file_prefix: str) -> int:
    match = re.fullmatch(re.escape(file_prefix) + r"_乐章_(\d{3})\.musicxml", path.name)
    if not match:
        raise ValueError(f"Unexpected MusicXML file name: {path.name}")
    return int(match.group(1))


def format_source_pages(pages: list[int]) -> str:
    if not pages:
        return "未记录源页"
    return "PDF 第 " + "、".join(str(page) for page in pages) + " 页"


def read_ocr_pages(path: Path | None) -> dict[int, list[str]]:
    if path is None or not path.exists():
        return {}

    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^## PDF 第 (\d+) 页\s*\n(.*?)(?=^## PDF 第 |\Z)", re.MULTILINE | re.DOTALL)
    pages: dict[int, list[str]] = {}
    for page, body in pattern.findall(text):
        lines = [
            re.sub(r"\s+", " ", line).strip()
            for line in body.splitlines()
            if re.sub(r"\s+", " ", line).strip()
        ]
        pages[int(page)] = lines
    return pages


def load_fingering_candidates(path: Path | None) -> dict[int, list[dict[str, Any]]]:
    if path is None or not path.exists():
        return {}

    candidates: dict[int, list[dict[str, Any]]] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        if not raw_line.strip():
            continue
        record = json.loads(raw_line)
        page = int(record.get("page", 0))
        if page <= 0:
            continue
        candidates.setdefault(page, []).append(record)
    return candidates


def extract_fingering_text_rules(
    ocr_pages: dict[int, list[str]],
    source_pages: list[int],
) -> list[dict[str, Any]]:
    rules: list[dict[str, Any]] = []
    seen: set[tuple[int, str]] = set()
    for page in source_pages:
        for line in ocr_pages.get(page, []):
            if not any(keyword in line for keyword in FINGERING_RULE_KEYWORDS):
                continue
            key = (page, line)
            if key in seen:
                continue
            seen.add(key)
            rules.append(
                {
                    "source": "ocr_text",
                    "page": page,
                    "text": line,
                    "status": "candidate",
                }
            )
    return rules


def write_fingering_candidate_asset(
    target_dir: Path,
    material_id: str,
    segment_id: str,
    xml_file: Path,
    source_pages: list[int],
    ocr_pages: dict[int, list[str]],
    candidates_by_page: dict[int, list[dict[str, Any]]],
) -> str | None:
    candidates = [
        candidate
        for page in source_pages
        for candidate in candidates_by_page.get(page, [])
    ]
    text_rules = extract_fingering_text_rules(ocr_pages, source_pages)
    if not candidates and not text_rules:
        return None

    file_name = xml_file.stem + ".fingering.json"
    payload = {
        "schema_version": "1.0",
        "asset_id": segment_id,
        "source_pages": source_pages,
        "extraction": {
            "engine": "macOS Vision OCR",
            "status": "candidate",
            "candidate_count": len(candidates),
            "text_rule_count": len(text_rules),
        },
        "candidates": candidates,
        "text_rules": text_rules,
        "limitation": (
            "指法候选来自普通文字 OCR 的 1-5 数字和教材文字说明，"
            "不是经过人工校对的逐音指法；正式跟弹只能使用 source=score 或人工确认后的指法。"
        ),
    }
    (target_dir / file_name).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return f"/materials/{material_id}/{file_name}"


def copy_material_files(config: book_config) -> dict[str, Any]:
    target_dir = PUBLIC_DIR / config.material_id
    xml_files = sorted(
        config.source_dir.glob("*.musicxml"),
        key=lambda path: sequence_from_name(path, config.file_prefix),
    )

    if not xml_files:
        raise ValueError(f"No MusicXML files found for {config.material_id}")

    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.mkdir(parents=True)

    hanon_metadata = load_hanon_metadata(config.source_dir)
    ocr_pages = read_ocr_pages(config.ocr_path)
    fingering_candidates = load_fingering_candidates(config.fingering_candidates_path)
    segments: list[dict[str, Any]] = []

    for xml_file in xml_files:
        sequence = sequence_from_name(xml_file, config.file_prefix)
        summary, practice_events = parse_musicxml_summary(xml_file)
        source_metadata = hanon_metadata.get(sequence, {})
        source_pages = source_metadata.get("source_pages") or summary["source_pages"]
        source_pages = [int(page) for page in source_pages]
        ocr_labels = source_metadata.get("ocr_labels") or []
        ocr_exercise_numbers = source_metadata.get("ocr_exercise_numbers") or []

        shutil.copy2(xml_file, target_dir / xml_file.name)

        segment_id = f"{config.material_id}.segment.{sequence:03d}"
        source_hash = sha256(xml_file)
        segment = {
            "id": segment_id,
            "material_id": config.material_id,
            "sequence": sequence,
            "title": f"{config.title} · 乐章 {sequence:03d}",
            "source_pages": source_pages,
            "source_page_label": format_source_pages(source_pages),
            "ocr_labels": ocr_labels,
            "ocr_exercise_numbers": ocr_exercise_numbers,
            "section": source_metadata.get("section"),
            "xml_version": summary["xml_version"],
            "part_count": summary["part_count"],
            "measure_count": summary["measure_count"],
            "time_signatures": summary["time_signatures"],
            "musicxml_url": f"/materials/{config.material_id}/{xml_file.name}",
            "sha256": source_hash,
            "source_status": "candidate",
            "status": "needs_review",
            "realtime_judgement_allowed": False,
            "mapping_confidence": "source_page",
        }
        fingering_candidates_url = write_fingering_candidate_asset(
            target_dir=target_dir,
            material_id=config.material_id,
            segment_id=segment_id,
            xml_file=xml_file,
            source_pages=source_pages,
            ocr_pages=ocr_pages,
            candidates_by_page=fingering_candidates,
        )
        if fingering_candidates_url:
            segment["fingering_candidates_url"] = fingering_candidates_url

        if practice_events:
            for event_index, event in enumerate(practice_events, start=1):
                event["id"] = f"{segment_id}.event.{event_index:05d}"
            practice_file_name = xml_file.stem + ".practice.json"
            (target_dir / practice_file_name).write_text(
                json.dumps(
                    {
                        "schema_version": "1.0",
                        "asset_id": segment_id,
                        "source_sha256": source_hash,
                        "events": practice_events,
                    },
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
                encoding="utf-8",
            )
            segment.update(
                {
                    "derived_assets": {
                        "source_sha256": source_hash,
                        "practice_events_url": f"/materials/{config.material_id}/{practice_file_name}",
                    },
                }
            )

        segments.append(segment)

    return {
        "id": config.material_id,
        "title": config.title,
        "page_count": config.page_count,
        "segment_count": len(segments),
        "segments": segments,
    }


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    materials = [copy_material_files(config) for config in BOOKS]
    catalog = {
        "schema_version": "1.0",
        "generated_at": date.today().isoformat(),
        "review_only": True,
        "notice": "Candidate MusicXML and derived practice events are for source comparison only and must not drive realtime judgement.",
        "materials": materials,
    }
    (PUBLIC_DIR / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    totals = ", ".join(
        f"{material['title']} {material['segment_count']} 个片段"
        for material in materials
    )
    print(f"Generated local review catalog: {totals}")


if __name__ == "__main__":
    main()
