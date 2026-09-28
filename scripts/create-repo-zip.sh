#!/usr/bin/env bash

set -Eeuo pipefail

ZIP_NAME="repo-working-tree.zip"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ZIP_PATH="$PACKAGE_ROOT/$ZIP_NAME"
STAGE_DIR="$(mktemp -d)"

fail() {
  echo "ERROR: Failed to create ZIP file: $ZIP_NAME" >&2
  exit 1
}

cleanup() {
  rm -rf "$STAGE_DIR"
}

trap cleanup EXIT
trap fail ERR

cd "$PACKAGE_ROOT"
file_count=0

copy_file() {
  local file="${1#./}"

  case "$file" in
    "$ZIP_NAME"|*.zip|*.tgz|node_modules/*|.git/*)
      return
      ;;
  esac

  if [[ ! -e "$file" && ! -L "$file" ]]; then
    return
  fi

  mkdir -p "$STAGE_DIR/$(dirname "$file")"
  cp -p -- "$file" "$STAGE_DIR/$file"
  ((file_count += 1))
}

# Use Git's tracked/non-ignored working-tree view when this package is its own
# repository. While the extraction is nested in a parent project, stay scoped
# to this directory and apply the same explicit generated-file exclusions.
if command -v git >/dev/null 2>&1 &&
  package_git_root="$(git rev-parse --show-toplevel 2>/dev/null)" &&
  [[ "$package_git_root" == "$PACKAGE_ROOT" ]]; then
  while IFS= read -r -d '' file; do
    copy_file "$file"
  done < <(git ls-files -z --cached --others --exclude-standard)
else
  while IFS= read -r -d '' file; do
    copy_file "$file"
  done < <(
    find . \
      \( -path './.git' -o -path './node_modules' \) -prune -o \
      \( -type f -o -type l \) -print0
  )
fi

if (( file_count == 0 )); then
  echo "ERROR: No eligible package files were found." >&2
  exit 1
fi

rm -f "$ZIP_PATH"

if command -v zip >/dev/null 2>&1; then
  (
    cd "$STAGE_DIR"
    zip -qr "$ZIP_PATH" .
  )
elif command -v powershell.exe >/dev/null 2>&1; then
  if ! command -v cygpath >/dev/null 2>&1; then
    echo "ERROR: cygpath is required for the PowerShell ZIP fallback." >&2
    exit 1
  fi

  WIN_STAGE="$(cygpath -w "$STAGE_DIR")"
  WIN_ZIP="$(cygpath -w "$ZIP_PATH")"

  powershell.exe -NoProfile -NonInteractive -Command \
    "\$ErrorActionPreference = 'Stop'; Compress-Archive -Path '${WIN_STAGE}\\*' -DestinationPath '${WIN_ZIP}' -Force"
else
  echo "ERROR: Neither 'zip' nor 'powershell.exe' is available to create the archive." >&2
  exit 1
fi

if [[ ! -s "$ZIP_PATH" ]]; then
  echo "ERROR: ZIP creation finished without producing a valid archive." >&2
  exit 1
fi

trap - ERR

echo
echo "Successfully created ZIP file:"
echo "$ZIP_PATH"
