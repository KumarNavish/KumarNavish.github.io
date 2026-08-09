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
done

cat > "$TRANSPORT_ROOT/checksums" <<EOF
03c329fa226cd5276f7c0491ddf0b090b216d38caf60b765e221ba39c7f4a947  $TRANSPORT_ROOT/chunk-00
760fe5ccceca0e78f9a68c149d7bf1e5e799196dcf11b81f951dbbd5b749e288  $TRANSPORT_ROOT/chunk-01
10da6f46705d5b6833bf46d4de5b3c78f2a39018dd6aa6adf1882f1d4ddc9bb2  $TRANSPORT_ROOT/chunk-02
2d61e04e864a06b1704e423580e81f5c9d1a5ee67847b598e75d1125c6c1248d  $TRANSPORT_ROOT/chunk-03
b5f7031db11d207f413aeb7165766a9e668b50e67dfad9bde1be477bff7535b3  $TRANSPORT_ROOT/chunk-04
f40cb8904c62325141fc50159ab1de363086852610dc47b5770d3508f589640c  $TRANSPORT_ROOT/chunk-05
bdf5021da77302a3b52c704f29aec02f8bab89e7b84920f4d31f52f4f30ffb0  $TRANSPORT_ROOT/chunk-06
EOF
sha256sum --check "$TRANSPORT_ROOT/checksums"
cat "$TRANSPORT_ROOT"/chunk-* > "$TRANSPORT_ROOT/archive.b64"
test "$(wc -c < "$TRANSPORT_ROOT/archive.b64")" -eq 371400
echo "bc1cbb5ad383197da737c639981abda4c80bdb1924614514144670c3a1193a15  $TRANSPORT_ROOT/archive.b64" | sha256sum --check
base64 --decode "$TRANSPORT_ROOT/archive.b64" > "$TRANSPORT_ROOT/archive.tar.xz"
echo "b1f1253589588557b9aeb6d81302220d833154d5d0f0ad44668acc46e11f4b4d  $TRANSPORT_ROOT/archive.tar.xz" | sha256sum --check
xz --test "$TRANSPORT_ROOT/archive.tar.xz"
tar -xJf "$TRANSPORT_ROOT/archive.tar.xz" -C "$RUNTIME_ROOT"

test -f "$RUNTIME_ROOT/casepath/index.html"
test -f "$RUNTIME_ROOT/casepath-api/casepath_api/data_v12.py"
test -f "$RUNTIME_ROOT/casepath-api/casepath_api/pipeline_v12.py"

cp casepath-api/requirements.txt "$RUNTIME_ROOT/casepath-api/requirements.txt"
python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r "$RUNTIME_ROOT/casepath-api/requirements.txt"
python casepath-api/prepare_runtime_v12.py "$RUNTIME_ROOT"

python -m compileall -q "$RUNTIME_ROOT/casepath-api/casepath_api"
test "$(cat "$RUNTIME_ROOT/casepath-api/artifacts/.flagship-v12")" = "12.0.2"
grep -q "flagship-v12-bootstrap" "$RUNTIME_ROOT/casepath/index.html"
grep -q '"release": "12.0.2"' "$RUNTIME_ROOT/casepath/release.json"

PYTHONPATH="$RUNTIME_ROOT/casepath-api" CASEPATH_DB_PATH="/tmp/casepath-build-smoke.db" python - <<'PY'
from casepath_api.app import app, deployment_health, readyz
assert app is not None
assert deployment_health()["release"] == "12.0.2"
assert readyz()["claims"] == 4
print("CasePath v12.0.2 build smoke passed")
PY
