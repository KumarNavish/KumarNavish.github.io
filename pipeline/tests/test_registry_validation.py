"""Tests for registry YAML validation."""

from __future__ import annotations

from pathlib import Path
import shutil

import pytest
from pydantic import ValidationError
import yaml

from pipeline.registry import load_registry

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_DIR = REPO_ROOT / "registry"


def _copy_registry_fixture(tmp_path: Path) -> None:
    """Copy baseline registry files into a temporary test directory."""
    for filename in ("config.yaml", "projects.yaml", "experience.yaml", "programs.yaml"):
        shutil.copy2(REGISTRY_DIR / filename, tmp_path / filename)


def test_registry_loads_all_yaml_files() -> None:
    """All required registry YAML files should load into typed models."""
    bundle = load_registry(REGISTRY_DIR)

    assert bundle.config.github_username == "KumarNavish"
    assert "KumarNavish.github.io" in bundle.projects.projects
    assert len(bundle.experience.roles) >= 1
    assert "mathematical-structure" in bundle.programs.programs


def test_projects_registry_enforces_required_fields(tmp_path: Path) -> None:
    """Missing required project fields should raise validation errors."""
    _copy_registry_fixture(tmp_path)

    projects_path = tmp_path / "projects.yaml"
    payload = yaml.safe_load(projects_path.read_text(encoding="utf-8"))
    payload["KumarNavish.github.io"].pop("one_line")
    projects_path.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")

    with pytest.raises(ValidationError):
        load_registry(tmp_path)


def test_config_registry_enforces_required_fields(tmp_path: Path) -> None:
    """Missing required config fields should raise validation errors."""
    _copy_registry_fixture(tmp_path)

    config_path = tmp_path / "config.yaml"
    payload = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    payload.pop("github_username")
    config_path.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")

    with pytest.raises(ValidationError):
        load_registry(tmp_path)

