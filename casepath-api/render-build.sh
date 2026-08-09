#!/usr/bin/env bash
set -euo pipefail

RUNTIME_ROOT="${CASEPATH_RUNTIME_ROOT:-casepath-runtime}"
TRANSPORT_ROOT="${RUNNER_TEMP:-/tmp}/casepath-v12-transport"
SOURCE_BRANCH="casepath-flagship-v12"
BASE_URL="https://raw.githubusercontent.com/KumarNavish/KumarNavish.github.io/${SOURCE_BRANCH}/casepath-v12-upload"

rm -rf "$RUNTIME_ROOT" "$TRANSPORT_ROOT"
mkdir -p "$RUNTIME_ROOT" "$TRANSPORT_ROOT"

for part in 00 01 02 03 04 05 06; do
  curl --fail --location --retry 5 --retry-delay 2 \
    "$BASE_URL/chunk-$part" \
    --output "$TRANSPORT_ROOT/chunk-$part"
  test -s "$TRANSPORT_ROOT/chunk-$part"
done

cat \
  "$TRANSPORT_ROOT/chunk-00" \
  "$TRANSPORT_ROOT/chunk-01" \
  "$TRANSPORT_ROOT/chunk-02" \
  "$TRANSPORT_ROOT/chunk-03" \
  "$TRANSPORT_ROOT/chunk-04" \
  "$TRANSPORT_ROOT/chunk-05" \
  "$TRANSPORT_ROOT/chunk-06" \
  > "$TRANSPORT_ROOT/archive.b64"

printf 'CasePath transport bytes: '
wc -c < "$TRANSPORT_ROOT/archive.b64"
printf 'CasePath transport SHA-256: '
sha256sum "$TRANSPORT_ROOT/archive.b64" | awk '{print $1}'

base64 --decode "$TRANSPORT_ROOT/archive.b64" > "$TRANSPORT_ROOT/archive.tar.xz"
xz --test "$TRANSPORT_ROOT/archive.tar.xz"
printf 'CasePath source archive SHA-256: '
sha256sum "$TRANSPORT_ROOT/archive.tar.xz" | awk '{print $1}'
tar -xJf "$TRANSPORT_ROOT/archive.tar.xz" -C "$RUNTIME_ROOT"

test -f "$RUNTIME_ROOT/casepath/index.html"
test -f "$RUNTIME_ROOT/casepath/release.json"
test -f "$RUNTIME_ROOT/casepath-api/casepath_api/app.py"
test -f "$RUNTIME_ROOT/casepath-api/casepath_api/data_v12.py"
test -f "$RUNTIME_ROOT/casepath-api/casepath_api/pipeline_v12.py"
test -f "$RUNTIME_ROOT/casepath-api/casepath_api/storage.py"
test -d "$RUNTIME_ROOT/casepath-api/artifacts"

cp casepath-api/requirements.txt "$RUNTIME_ROOT/casepath-api/requirements.txt"
python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r "$RUNTIME_ROOT/casepath-api/requirements.txt"
python casepath-api/prepare_runtime_v12.py "$RUNTIME_ROOT"
python casepath-api/replace_photographic_evidence.py "$RUNTIME_ROOT"

python -m compileall -q "$RUNTIME_ROOT/casepath-api/casepath_api"
test "$(cat "$RUNTIME_ROOT/casepath-api/artifacts/.flagship-v12")" = "12.0.2"
grep -q '"release": "12.0.2"' "$RUNTIME_ROOT/casepath/release.json"
grep -q 'Wikimedia Commons' "$RUNTIME_ROOT/casepath-api/artifacts/IMAGE_ATTRIBUTION.md"
echo '6a3f2cbeb270c21628f0d814d852895dbcff5e0cc8cf04502ca7d5cd7dfba732  '"$RUNTIME_ROOT"'/casepath-api/artifacts/bedroom-mould-2026-07-27.jpg' | sha256sum --check

PYTHONPATH="$RUNTIME_ROOT/casepath-api" CASEPATH_DB_PATH="/tmp/casepath-build-smoke.db" python - <<'PY'
from casepath_api.app import app, deployment_health, readyz
assert app is not None
health = deployment_health()
ready = readyz()
assert health["release"] == "12.0.2", health
assert health["flagship_claim"] == "BS-DEF-2026-041", health
assert ready["claims"] == 4, ready
print("CasePath v12.0.2 build smoke passed")
PY
