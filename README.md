# Continual Process Automation Copilot

Fully static, client-side demo that combines retrieval, continual learning, and optional in-browser LLM planning.

Target live URL:
`https://kumarnavish.github.io/bis-continual-process-automation-demo/`

## BIS-Focused Demo Objective

This v2 pass is framed around internal operations workflows that BIS teams run daily:

- access entitlement changes
- third-party due diligence intake
- policy-compliant procurement requests
- critical operations incident escalations

The goal is immediate operational relevance: convert unstructured requests into governed, audit-ready JSON plans
that can be handed off to internal workflow systems.

## Four BIS Workflow Journeys

Each workflow is modeled as a concrete business transformation:

1. **Access Entitlement Change**
   - Input: free-text access request from a division manager.
   - Transformation: extract subject/system/access level/justification, enforce approvals.
   - Output handoff: IAM-ready payload for ServiceNow + SailPoint/Okta flow.
2. **Third-Party Due Diligence Intake**
   - Input: new vendor onboarding email with incomplete context.
   - Transformation: capture mandatory vendor risk attributes, apply compliance checks.
   - Output handoff: risk/compliance intake payload for Archer + ServiceNow GRC.
3. **Policy-Compliant Procurement Request**
   - Input: spend request from operations/research staff.
   - Transformation: normalize spend metadata, validate budget/procurement policy fields.
   - Output handoff: approval-ready request payload for SAP/Coupa workflows.
4. **Critical Operations Incident Escalation**
   - Input: incident escalation message during internal platform degradation.
   - Transformation: enforce severity/ownership fields and escalation controls.
   - Output handoff: response plan payload for ServiceNow Incident + PagerDuty/Opsgenie.

The novice UI shows this as:
- the exact incoming request text,
- policy checks that are applied,
- field-level mapping from generated JSON to destination systems.

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

## Repository Reliability (Long-Term Fix)

If you ever see `Repository not found` during `git push`, run:

- `npm run remote:check`

This repo now includes a hardened push path:

- `npm run push:safe`

Behavior:

- If canonical `origin` works, it pushes normally.
- If `origin` is unavailable, it automatically mirrors source to:
  `https://github.com/KumarNavish/KumarNavish.github.io/tree/bis-continual-process-automation-demo-source`

Permanent one-time setup (recommended so canonical origin always works):

1. Create public repo `KumarNavish/bis-continual-process-automation-demo`.
2. Create an account-level SSH key (not deploy-key-only):
   `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_kumar_account -C "kumar-navish-account"`
3. Add key in GitHub: **Settings -> SSH and GPG keys -> New SSH key**.
4. Add SSH alias to `~/.ssh/config`:
   ```text
   Host github-kumar-account
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_kumar_account
     IdentitiesOnly yes
   ```
5. Point origin to canonical repo:
   `git remote set-url origin git@github-kumar-account:KumarNavish/bis-continual-process-automation-demo.git`
6. Verify:
   `npm run remote:check`

## WebGPU And LLM Fallback

- Optional WebLLM mode requires WebGPU support in the browser (`navigator.gpu`).
- If WebGPU is unavailable, the app still runs fully using deterministic template planning mode.
- Retrieval, continual-learning updates, memory inspection, and evaluation dashboards remain available without WebGPU.

## Data Disclaimer

- All datasets in this project are synthetic.
- No production, personal, or confidential data is required or included.
