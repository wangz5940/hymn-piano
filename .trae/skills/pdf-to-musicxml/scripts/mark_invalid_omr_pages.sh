#!/bin/bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <input.omr> <output.omr> <pages-or-ranges>" >&2
  echo "Example: $0 book.omr book-clean.omr 1-6,90" >&2
  exit 1
fi

input_omr=$1
output_omr=$2
page_specification=$3
working_directory=$(mktemp -d)
book_xml="$working_directory/book.xml"

cleanup() {
  rm -rf "$working_directory"
}
trap cleanup EXIT

if [[ ! -f "$input_omr" ]]; then
  echo "Input OMR file does not exist: $input_omr" >&2
  exit 2
fi

mkdir -p "$(dirname "$output_omr")"
output_omr="$(cd "$(dirname "$output_omr")" && pwd)/$(basename "$output_omr")"
rm -f "$output_omr"
ditto -x -k "$input_omr" "$working_directory"

pages=()
for token in ${page_specification//,/ }; do
  if [[ "$token" =~ ^[0-9]+-[0-9]+$ ]]; then
    start_page=${token%-*}
    end_page=${token#*-}
    if ((start_page > end_page)); then
      echo "Invalid descending page range: $token" >&2
      exit 2
    fi
    while IFS= read -r page; do
      pages+=("$page")
    done < <(seq "$start_page" "$end_page")
  elif [[ "$token" =~ ^[0-9]+$ ]]; then
    pages+=("$token")
  else
    echo "Invalid page selector: $token" >&2
    exit 2
  fi
done

for page in "${pages[@]}"; do
  if ! rg -q "<sheet number=\"$page\"" "$book_xml"; then
    echo "Sheet $page was not found in $book_xml" >&2
    exit 2
  fi

  if ! rg -q "<sheet number=\"$page\"[^>]*invalid=\"true\"" "$book_xml"; then
    perl -0pi -e \
      's{<sheet number="'$page'"([^>]*)>}{<sheet number="'$page'"$1 invalid="true">}' \
      "$book_xml"
  fi

  perl -0pi -e \
    's{\s*<page sheet-number="'$page'" sheet-page-id="[0-9]+"/>}{}g' \
    "$book_xml"
done

xmllint --noout "$book_xml"
(cd "$working_directory" && zip -q -r "$output_omr" book.xml sheet#*)
