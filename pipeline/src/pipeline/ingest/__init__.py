"""Ingestion layer for external data sources."""

from pipeline.ingest.github import ingest_github_repositories

__all__ = ["ingest_github_repositories"]

