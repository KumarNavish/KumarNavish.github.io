#!/usr/bin/env bash
set -euo pipefail
exec uvicorn casepath_api.app:app --app-dir casepath-api --host 0.0.0.0 --port "${PORT:-8000}"
