#!/usr/bin/env bash
set -euo pipefail

python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r casepath-api/requirements.txt

# Build the original claim package, then replace the procedural image drawings
# with checksum-verified licensed photographs before the API imports its data.
python casepath-api/generate_artifacts.py
python casepath-api/replace_photographic_evidence.py .

python -m compileall -q casepath-api/casepath_api

test -f casepath-api/artifacts/lease-agreement.pdf
test -f casepath-api/artifacts/bedroom-mould-2026-07-27.jpg
test -f casepath-api/artifacts/later-window-condensation-2026-08-12.jpg
test -f casepath-api/artifacts/IMAGE_ATTRIBUTION.md
grep -q 'Wikimedia Commons' casepath-api/artifacts/IMAGE_ATTRIBUTION.md
echo '6a3f2cbeb270c21628f0d814d852895dbcff5e0cc8cf04502ca7d5cd7dfba732  casepath-api/artifacts/bedroom-mould-2026-07-27.jpg' | sha256sum --check

PYTHONPATH=casepath-api CASEPATH_DB_PATH=/tmp/casepath-build-smoke.db python - <<'PY'
from casepath_api.app import app, healthz, readyz
from casepath_api.data import ARTIFACTS, CLAIMS, DEMO_CLAIM

assert app is not None
assert healthz()["status"] == "ok"
assert readyz()["status"] == "ready"
assert DEMO_CLAIM["claim_id"] == "DEF-027-E0-DEMO"
assert len(CLAIMS) == 2
assert ARTIFACTS["art_photo"]["sha256"] == "6a3f2cbeb270c21628f0d814d852895dbcff5e0cc8cf04502ca7d5cd7dfba732"
assert ARTIFACTS["art_photo"]["size_bytes"] > 100_000
print("CasePath direct API build smoke passed")
PY
