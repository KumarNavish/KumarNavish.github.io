"""CLI entrypoint for validating registry YAML files."""

from __future__ import annotations

import argparse
from pathlib import Path

from pipeline.registry import load_registry


def parse_args() -> argparse.Namespace:
    """Parse command-line options."""
    parser = argparse.ArgumentParser(description="Validate portfolio registry YAML files")
    parser.add_argument(
        "--registry-dir",
        default="registry",
        help="Path to registry directory (default: registry)",
    )
    return parser.parse_args()


def main() -> int:
    """Validate registry data and print a concise summary."""
    args = parse_args()
    registry_dir = Path(args.registry_dir)
    bundle = load_registry(registry_dir)

    print(f"registry validation succeeded: {registry_dir.resolve()}")
    print(f"- github_username: {bundle.config.github_username}")
    print(f"- projects: {len(bundle.projects.projects)}")
    print(f"- experience roles: {len(bundle.experience.roles)}")
    print(f"- programs: {len(bundle.programs.programs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

