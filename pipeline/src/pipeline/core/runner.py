"""Task graph runner for the portfolio pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from time import perf_counter
from typing import Dict, Iterable, List, Sequence

from pipeline.core.task import PipelineRun, Task, TaskContext, TaskExecution


@dataclass(frozen=True)
class TaskGraph:
    """Validated task graph with deterministic topological ordering."""

    tasks: tuple[Task, ...]

    def __post_init__(self) -> None:
        """Validate graph invariants once at construction time."""
        names = [task.name for task in self.tasks]
        if len(names) != len(set(names)):
            raise ValueError("task names must be unique")

        known = set(names)
        for task in self.tasks:
            for dep in task.deps:
                if dep not in known:
                    raise ValueError(f"task '{task.name}' references unknown dependency '{dep}'")

    def topological_order(self) -> List[str]:
        """Return a deterministic dependency-respecting task order."""
        indegree: Dict[str, int] = {task.name: 0 for task in self.tasks}
        children: Dict[str, List[str]] = {task.name: [] for task in self.tasks}

        for task in self.tasks:
            for dep in task.deps:
                indegree[task.name] += 1
                children[dep].append(task.name)

        ready: List[str] = [task.name for task in self.tasks if indegree[task.name] == 0]
        order: List[str] = []

        while ready:
            current = ready.pop(0)
            order.append(current)
            for child in children[current]:
                indegree[child] -= 1
                if indegree[child] == 0:
                    ready.append(child)

        if len(order) != len(self.tasks):
            raise ValueError("task graph contains a cycle")

        return order


class TaskRunner:
    """Execute tasks from a validated dependency graph."""

    def __init__(self, tasks: Sequence[Task]) -> None:
        self._graph = TaskGraph(tuple(tasks))
        self._task_map = {task.name: task for task in self._graph.tasks}

    def topological_order(self) -> List[str]:
        """Expose deterministic DAG order for testing/reporting."""
        return self._graph.topological_order()

    def run(self, context: TaskContext) -> PipelineRun:
        """Execute tasks and return structured run metadata."""
        run_start = datetime.now(timezone.utc)
        order = self._graph.topological_order()
        results: Dict[str, TaskExecution] = {}
        failed = False

        for index, task_name in enumerate(order):
            task = self._task_map[task_name]
            context.consume_logs()

            if failed:
                context.warn("skipped because a previous task failed")
                skipped_at = datetime.now(timezone.utc)
                results[task_name] = TaskExecution(
                    name=task.name,
                    status="skipped",
                    inputs=task.inputs,
                    outputs=task.outputs,
                    deps=task.deps,
                    started_at=skipped_at,
                    finished_at=skipped_at,
                    duration_seconds=0.0,
                    logs=context.consume_logs(),
                    error="skipped because a previous task failed",
                )
                continue

            # If a dependency is not successful, mark this task as skipped.
            if any(results[dep].status != "success" for dep in task.deps):
                context.warn("skipped because a dependency did not complete successfully")
                skipped_at = datetime.now(timezone.utc)
                results[task_name] = TaskExecution(
                    name=task.name,
                    status="skipped",
                    inputs=task.inputs,
                    outputs=task.outputs,
                    deps=task.deps,
                    started_at=skipped_at,
                    finished_at=skipped_at,
                    duration_seconds=0.0,
                    logs=context.consume_logs(),
                    error="skipped because a dependency did not complete successfully",
                )
                continue

            task_start = datetime.now(timezone.utc)
            timer_start = perf_counter()
            try:
                task.action(context)
            except Exception as exc:  # pragma: no cover - covered via integration-style tests
                context.error(f"{type(exc).__name__}: {exc}")
                task_end = datetime.now(timezone.utc)
                results[task_name] = TaskExecution(
                    name=task.name,
                    status="failed",
                    inputs=task.inputs,
                    outputs=task.outputs,
                    deps=task.deps,
                    started_at=task_start,
                    finished_at=task_end,
                    duration_seconds=round(perf_counter() - timer_start, 6),
                    logs=context.consume_logs(),
                    error=f"{type(exc).__name__}: {exc}",
                )
                failed = True

                # Explicitly mark remaining tasks as skipped.
                for pending in order[index + 1 :]:
                    pending_task = self._task_map[pending]
                    context.warn("skipped because a previous task failed")
                    skipped_at = datetime.now(timezone.utc)
                    results[pending] = TaskExecution(
                        name=pending_task.name,
                        status="skipped",
                        inputs=pending_task.inputs,
                        outputs=pending_task.outputs,
                        deps=pending_task.deps,
                        started_at=skipped_at,
                        finished_at=skipped_at,
                        duration_seconds=0.0,
                        logs=context.consume_logs(),
                        error="skipped because a previous task failed",
                    )
                break

            task_end = datetime.now(timezone.utc)
            results[task_name] = TaskExecution(
                name=task.name,
                status="success",
                inputs=task.inputs,
                outputs=task.outputs,
                deps=task.deps,
                started_at=task_start,
                finished_at=task_end,
                duration_seconds=round(perf_counter() - timer_start, 6),
                logs=context.consume_logs(),
            )

        ordered_results = tuple(results[name] for name in order)
        run_end = datetime.now(timezone.utc)
        run_status = "failed" if any(item.status == "failed" for item in ordered_results) else "success"
        return PipelineRun(
            status=run_status,
            started_at=run_start,
            finished_at=run_end,
            task_executions=ordered_results,
        )
