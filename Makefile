PYTHON ?= python3
NPM ?= npm

.PHONY: site-install site-dev site-build site-test site-lint pipe-install pipe-test pipe-run check

site-install:
	cd site && $(NPM) install

site-dev: site-install
	cd site && $(NPM) run dev

site-build: site-install
	cd site && $(NPM) run build

site-test: site-install
	cd site && $(NPM) run test

site-lint: site-install
	cd site && $(NPM) run lint

pipe-install:
	$(PYTHON) -m pip install pytest

pipe-test: pipe-install
	cd pipeline && PYTHONPATH=src $(PYTHON) -m pytest

pipe-run: pipe-install
	PYTHONPATH=pipeline/src $(PYTHON) -m pipeline.run --out site/public

check: pipe-test site-lint site-test site-build
