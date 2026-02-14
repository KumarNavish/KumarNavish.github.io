"""Core task models for pipeline execution."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Literal, Mapping

TaskStatus = Literal["success", "failed", "skipped"]


@dataclass(frozen=True)
class TaskContext:
    """Runtime context passed to each task action."""

    out_dir: Path
    env: Mapping[str, str]


TaskAction = Callable[[TaskContext], None]


@dataclass(frozen=True)
class Task:
    """Declarative task definition with explicit inputs, outputs, and dependencies."""

    name: str
    action: TaskAction
    inputs: tuple[str, ...] = field(default_factory=tuple)
    outputs: tuple[str, ...] = field(default_factory=tuple)
    deps: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        """Normalize sequence-like fields and validate task identity."""
        if not self.name.strip():
            raise ValueError("task name cannot be empty")
        object.__setattr__(self, "inputs", tuple(self.inputs))
        object.__setattr__(self, "outputs", tuple(self.outputs))
        object.__setattr__(self, "deps", tuple(self.deps))


@dataclass(frozen=True)
class TaskExecution:
    """Execution metadata for a single task run."""

    name: str
    status: TaskStatus
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    deps: tuple[str, ...]
    started_at: datetime
    finished_at: datetime
    duration_seconds: float
    error: str | None = None


@dataclass(frozen=True)
class PipelineRun:
    """Execution metadata for a full pipeline run."""

    status: Literal["success", "failed"]
    started_at: datetime
    finished_at: datetime
    task_executions: tuple[TaskExecution, ...]

    @property
    def duration_seconds(self) -> float:
        """Compute wall-clock duration for the full pipeline run."""
        return (self.finished_at - self.started_at).total_seconds()

