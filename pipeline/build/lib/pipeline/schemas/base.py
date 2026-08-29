"""Base schema definitions shared across registry models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    """Base model with strict typing and no unknown fields."""

    model_config = ConfigDict(extra="forbid", strict=True)

