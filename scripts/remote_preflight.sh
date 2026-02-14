#!/usr/bin/env bash
set -euo pipefail

REMOTE_NAME="${1:-origin}"
EXPECTED_OWNER="${EXPECTED_OWNER:-KumarNavish}"
EXPECTED_REPO="${EXPECTED_REPO:-bis-continual-process-automation-demo}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[remote:check] Not inside a git repository." >&2
  exit 2
fi

if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "[remote:check] Remote '$REMOTE_NAME' is not configured." >&2
  exit 2
fi

remote_url="$(git remote get-url "$REMOTE_NAME")"
echo "[remote:check] Checking $REMOTE_NAME -> $remote_url"

if [[ "$remote_url" != *"${EXPECTED_OWNER}/${EXPECTED_REPO}.git"* ]]; then
  echo "[remote:check] Warning: remote URL is not the canonical ${EXPECTED_OWNER}/${EXPECTED_REPO}.git"
fi

set +e
probe_output="$(GIT_SSH_COMMAND='ssh -o ConnectTimeout=8' git ls-remote "$REMOTE_NAME" HEAD 2>&1)"
probe_status=$?
set -e

if [ "$probe_status" -eq 0 ]; then
  echo "[remote:check] OK: remote is reachable and writable identity is configured."
  exit 0
fi

echo "[remote:check] FAILED: unable to access '$REMOTE_NAME'."
printf '%s\n' "$probe_output" | sed -n '1,6p'

cat <<'GUIDE'

Permanent fix (one-time, recommended):
1) Create public repository:
   https://github.com/new
   name: bis-continual-process-automation-demo
2) Create an account-level SSH key (not a deploy key):
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_kumar_account -C "kumar-navish-account"
3) Add the public key in GitHub:
   Settings -> SSH and GPG keys -> New SSH key
4) Add this SSH host alias to ~/.ssh/config:
   Host github-kumar-account
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_kumar_account
     IdentitiesOnly yes
5) Point origin to canonical repo via that alias:
   git remote set-url origin git@github-kumar-account:KumarNavish/bis-continual-process-automation-demo.git
6) Re-run check:
   npm run remote:check

Until that is done, use:
  npm run push:safe
This mirrors source to a public fallback branch so work is never blocked.
GUIDE

exit 1
