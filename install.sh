#!/usr/bin/env bash
# Link the agile-flow skills into the OpenCode skills directory.
# Override the destination with AGILE_SKILLS_TARGET.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${AGILE_SKILLS_TARGET:-$HOME/.config/opencode/skills}"

mkdir -p "$TARGET"

for dir in "$HERE"/skills/*/; do
  name="$(basename "$dir")"
  dest="$TARGET/$name"

  if [ -e "$dest" ] && [ ! -L "$dest" ]; then
    echo "refusing to replace $dest: it is a real file or directory, not a symlink" >&2
    exit 1
  fi
  if [ -L "$dest" ]; then
    rm "$dest"
  fi
  ln -s "$dir" "$dest"
  echo "linked $name"
done

echo "installed into $TARGET"
