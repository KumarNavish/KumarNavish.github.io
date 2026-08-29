"""Schema for registry/programs.yaml."""

from __future__ import annotations

import re
from typing import Dict, List

from pydantic import field_validator

from pipeline.schemas.base import StrictModel

_PROGRAM_ID_PATTERN = re.compile(r"^[a-z0-9-]+$")


class ProgramDefinition(StrictModel):
    """Program-level narrative entry used to group related work."""

    name: str
    description: str
    related_works_tags: List[str]

    @field_validator("name", "description")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        """Require non-empty program descriptor text."""
        if not value.strip():
            raise ValueError("value cannot be empty")
        return value

    @field_validator("related_works_tags")
    @classmethod
    def validate_related_tags(cls, value: List[str]) -> List[str]:
        """Require non-empty related-work tag lists."""
        if not value:
            raise ValueError("related_works_tags must contain at least one entry")
        if any(not tag.strip() for tag in value):
            raise ValueError("related_works_tags cannot contain blank values")
        return value


class ProgramsRegistry(StrictModel):
    """Registry wrapper for named research programs keyed by program id."""

    programs: Dict[str, ProgramDefinition]

    @field_validator("programs")
    @classmethod
    def validate_program_keys(cls, value: Dict[str, ProgramDefinition]) -> Dict[str, ProgramDefinition]:
        """Require stable kebab-case identifiers for program keys."""
        if not value:
            raise ValueError("programs must contain at least one entry")
        for program_id in value:
            if _PROGRAM_ID_PATTERN.fullmatch(program_id) is None:
                raise ValueError(
                    f"invalid program key '{program_id}'; expected lowercase letters, digits, and hyphens"
                )
        return value

