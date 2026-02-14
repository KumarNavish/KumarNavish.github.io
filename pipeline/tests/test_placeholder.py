"""Placeholder tests for pipeline scaffold."""

from pipeline import __version__


def test_version_is_defined() -> None:
    """Package exposes a version string."""
    assert isinstance(__version__, str)
    assert __version__
