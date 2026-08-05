"""Tests for resume artifact emitter."""

from __future__ import annotations

from pathlib import Path

from pipeline.emit.resume import emit_resume_pdf


def test_emit_resume_pdf_writes_fallback_pdf_when_typst_missing(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """Emitter should generate valid PDF output without Typst installed."""
    monkeypatch.setattr("pipeline.emit.resume.shutil.which", lambda _: None)

    template_path = tmp_path / "resume_template.typ"
    template_path.write_text(
        """
{{DISPLAY_NAME}}
{{SITE_TITLE}}
{{SUMMARY_LINE}}
{{EXPERIENCE_BLOCK}}
{{PROGRAMS_BLOCK}}
{{FEATURED_WORKS_BLOCK}}
        """.strip()
        + "\n",
        encoding="utf-8",
    )
    output_path = tmp_path / "public" / "artifacts" / "resume.pdf"
    result = emit_resume_pdf(
        template_path=template_path,
        output_path=output_path,
        config={
            "github_username": "KumarNavish",
            "semantic_scholar_author_id": "",
            "site_title": "Navish Kumar | Research Systems",
            "timezone": "Europe/Zurich",
            "refresh_policy": "weekly",
        },
        experience_roles=[
            {
                "title": "PhD Student",
                "org": "University of Basel",
                "location": "Basel, Switzerland",
                "start": "2022-09",
                "end": "present",
                "bullet_points": [
                    "Researches continual learning and optimization.",
                    "Builds robust evaluation pipelines.",
                ],
            }
        ],
        programs={
            "mathematical-structure": {
                "name": "Mathematical Structure for Reliable Learning",
                "description": "Uses spectral and geometric structure.",
                "related_works_tags": ["optimization"],
            }
        },
        projects_payload={
            "items": [
                {
                    "name": "KumarNavish.github.io",
                    "featured": True,
                    "one_line": "Capability-first portfolio system.",
                    "stars": 1,
                }
            ]
        },
        publications_payload={
            "items": [
                {
                    "id": "paper-1",
                    "title": "Optimization Guarantees",
                    "year": 2025,
                    "venue": "arXiv",
                    "citation_count": 1,
                }
            ]
        },
        metrics_payload={
            "works_count": 1,
            "citations_total": 1,
        },
        generated_at="2026-02-14T00:00:00+00:00",
    )

    assert result.method == "python-fallback"
    assert result.warning is not None
    assert output_path.exists()

    payload = output_path.read_bytes()
    assert payload.startswith(b"%PDF-1.4")
    assert b"/Type /Catalog" in payload
