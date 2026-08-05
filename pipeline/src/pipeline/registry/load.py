"""Load and validate registry YAML files."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import yaml

from pipeline.schemas import (
    ExperienceRegistry,
    ProgramsRegistry,
    ProjectsRegistry,
    RegistryBundle,
    RegistryConfig,
)

REGISTRY_FILES: Dict[str, str] = {
    "config": "config.yaml",
    "projects": "projects.yaml",
    "experience": "experience.yaml",
    "programs": "programs.yaml",
}


def _read_yaml(path: Path) -> Any:
    """Read and parse a YAML file as Python objects."""
    if not path.exists():
        raise FileNotFoundError(f"required registry file missing: {path}")
    parsed = yaml.safe_load(path.read_text(encoding="utf-8"))
    return parsed if parsed is not None else {}


def load_registry(registry_dir: Path) -> RegistryBundle:
    """Load all registry YAML files and validate them with strict schemas."""
    base_path = registry_dir.resolve()

    raw_config = _read_yaml(base_path / REGISTRY_FILES["config"])
    raw_projects = _read_yaml(base_path / REGISTRY_FILES["projects"])
    raw_experience = _read_yaml(base_path / REGISTRY_FILES["experience"])
    raw_programs = _read_yaml(base_path / REGISTRY_FILES["programs"])

    config = RegistryConfig.model_validate(raw_config)
    projects = ProjectsRegistry.model_validate({"projects": raw_projects})
    experience = ExperienceRegistry.model_validate(raw_experience)
    programs = ProgramsRegistry.model_validate({"programs": raw_programs})

    return RegistryBundle(
        config=config,
        projects=projects,
        experience=experience,
        programs=programs,
    )

