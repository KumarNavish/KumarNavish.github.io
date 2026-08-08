#!/usr/bin/env bash
set -euo pipefail

# The v12.0.1 source is committed directly on master. Build that source rather
# than unpacking a second archive over it, which previously reintroduced stale
# files and an incompatible dependency set.
python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r casepath-api/requirements.txt
python casepath-api/generate_flagship_v12.py

# Serve the exact v12 frontend through the API as a deployment-safe origin.
python - <<'PY'
from pathlib import Path
path = Path('casepath-api/casepath_api/app.py')
text = path.read_text(encoding='utf-8')
marker = '# CASEPATH_V12_FRONTEND_MOUNT'
if marker not in text:
    text += '''\n\n# CASEPATH_V12_FRONTEND_MOUNT\nfrom fastapi.staticfiles import StaticFiles as _StaticFiles\n_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "casepath"\napp.mount("/frontend", _StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="casepath-v12-frontend")\n'''
    path.write_text(text, encoding='utf-8')
PY

test "$(cat casepath-api/artifacts/.flagship-v12)" = '12.0.1'
python -m compileall -q casepath-api/casepath_api
