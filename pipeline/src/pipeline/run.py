"""Step-2 placeholder runner that emits minimal public data artifacts."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    """Write JSON to disk with deterministic formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def run(out_dir: Path) -> None:
    """Emit minimal placeholder API and ops artifacts for the static site."""
    timestamp = datetime.now(timezone.utc).isoformat()

    api_payload = {
        "status": "ok",
        "generated_at": timestamp,
        "message": "placeholder step-2 pipeline output",
    }

    ops_payload = {
        "status": "success",
        "run": {
            "generated_at": timestamp,
            "pipeline": "placeholder",
        },
    }

    _write_json(out_dir / "api" / "v1" / "status.json", api_payload)
    _write_json(out_dir / "ops" / "latest-run.json", ops_payload)


def parse_args() -> argparse.Namespace:
    """Parse CLI options."""
    parser = argparse.ArgumentParser(description="Run placeholder portfolio pipeline")
    parser.add_argument(
        "--out",
        default="site/public",
        help="Output directory root for generated artifacts (default: site/public)",
    )
    return parser.parse_args()


def main() -> int:
    """CLI entrypoint."""
    args = parse_args()
    run(Path(args.out))
    print(f"pipeline placeholder runner -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
