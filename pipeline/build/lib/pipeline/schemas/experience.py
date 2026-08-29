"""Schema for registry/experience.yaml."""

from __future__ import annotations

import re
from typing import List, Optional

from pydantic import field_validator

from pipeline.schemas.base import StrictModel

_DATE_PATTERN = re.compile(r"^\d{4}(-\d{2})?$")


class ExperienceRole(StrictModel):
    """Structured work/research role used in profile outputs."""

    title: str
    org: str
    location: Optional[str] = None
    start: str
    end: Optional[str] = None
    bullet_points: List[str]

    @field_validator("title", "org")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        """Require non-empty role identity fields."""
        if not value.strip():
            raise ValueError("value cannot be empty")
        return value

    @field_validator("location")
    @classmethod
    def validate_optional_location(cls, value: Optional[str]) -> Optional[str]:
        """Disallow whitespace-only optional location values."""
        if value is None:
            return value
        if not value.strip():
            raise ValueError("location must be null or a non-empty value")
        return value

    @field_validator("start", "end")
    @classmethod
    def validate_dates(cls, value: Optional[str]) -> Optional[str]:
        """Allow YYYY, YYYY-MM, or present for open-ended ranges."""
        if value is None:
            return value
        normalized = value.strip().lower()
        if normalized == "present":
            return "present"
        if _DATE_PATTERN.fullmatch(value) is None:
            raise ValueError("date values must be YYYY, YYYY-MM, or present")
        return value

    @field_validator("bullet_points")
    @classmethod
    def validate_bullets(cls, value: List[str]) -> List[str]:
        """Require at least one concise bullet point per role."""
        if not value:
            raise ValueError("bullet_points must contain at least one entry")
        if any(not bullet.strip() for bullet in value):
            raise ValueError("bullet_points cannot contain blank entries")
        return value


class ExperienceRegistry(StrictModel):
    """Registry wrapper for structured experience roles."""

    roles: List[ExperienceRole]

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, value: List[ExperienceRole]) -> List[ExperienceRole]:
        """Require at least one role entry."""
        if not value:
            raise ValueError("roles must contain at least one entry")
        return value

