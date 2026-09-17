#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
TARGET="$ROOT/current-casepath"
rm -rf "$TARGET"
git clone --depth 1 https://github.com/KumarNavish/casepath.git "$TARGET"
cd "$TARGET"
export SOURCE_DATE_EPOCH=1786406400
export PYTHONPATH="$TARGET/casepath-api"
export CASEPATH_SOURCE_COMMIT="$(git rev-parse HEAD)"
python -m pip install --no-cache-dir -r casepath-api/requirements.lock
python casepath-api/generate_artifacts.py
python casepath-api/replace_photographic_evidence.py .
python casepath/tools/casepath_release.py generate
python casepath/tools/casepath_release.py verify
python casepath/tools/build_static_site.py
printf '%s\n' "$CASEPATH_SOURCE_COMMIT" > "$ROOT/current-casepath-commit.txt"
