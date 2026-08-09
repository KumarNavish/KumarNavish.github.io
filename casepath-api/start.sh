#!/usr/bin/env bash
set -euo pipefail
RUNTIME_ROOT="${CASEPATH_RUNTIME_ROOT:-casepath-runtime}"
export CASEPATH_DB_PATH="${CASEPATH_DB_PATH:-/tmp/casepath-flagship-v12/casepath.db}"
mkdir -p "$(dirname "$CASEPATH_DB_PATH")"
exec uvicorn casepath_api.app:app --app-dir "$RUNTIME_ROOT/casepath-api" --host 0.0.0.0 --port "${PORT:-10000}"
