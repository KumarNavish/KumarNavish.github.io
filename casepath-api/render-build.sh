#!/usr/bin/env bash
set -euo pipefail

# Reconstruct the checksum-bound v12.0.1 runtime source before building the API.
cat casepath-v12-runtime-payload/part-* > /tmp/casepath-v12-runtime.b64
test "$(wc -c < /tmp/casepath-v12-runtime.b64)" -eq 223176
echo '1b5301b05d2d8caaf59dd685890d30f056faebb5f20c02185c8d13747200e448  /tmp/casepath-v12-runtime.b64' | sha256sum --check
base64 --decode /tmp/casepath-v12-runtime.b64 > /tmp/casepath-v12-runtime.tar.xz
echo 'c691db57b637d097001594b3b8f4e449929b83595dcf862525ac6bc57178715a  /tmp/casepath-v12-runtime.tar.xz' | sha256sum --check
tar -xJf /tmp/casepath-v12-runtime.tar.xz -C .

python -m pip install --upgrade pip
python -m pip install -r casepath-api/requirements.txt
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
