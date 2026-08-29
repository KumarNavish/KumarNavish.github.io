"""Ingestion layer for external data sources."""

from pipeline.ingest.github import ingest_github_repositories
from pipeline.ingest.semantic_scholar import ingest_semantic_scholar_publications

__all__ = [
    "ingest_github_repositories",
    "ingest_semantic_scholar_publications",
]
