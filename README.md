# Continual Process Automation Copilot

Fully static, client-side demo that combines retrieval, continual learning, and optional in-browser LLM planning.

Target live URL:
`https://kumarnavish.github.io/bis-continual-process-automation-demo/`

## What This Demo Proves

- Continual learning for intent routing in a workflow automation setting (naive SGD vs rehearsal vs EWC).
- Memory strategy tradeoffs for replay and retrieval (FIFO, reservoir, k-center, risk-aware).
- End-to-end request handling to strict structured action plans (`TargetPlan` JSON).
- Browser-only execution model, deployable on GitHub Pages without backend services.

## Run Locally

1. Install dependencies:
   `npm ci`
2. Start development server:
   `npm run dev`
3. Optional checks:
   `npm run test`
   `npm run lint`
   `npm run build`
4. Full gate:
   `npm run check`

## Deploy

This repository is pre-configured for GitHub Pages project-site deployment with:

- Vite base path set to:
  `/bis-continual-process-automation-demo/`
- GitHub Actions workflow:
  `.github/workflows/deploy.yml`
- Pages artifact upload path:
  `./dist`

Exact GitHub setup:

1. Push this code to repo `bis-continual-process-automation-demo` under your GitHub account.
2. Open repository **Settings**.
3. Open **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Push to branch `master` (or run the **Deploy to GitHub Pages** workflow manually in Actions).
6. Wait for workflow success, then open:
   `https://kumarnavish.github.io/bis-continual-process-automation-demo/`

## WebGPU And LLM Fallback

- Optional WebLLM mode requires WebGPU support in the browser (`navigator.gpu`).
- If WebGPU is unavailable, the app still runs fully using deterministic template planning mode.
- Retrieval, continual-learning updates, memory inspection, and evaluation dashboards remain available without WebGPU.

## Data Disclaimer

- All datasets in this project are synthetic.
- No production, personal, or confidential data is required or included.
