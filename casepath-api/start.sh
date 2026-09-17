#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
TARGET="$ROOT/current-casepath"
cd "$TARGET"
export PYTHONPATH="$TARGET/casepath-api"
export CASEPATH_MODEL_MODE=deterministic_reference
export CASEPATH_SOURCE_COMMIT="$(git rev-parse HEAD)"
unset RENDER_GIT_COMMIT
export CASEPATH_DB_PATH=/tmp/casepath-reviewer/casepath.db
export CASEPATH_ARTIFACT_REGISTRY_PATH=/tmp/casepath-reviewer/artifact-registry
export CASEPATH_LOCAL_STATIC_ROOT="$TARGET/casepath-public"
mkdir -p /tmp/casepath-reviewer/artifact-registry
python -m casepath_api.cli seed --corpus synthetic-150 >/tmp/casepath-workspace-seed.json

uvicorn casepath_api.app:app --host 0.0.0.0 --port "$PORT" &
child_pid="$!"
shutdown() {
  if kill -0 "$child_pid" 2>/dev/null; then
    kill -TERM "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
}
trap shutdown EXIT INT TERM

cd "$ROOT"
CASEPATH_SOURCE_COMMIT="$CASEPATH_SOURCE_COMMIT" PORT="$PORT" python casepath-api/reviewer-acceptance.py
wait "$child_pid"
