#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

if command -v git >/dev/null 2>&1; then
  PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
else
  PROJECT_ROOT=""
fi

if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
else
  PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd -P)"
fi

cd "$PROJECT_ROOT"

SOURCE_PATH="."

usage() {
  echo "Usage:"
  echo "  npm run zip"
  echo "  npm run zip -- --folder PATH"
}

while (( $# > 0 )); do
  case "$1" in
    --folder)
      if (( $# < 2 )); then
        echo "ERROR: --folder requires a folder path." >&2
        usage >&2
        exit 2
      fi

      SOURCE_PATH="$2"
      shift 2
      ;;

    --folder=*)
      SOURCE_PATH="${1#*=}"

      if [[ -z "$SOURCE_PATH" ]]; then
        echo "ERROR: --folder requires a folder path." >&2
        usage >&2
        exit 2
      fi

      shift
      ;;

    --help|-h)
      usage
      exit 0
      ;;

    *)
      echo "ERROR: Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

SOURCE_DIR="$(cd "$SOURCE_PATH" 2>/dev/null && pwd -P)" || {
  echo "ERROR: Folder does not exist: $SOURCE_PATH" >&2
  exit 2
}

case "$SOURCE_DIR" in
  "$PROJECT_ROOT"|"$PROJECT_ROOT"/*)
    ;;
  *)
    echo "ERROR: The folder must be inside the repository." >&2
    exit 2
    ;;
esac

if [[ "$SOURCE_DIR" == "$PROJECT_ROOT" ]]; then
  SOURCE_RELATIVE="."
else
  SOURCE_RELATIVE="${SOURCE_DIR#"$PROJECT_ROOT"/}"
fi

REPO_NAME="$(basename "$PROJECT_ROOT")"
REPO_FIRST_WORD="${REPO_NAME%%[-_ ]*}"

if [[ "$SOURCE_DIR" == "$PROJECT_ROOT" ]]; then
  ZIP_LABEL="$REPO_FIRST_WORD"
else
  ZIP_LABEL="$(basename "$SOURCE_DIR")"
fi

# Replace spaces with hyphens to keep the filename convenient.
ZIP_LABEL="${ZIP_LABEL// /-}"

if [[ -z "$ZIP_LABEL" || "$ZIP_LABEL" == *[!A-Za-z0-9_-]* ]]; then
  echo "ERROR: The generated ZIP name may contain only letters, numbers, hyphens, and underscores." >&2
  exit 2
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
SNAPSHOT_PATTERN="_repo-*.zip"
ZIP_PREFIX="_repo-${ZIP_LABEL}_"
ZIP_NAME="${ZIP_PREFIX}${TIMESTAMP}.zip"
ZIP_PATH="$PROJECT_ROOT/$ZIP_NAME"
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

file_count=0

copy_file() {
  local file="${1#./}"
  local file_name="${file##*/}"

  # Never include an existing repository snapshot inside another snapshot.
  if [[ "$file_name" == $SNAPSHOT_PATTERN ]]; then
    return
  fi

  # A tracked file may have been intentionally deleted from the working tree.
  # This archive represents the current working tree, so omit paths that no
  # longer exist instead of failing while trying to copy them.
  #
  # Keep symbolic links even if their target does not currently exist.
  if [[ ! -e "$file" && ! -L "$file" ]]; then
    return
  fi

  mkdir -p "$STAGE_DIR/$(dirname "$file")"
  cp -p -- "$file" "$STAGE_DIR/$file"
  ((file_count += 1))
}

git_root=""

if command -v git >/dev/null 2>&1; then
  git_root="$(git -C "$PROJECT_ROOT" rev-parse --show-toplevel 2>/dev/null || true)"

  if [[ -n "$git_root" ]]; then
    git_root="$(cd "$git_root" && pwd -P)"
  fi
fi

if [[ "$git_root" == "$PROJECT_ROOT" ]]; then
  # Include tracked files plus untracked files that are not ignored by Git,
  # limited to the selected folder.
  while IFS= read -r -d '' file; do
    copy_file "$file"
  done < <(
    git ls-files -z \
      --cached \
      --others \
      --exclude-standard \
      -- "$SOURCE_RELATIVE"
  )
else
  # If this is not a standalone Git repository, collect files directly while
  # excluding common generated, dependency, environment, and snapshot files.
  while IFS= read -r -d '' file; do
    copy_file "$file"
  done < <(
    find "$SOURCE_RELATIVE" -type f \
      ! -path '.git/*' \
      ! -path '*/.git/*' \
      ! -path 'node_modules/*' \
      ! -path '*/node_modules/*' \
      ! -path '_site/*' \
      ! -path '*/_site/*' \
      ! -path 'dist/*' \
      ! -path '*/dist/*' \
      ! -name '.env' \
      ! -name '.env.*' \
      ! -name 'npm-debug.log*' \
      ! -name 'yarn-debug.log*' \
      ! -name 'yarn-error.log*' \
      ! -name 'pnpm-debug.log*' \
      ! -name '.DS_Store' \
      ! -name 'Thumbs.db' \
      ! -name "$SNAPSHOT_PATTERN" \
      -print0
  )
fi

if (( file_count == 0 )); then
  echo "ERROR: No eligible files were found in: $SOURCE_RELATIVE" >&2
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
    "\$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${WIN_STAGE}', '${WIN_ZIP}', [System.IO.Compression.CompressionLevel]::Optimal, \$false)"
else
  echo "ERROR: Neither 'zip' nor 'powershell.exe' is available to create the archive." >&2
  exit 1
fi

if [[ ! -s "$ZIP_PATH" ]]; then
  echo "ERROR: ZIP creation finished without producing a valid archive." >&2
  exit 1
fi

# Keep exactly one repository snapshot. Older snapshots are removed only after
# the new archive has been successfully created and validated.
if ! find "$PROJECT_ROOT" -maxdepth 1 -type f \
  -name "$SNAPSHOT_PATTERN" \
  ! -name "$ZIP_NAME" \
  -delete; then
  echo "ERROR: The new ZIP was created, but older snapshots could not be removed." >&2
  exit 1
fi

trap - ERR

echo
echo "Successfully created ZIP file:"
echo "$ZIP_PATH"
echo
echo "Archived folder:"
echo "$SOURCE_DIR"
