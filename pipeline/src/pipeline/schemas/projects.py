"""Schema for registry/projects.yaml."""

from __future__ import annotations

import re
from typing import Dict, List, Optional

from pydantic import HttpUrl, field_validator

from pipeline.schemas.base import StrictModel

_REPO_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+$")


class ProjectEntry(StrictModel):
    """Curated metadata override for a GitHub repository."""

    featured: bool
    tags: List[str]
    demo_url: Optional[HttpUrl] = None
    paper_url: Optional[HttpUrl] = None
    image: Optional[str] = None
    one_line: str

    @field_validator("one_line")
    @classmethod
    def validate_one_line(cls, value: str) -> str:
        """Require concise but meaningful project summary text."""
        if not value.strip():
            raise ValueError("one_line cannot be empty")
        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: List[str]) -> List[str]:
        """Require at least one non-empty tag."""
        if not value:
            raise ValueError("tags must contain at least one entry")
        if any(not tag.strip() for tag in value):
            raise ValueError("tags cannot contain blank values")
        return value

    @field_validator("image")
    @classmethod
    def validate_image(cls, value: Optional[str]) -> Optional[str]:
        """Disallow whitespace-only image paths."""
        if value is None:
            return value
        if not value.strip():
            raise ValueError("image must be null or a non-empty path")
        return value


class ProjectsRegistry(StrictModel):
    """Registry wrapper for project metadata keyed by repository name."""

    projects: Dict[str, ProjectEntry]

    @field_validator("projects")
    @classmethod
    def validate_project_keys(cls, value: Dict[str, ProjectEntry]) -> Dict[str, ProjectEntry]:
        """Enforce repository naming constraints and non-empty map."""
        if not value:
            raise ValueError("projects must contain at least one entry")
        for repo_name in value:
            if _REPO_NAME_PATTERN.fullmatch(repo_name) is None:
                raise ValueError(
                    f"invalid repository key '{repo_name}'; allowed characters: letters, "
                    "numbers, underscore, dot, hyphen"
                )
        return value

