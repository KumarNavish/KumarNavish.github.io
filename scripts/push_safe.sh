#!/usr/bin/env bash
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"
fallback_remote="${FALLBACK_REMOTE:-source-public}"
fallback_url="${FALLBACK_URL:-git@github-kumar-pages:KumarNavish/KumarNavish.github.io.git}"
fallback_branch="${FALLBACK_BRANCH:-bis-continual-process-automation-demo-source}"

if bash scripts/remote_preflight.sh origin; then
  echo "[push:safe] Pushing '$branch' to origin"
  git push -u origin "$branch"
  exit 0
fi

echo "[push:safe] Origin unavailable. Using fallback public mirror remote."
if git remote get-url "$fallback_remote" >/dev/null 2>&1; then
  git remote set-url "$fallback_remote" "$fallback_url"
else
  git remote add "$fallback_remote" "$fallback_url"
fi

echo "[push:safe] Pushing HEAD to ${fallback_remote}:${fallback_branch}"
git push "$fallback_remote" "HEAD:refs/heads/${fallback_branch}"

echo "[push:safe] Source mirror URL:"
echo "https://github.com/KumarNavish/KumarNavish.github.io/tree/${fallback_branch}"
