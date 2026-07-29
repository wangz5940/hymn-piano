#!/bin/bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <mxl-directory> <output-directory> <file-prefix>" >&2
  exit 1
fi

mxl_directory=$1
output_directory=$2
file_prefix=$3
index_file="$output_directory/索引.md"
temporary_directory=$(mktemp -d)

cleanup() {
  rm -rf "$temporary_directory"
}
trap cleanup EXIT

mkdir -p "$output_directory"

{
  printf '# %s MusicXML 索引\n\n' "$file_prefix"
  printf '每个 `.musicxml` 文件对应 Audiveris 识别出的一个独立乐章。'
  printf '文件中的 `source-sheet-N` 字段记录其原始 PDF 页码。\n\n'
  printf '| 乐章 | 原始 PDF 页码 |\n'
  printf '| --- | --- |\n'

  found=0
  while IFS= read -r mxl_file; do
    found=1
    movement_number=$(basename "$mxl_file" | sed -E 's/.*\.mvt([0-9]+)\.mxl/\1/')
    printf -v padded_movement '%03d' "$movement_number"
    destination="$output_directory/${file_prefix}_乐章_${padded_movement}.musicxml"

    rm -rf "$temporary_directory"/*
    ditto -x -k "$mxl_file" "$temporary_directory"
    source_xml=$(find "$temporary_directory" -maxdepth 1 -type f -name '*.xml' -print -quit)
    if [[ -z "$source_xml" ]]; then
      echo "No MusicXML payload in $mxl_file" >&2
      exit 1
    fi

    cp "$source_xml" "$destination"
    source_pages=$(
      rg -o 'source-sheet-[0-9]+' "$destination" |
        sed 's/source-sheet-//' |
        sort -n -u |
        paste -sd ',' - |
        sed 's/,/, /g'
    )
    printf '| [%s](%s) | %s |\n' \
      "$(basename "$destination")" \
      "$(basename "$destination")" \
      "${source_pages:-未记录}"
  done < <(
    find "$mxl_directory" -maxdepth 1 -type f -name '*.mxl' -print |
      sed -nE 's#.*\.mvt([0-9]+)\.mxl$#\1\t&#p' |
      sort -n -k1,1 |
      cut -f2-
  )

  if [[ "$found" -eq 0 ]]; then
    echo "No .mxl files found in $mxl_directory" >&2
    exit 1
  fi
} > "$index_file"
