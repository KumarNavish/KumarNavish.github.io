PYTHON ?= python3
NPM ?= npm

.PHONY: site-install site-dev site-build demo-build site-test site-lint site-typecheck pipe-install pipe-test pipe-validate-registry pipe-run check

site-install:
	cd site && $(NPM) install

site-dev: site-install
	cd site && $(NPM) run dev

site-build: site-install
	cd site && $(NPM) run build

demo-build: site-install
	cd site && $(NPM) run bis-demo:build
	cd site && $(NPM) run safepatch:build

site-test: site-install
	cd site && $(NPM) run test

site-lint: site-install
	cd site && $(NPM) run lint

site-typecheck: site-install
	cd site && $(NPM) run typecheck

pipe-install:
	cd pipeline && $(PYTHON) -m pip install ".[dev]"

pipe-validate-registry: pipe-install
	cd pipeline && PYTHONPATH=src $(PYTHON) -m pipeline.validate_registry --registry-dir ../registry

pipe-test: pipe-install
	cd pipeline && PYTHONPATH=src $(PYTHON) -m pytest

pipe-run: pipe-install
	PYTHONPATH=pipeline/src $(PYTHON) -m pipeline.run --out site/public

check: pipe-validate-registry pipe-test site-lint site-typecheck site-test site-build
