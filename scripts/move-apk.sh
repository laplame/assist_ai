#!/bin/bash
# Moves the release APK to the repository root with a new timestamp on every run.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="${1:-$root/apps/mobile/android/app/build/outputs/apk/release/app-release.apk}"
if [[ ! -f "$src" ]]; then
  echo "No hay APK en $src" >&2
  exit 1
fi
stamp="$(date +%Y%m%d-%H%M%S)"
dest="$root/bizneai-kiosko-${stamp}.apk"
mv "$src" "$dest"
echo "$dest"
