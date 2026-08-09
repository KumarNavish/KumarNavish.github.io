#!/usr/bin/env bash
set -euo pipefail

python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r casepath-api/requirements.txt

# Build the claim package, then replace procedural image drawings with
# checksum-verified licensed photographs before the API imports its data.
python casepath-api/generate_artifacts.py
python casepath-api/replace_photographic_evidence.py .

python -m compileall -q casepath-api/casepath_api

test -f casepath-api/artifacts/lease-agreement.pdf
test -f casepath-api/artifacts/bedroom-mould-2026-07-27.jpg
test -f casepath-api/artifacts/later-window-condensation-2026-08-12.jpg
test -f casepath-api/artifacts/IMAGE_ATTRIBUTION.md
grep -q 'Wikimedia Commons' casepath-api/artifacts/IMAGE_ATTRIBUTION.md
echo '2f2b0db8db9b16b2509f802f87dca6f2761f95db  casepath-api/artifacts/bedroom-mould-2026-07-27.jpg' | sha1sum --check
echo 'd65830510a5f556f5d1f993ef6af4e30fd2efb07  casepath-api/artifacts/later-window-condensation-2026-08-12.jpg' | sha1sum --check

PYTHONPATH=casepath-api CASEPATH_DB_PATH=/tmp/casepath-build-smoke.db python - <<'PY'
import hashlib
from pathlib import Path

from casepath_api.app import app, healthz, readyz
from casepath_api.data import ARTIFACTS, CLAIMS, DEMO_CLAIM

assert app is not None
assert healthz()["status"] == "ok"
assert readyz()["status"] == "ready"
assert DEMO_CLAIM["claim_id"] == "DEF-027-E0-DEMO"
assert len(CLAIMS) == 2

primary_path = Path("casepath-api/artifacts/bedroom-mould-2026-07-27.jpg")
later_path = Path("casepath-api/artifacts/later-window-condensation-2026-08-12.jpg")
assert hashlib.sha1(primary_path.read_bytes()).hexdigest() == "2f2b0db8db9b16b2509f802f87dca6f2761f95db"
assert hashlib.sha1(later_path.read_bytes()).hexdigest() == "d65830510a5f556f5d1f993ef6af4e30fd2efb07"
assert ARTIFACTS["art_photo"]["sha256"] == hashlib.sha256(primary_path.read_bytes()).hexdigest()
assert ARTIFACTS["art_later_photo"]["sha256"] == hashlib.sha256(later_path.read_bytes()).hexdigest()
assert ARTIFACTS["art_photo"]["size_bytes"] > 100_000
assert ARTIFACTS["art_later_photo"]["size_bytes"] > 100_000
print("CasePath direct API build smoke passed")
PY
