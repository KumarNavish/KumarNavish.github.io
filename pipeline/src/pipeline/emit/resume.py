"""Generate resume artifacts from structured registry and API payloads."""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

_TOKEN_PATTERN = re.compile(r"\{\{([A-Z0-9_]+)\}\}")


@dataclass(frozen=True)
class ResumeEmitResult:
    """Metadata returned by resume emission workflow."""

    output_path: Path
    method: str
    warning: str | None = None


def _as_items(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """Extract list items from payload and normalize shape."""
    raw_items = payload.get("items")
    if not isinstance(raw_items, list):
        return []
    return [item for item in raw_items if isinstance(item, Mapping)]


def _derive_display_name(site_title: str, github_username: str) -> str:
    """Infer readable name from site title or fallback to username."""
    title = site_title.strip()
    if "|" in title:
        candidate = title.split("|", 1)[0].strip()
        if candidate:
            return candidate
    return title or github_username


def _format_period(start: str, end: str | None) -> str:
    """Render concise date range for resume sections."""
    normalized_end = (end or "").strip()
    if not normalized_end:
        return start
    return f"{start} - {normalized_end}"


def _escape_typ_text(value: str) -> str:
    """Escape minimal Typst punctuation in dynamic values."""
    return (
        value.replace("\\", "\\\\")
        .replace("#", "\\#")
        .replace("*", "\\*")
        .replace("_", "\\_")
        .replace("[", "\\[")
        .replace("]", "\\]")
    )


def _render_template(template: str, replacements: Mapping[str, str]) -> str:
    """Replace `{{TOKEN}}` placeholders with rendered values."""

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return replacements.get(key, "")

    return _TOKEN_PATTERN.sub(_replace, template)


def _build_experience_block(experience_roles: Sequence[Mapping[str, Any]]) -> str:
    """Build Typst bullet list for experience section."""
    lines: list[str] = []
    for role in experience_roles:
        title = str(role.get("title", "")).strip()
        org = str(role.get("org", "")).strip()
        start = str(role.get("start", "")).strip()
        end_value = role.get("end")
        end = str(end_value).strip() if isinstance(end_value, str) else None
        location_value = role.get("location")
        location = str(location_value).strip() if isinstance(location_value, str) else ""
        period = _format_period(start=start, end=end)
        header = f"- *{_escape_typ_text(title)}, {_escape_typ_text(org)}* ({_escape_typ_text(period)})"
        if location:
            header = f"{header} - {_escape_typ_text(location)}"
        lines.append(header)

        bullets = role.get("bullet_points")
        if isinstance(bullets, list):
            for bullet in bullets[:3]:
                if not isinstance(bullet, str):
                    continue
                lines.append(f"  - {_escape_typ_text(bullet.strip())}")

    return "\n".join(lines)


def _build_programs_block(programs: Mapping[str, Mapping[str, Any]]) -> str:
    """Build Typst bullet list for program map section."""
    lines: list[str] = []
    for program_id in sorted(programs):
        program = programs[program_id]
        name = str(program.get("name", "")).strip()
        description = str(program.get("description", "")).strip()
        if not name:
            continue
        lines.append(
            f"- *{_escape_typ_text(name)}* ({_escape_typ_text(program_id)}): "
            f"{_escape_typ_text(description)}"
        )
    return "\n".join(lines)


def _build_featured_block(
    projects_payload: Mapping[str, Any],
    publications_payload: Mapping[str, Any],
) -> str:
    """Build concise list of featured projects and most-cited publications."""
    project_items = _as_items(projects_payload)
    publication_items = _as_items(publications_payload)
    lines: list[str] = []

    featured_projects = [
        project for project in project_items if bool(project.get("featured"))
    ]
    featured_projects_sorted = sorted(
        featured_projects,
        key=lambda project: (
            -int(project.get("stars", 0)) if isinstance(project.get("stars"), int) else 0,
            str(project.get("name", "")).lower(),
        ),
    )
    for project in featured_projects_sorted[:3]:
        name = str(project.get("name", "")).strip()
        one_line = str(project.get("one_line", "")).strip()
        if not name:
            continue
        summary = one_line or str(project.get("description", "")).strip()
        lines.append(f"- Project: *{_escape_typ_text(name)}* - {_escape_typ_text(summary)}")

    ranked_publications = sorted(
        publication_items,
        key=lambda publication: (
            -int(publication.get("citation_count", 0))
            if isinstance(publication.get("citation_count"), int)
            else 0,
            -int(publication.get("year", 0)) if isinstance(publication.get("year"), int) else 0,
            str(publication.get("title", "")).lower(),
        ),
    )
    for publication in ranked_publications[:3]:
        title = str(publication.get("title", "")).strip()
        if not title:
            continue
        venue = str(publication.get("venue", "")).strip()
        year = publication.get("year")
        year_text = str(year) if isinstance(year, int) else ""
        citation_count = publication.get("citation_count")
        citation_text = (
            str(citation_count) if isinstance(citation_count, int) else "n/a"
        )
        descriptor = ", ".join(part for part in [venue, year_text] if part)
        descriptor_suffix = f" ({descriptor})" if descriptor else ""
        lines.append(
            f"- Publication: *{_escape_typ_text(title)}*{_escape_typ_text(descriptor_suffix)}"
            f" - citations: {citation_text}"
        )

    return "\n".join(lines)


def _build_template_values(
    *,
    config: Mapping[str, Any],
    experience_roles: Sequence[Mapping[str, Any]],
    programs: Mapping[str, Mapping[str, Any]],
    projects_payload: Mapping[str, Any],
    publications_payload: Mapping[str, Any],
    metrics_payload: Mapping[str, Any],
    generated_at: str,
) -> dict[str, str]:
    """Compute token values for resume template rendering."""
    site_title = str(config.get("site_title", "")).strip()
    github_username = str(config.get("github_username", "")).strip()
    semantic_author_id = str(config.get("semantic_scholar_author_id", "")).strip()
    timezone = str(config.get("timezone", "")).strip()
    refresh_policy = str(config.get("refresh_policy", "")).strip()
    display_name = _derive_display_name(site_title=site_title, github_username=github_username)

    projects_count = len(_as_items(projects_payload))
    publications_count = len(_as_items(publications_payload))
    works_count_value = metrics_payload.get("works_count")
    works_count = works_count_value if isinstance(works_count_value, int) else publications_count
    citations_total_value = metrics_payload.get("citations_total")
    citations_total = (
        str(citations_total_value)
        if isinstance(citations_total_value, int)
        else "n/a"
    )

    summary_line = (
        f"{projects_count} projects, {works_count} publications, {citations_total} citations. "
        f"Focus: principled optimization, continual learning systems, and deployable research tooling."
    )
    scholar_url = (
        f"https://www.semanticscholar.org/author/{semantic_author_id}"
        if semantic_author_id
        else "not configured"
    )

    return {
        "DISPLAY_NAME": _escape_typ_text(display_name),
        "SITE_TITLE": _escape_typ_text(site_title),
        "GITHUB_URL": _escape_typ_text(f"https://github.com/{github_username}"),
        "SCHOLAR_URL": _escape_typ_text(scholar_url),
        "GENERATED_AT": _escape_typ_text(generated_at),
        "TIMEZONE": _escape_typ_text(timezone),
        "REFRESH_POLICY": _escape_typ_text(refresh_policy),
        "SUMMARY_LINE": _escape_typ_text(summary_line),
        "EXPERIENCE_BLOCK": _build_experience_block(experience_roles),
        "PROGRAMS_BLOCK": _build_programs_block(programs),
        "FEATURED_WORKS_BLOCK": _build_featured_block(
            projects_payload=projects_payload,
            publications_payload=publications_payload,
        ),
    }


def _escape_pdf_text(value: str) -> str:
    """Escape text content for PDF content streams."""
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_fallback_lines(
    *,
    config: Mapping[str, Any],
    experience_roles: Sequence[Mapping[str, Any]],
    programs: Mapping[str, Mapping[str, Any]],
    projects_payload: Mapping[str, Any],
    publications_payload: Mapping[str, Any],
    metrics_payload: Mapping[str, Any],
    generated_at: str,
) -> list[str]:
    """Build readable single-page fallback resume lines."""
    site_title = str(config.get("site_title", "")).strip()
    github_username = str(config.get("github_username", "")).strip()
    display_name = _derive_display_name(site_title=site_title, github_username=github_username)

    projects_count = len(_as_items(projects_payload))
    publications_count = len(_as_items(publications_payload))
    citations_total = metrics_payload.get("citations_total")
    citations_text = str(citations_total) if isinstance(citations_total, int) else "n/a"

    lines = [
        display_name,
        site_title,
        f"GitHub: https://github.com/{github_username}",
        f"Generated: {generated_at}",
        "",
        f"Snapshot: {projects_count} projects | {publications_count} publications | {citations_text} citations",
        "",
        "Experience",
    ]

    for role in experience_roles:
        title = str(role.get("title", "")).strip()
        org = str(role.get("org", "")).strip()
        start = str(role.get("start", "")).strip()
        end_value = role.get("end")
        end = str(end_value).strip() if isinstance(end_value, str) else None
        period = _format_period(start=start, end=end)
        lines.append(f"- {title}, {org} ({period})")
        bullets = role.get("bullet_points")
        if isinstance(bullets, list):
            for bullet in bullets[:2]:
                if isinstance(bullet, str):
                    lines.append(f"  - {bullet.strip()}")

    lines.extend(["", "Program Map"])
    for program_id in sorted(programs):
        program = programs[program_id]
        name = str(program.get("name", "")).strip()
        description = str(program.get("description", "")).strip()
        if name:
            lines.append(f"- {name}: {description}")

    lines.extend(["", "Selected Work"])
    featured = _build_featured_block(
        projects_payload=projects_payload,
        publications_payload=publications_payload,
    )
    for item in featured.splitlines():
        if item:
            lines.append(item.replace("*", ""))

    max_lines = 44
    if len(lines) > max_lines:
        trimmed = lines[: max_lines - 1]
        trimmed.append("... see site/public/artifacts for full structured data")
        return trimmed
    return lines


def _write_minimal_pdf(path: Path, lines: Sequence[str]) -> None:
    """Write a minimal single-page PDF without external dependencies."""
    path.parent.mkdir(parents=True, exist_ok=True)
    stream_lines = ["BT", "/F1 10 Tf", "13 TL", "50 760 Td"]
    first = True
    for line in lines:
        if not first:
            stream_lines.append("T*")
        stream_lines.append(f"({_escape_pdf_text(line)}) Tj")
        first = False
    stream_lines.append("ET")
    stream_payload = ("\n".join(stream_lines) + "\n").encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(stream_payload)} >>\nstream\n".encode("ascii")
        + stream_payload
        + b"endstream",
    ]

    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: list[int] = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode("ascii"))
        output.extend(obj)
        output.extend(b"\nendobj\n")

    xref_start = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets:
        output.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n".encode(
            "ascii"
        )
    )
    path.write_bytes(bytes(output))


def emit_resume_pdf(
    *,
    template_path: Path,
    output_path: Path,
    config: Mapping[str, Any],
    experience_roles: Sequence[Mapping[str, Any]],
    programs: Mapping[str, Mapping[str, Any]],
    projects_payload: Mapping[str, Any],
    publications_payload: Mapping[str, Any],
    metrics_payload: Mapping[str, Any],
    generated_at: str | None = None,
) -> ResumeEmitResult:
    """Render resume template to PDF via Typst with deterministic fallback."""
    timestamp = generated_at or datetime.now(timezone.utc).isoformat()
    template_raw = template_path.read_text(encoding="utf-8")
    replacements = _build_template_values(
        config=config,
        experience_roles=experience_roles,
        programs=programs,
        projects_payload=projects_payload,
        publications_payload=publications_payload,
        metrics_payload=metrics_payload,
        generated_at=timestamp,
    )
    rendered_template = _render_template(template_raw, replacements)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    typst_binary = shutil.which("typst")
    typst_warning: str | None = None
    if typst_binary:
        with tempfile.TemporaryDirectory(prefix="resume-typst-") as temp_dir:
            temp_template = Path(temp_dir) / "resume.typ"
            temp_template.write_text(rendered_template, encoding="utf-8")
            result = subprocess.run(
                [typst_binary, "compile", str(temp_template), str(output_path)],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and output_path.exists():
                return ResumeEmitResult(output_path=output_path, method="typst")
            typst_warning = (
                "typst compilation failed; used fallback renderer. "
                f"stderr={result.stderr.strip()[:240]}"
            )
    else:
        typst_warning = "typst executable not found; used fallback renderer."

    fallback_lines = _build_fallback_lines(
        config=config,
        experience_roles=experience_roles,
        programs=programs,
        projects_payload=projects_payload,
        publications_payload=publications_payload,
        metrics_payload=metrics_payload,
        generated_at=timestamp,
    )
    _write_minimal_pdf(output_path, fallback_lines)
    return ResumeEmitResult(
        output_path=output_path,
        method="python-fallback",
        warning=typst_warning,
    )
