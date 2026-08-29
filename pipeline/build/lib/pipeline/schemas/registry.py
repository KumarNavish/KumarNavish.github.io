"""Aggregate registry schema."""

from __future__ import annotations

from pipeline.schemas.base import StrictModel
from pipeline.schemas.config import RegistryConfig
from pipeline.schemas.experience import ExperienceRegistry
from pipeline.schemas.programs import ProgramsRegistry
from pipeline.schemas.projects import ProjectsRegistry


class RegistryBundle(StrictModel):
    """Typed aggregate of all validated registry inputs."""

    config: RegistryConfig
    projects: ProjectsRegistry
    experience: ExperienceRegistry
    programs: ProgramsRegistry

