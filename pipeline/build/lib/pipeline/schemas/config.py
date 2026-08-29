"""Schema for registry/config.yaml."""

from __future__ import annotations

import re

from pydantic import field_validator

from pipeline.schemas.base import StrictModel

_GITHUB_USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9-]+$")


class RegistryConfig(StrictModel):
    """Top-level runtime configuration for the portfolio system."""

    github_username: str
    semantic_scholar_author_id: str = ""
    site_title: str
    timezone: str
    refresh_policy: str

    @field_validator("github_username")
    @classmethod
    def validate_github_username(cls, value: str) -> str:
        """Enforce canonical GitHub username format."""
        if not value.strip():
            raise ValueError("github_username cannot be empty")
        if _GITHUB_USERNAME_PATTERN.fullmatch(value) is None:
            raise ValueError("github_username must contain only letters, numbers, or hyphens")
        return value

    @field_validator("site_title", "timezone", "refresh_policy")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        """Require non-empty config values for key runtime settings."""
        if not value.strip():
            raise ValueError("value cannot be empty")
        return value

    @field_validator("semantic_scholar_author_id")
    @classmethod
    def validate_semantic_author_id(cls, value: str) -> str:
        """Allow blank value but disallow whitespace-only content."""
        if value and not value.strip():
            raise ValueError("semantic_scholar_author_id must be blank or a non-empty identifier")
        return value

