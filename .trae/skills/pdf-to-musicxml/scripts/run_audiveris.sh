#!/bin/bash
set -euo pipefail

project_root=${PDF_TO_MUSICXML_PROJECT_ROOT:-"$PWD"}
audiveris_app=${AUDIVERIS_APP_PATH:-"$project_root/.trae/tools/Audiveris.app"}
audiveris_home=${AUDIVERIS_HOME:-"$project_root/.trae/audiveris-home"}
java_bin="$audiveris_app/Contents/runtime/Contents/Home/bin/java"
app_directory="$audiveris_app/Contents/app"

if [[ ! -x "$java_bin" ]]; then
  echo "Audiveris was not found at: $audiveris_app" >&2
  echo "Set AUDIVERIS_APP_PATH to an installed Audiveris.app path." >&2
  exit 2
fi

if [[ ! -d "$app_directory" ]]; then
  echo "Audiveris application files were not found at: $app_directory" >&2
  exit 2
fi

mkdir -p "$audiveris_home/Library/Application Support"
classpath=$(printf '%s:' "$app_directory"/*.jar)

exec env HOME="$audiveris_home" \
  "$java_bin" \
  -Duser.home="$audiveris_home" \
  -Dfile.encoding=UTF-8 \
  -Xms512m \
  -Xmx8G \
  --add-exports=java.desktop/sun.awt.image=ALL-UNNAMED \
  --enable-native-access=ALL-UNNAMED \
  -cp "${classpath%:}" \
  Audiveris \
  "$@"
