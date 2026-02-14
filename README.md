# Portfolio-as-a-System

This repository is being transformed into a capability-first portfolio system:

- `registry/`: curated structured inputs
- `pipeline/`: typed Python ingestion/normalization/metrics pipeline
- `site/`: React + TypeScript frontend that renders generated JSON APIs

Core local commands:

```bash
make check      # pipeline tests + site lint/test/build
make pipe-run   # run pipeline entrypoint
make site-dev   # run frontend locally
```

Deployment target: GitHub Pages via Actions with generated static artifacts.

GitHub Pages setup:

1. Open repository `Settings`.
2. Open `Pages`.
3. Set `Source` to `GitHub Actions`.
