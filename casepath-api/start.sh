#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
TARGET="$ROOT/current-casepath"
cd "$TARGET"
export PYTHONPATH="$TARGET/casepath-api"
export CASEPATH_MODEL_MODE=deterministic_reference
export CASEPATH_SOURCE_COMMIT="$(git rev-parse HEAD)"
export CASEPATH_DB_PATH=/tmp/casepath-reviewer/casepath.db
export CASEPATH_ARTIFACT_REGISTRY_PATH=/tmp/casepath-reviewer/artifact-registry
export CASEPATH_LOCAL_STATIC_ROOT="$TARGET/casepath-public"
mkdir -p /tmp/casepath-reviewer/artifact-registry
python -m casepath_api.cli seed --corpus synthetic-150 >/tmp/casepath-workspace-seed.json
exec uvicorn casepath_api.app:app --host 0.0.0.0 --port "$PORT"
