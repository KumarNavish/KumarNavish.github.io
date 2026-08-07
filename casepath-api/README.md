# CasePath demo API

FastAPI service for the focused v10 claim-handling demonstration.

## Start

```bash
pip install -r requirements.txt
uvicorn casepath_api.app:app --host 0.0.0.0 --port 8000
```

## Core routes

- `GET /healthz`
- `GET /readyz`
- `GET /api/demo`
- `GET /api/claims`
- `GET /api/claims/{claim_id}`
- `GET /api/artifacts/{artifact_id}`
- `GET /api/artifacts/{artifact_id}/pages/{page_number}`
- `POST /api/runs`
- `GET /api/runs/{run_id}`
- `POST /api/runs/{run_id}/review`
- `GET /api/learning-proof`

State uses SQLite for the public demonstration. It is not an enterprise-durable shared store.

## Generate fictional source artifacts

```bash
python generate_artifacts.py
```

The generator creates the source PDFs, RFC822 email files, source photographs and page PNGs used by the PDF viewer. The generated files are not required to be committed to Git.
