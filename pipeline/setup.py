"""Setuptools fallback config for older pip/setuptools environments."""

from setuptools import find_packages, setup


setup(
    name="portfolio-pipeline",
    version="0.1.0",
    description="Data pipeline for portfolio-as-a-system",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    python_requires=">=3.9",
    install_requires=[
        "pydantic>=2.8,<3.0",
        "PyYAML>=6.0,<7.0",
    ],
    extras_require={
        "dev": ["pytest>=8.0.0"],
    },
)

