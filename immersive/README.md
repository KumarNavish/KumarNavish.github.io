# Immersive research portfolio

Production: https://kumarnavish.github.io/

React, TypeScript, and lazy-loaded Three.js/WebGL2. The previous application remains in `../site`; its source and checks are preserved. The existing GitHub Pages workflow and permissions are unchanged. `make site-build` builds both applications, runs the new mathematical and world-state checks, validates the new rendered application in CI, and publishes the new static output into `site/dist`.

## Reproduce

Use Node 20 or 22. Run `npm ci`, `npm run check`, then `npm run preview`. In another terminal run `npx playwright install chromium` and `npm run qa`. Set `QA_BASE_URL` to the production origin to repeat the same browser checks after deployment. Evidence is written outside the repository using `QA_OUT`.

## Source map

- `src/data/legacyRegistry.ts`: source-derived research metadata, relationships and boundaries.
- `src/data/exhibits.ts`: authored explanation sequences and declared model scope.
- `src/engine/science.ts`: explicit numerical examples independent of rendering.
- `src/engine/world.ts`: transactional parser, persistent identities/relations, history and A\* floor paths.
- `src/engine/renderer.ts`: camera, raycasting, transitions, demand rendering and resource cleanup.
- `src/engine/scientificModels.ts` and `worldModels.ts`: procedural 3D objects.
- `scripts/static-routes.mjs`: server-rendered routes, metadata and commit-bound `release.json`.
- `scripts/publish.mjs`: verified integration into the pre-existing Pages artifact directory.

## Scope and limitations

The scientific examples are explanatory computations, not manuscript experiments. CasePath uses synthetic source records and a narrow consistency obligation; it does not establish real-world truth or authorize legal decisions. Spatial commands use a declared deterministic grammar and procedural 3D assets, not model-generated scenes, physics or learned embodiment. The demonstration agent finds an obstacle-aware approach path and does not perform a physical measurement. Typed commands remain in the browser; optional dictation uses the browser's speech service. ER and Rank are labelled research manuscripts until current review outcomes can be verified.

## Release verification

Inspect `/release.json` for the exact commit, timestamp and route manifest. Browser QA checks real WebGL geometry, camera changes, scientific invariants in the rendered UI, trajectory lenses, source conflict/correction, language edits, raycast dragging, persistence across reload, mobile viewports, reduced-motion/no-WebGL operation, console health and accessibility. Automated tests do not establish human comprehension or subjective design quality.

The pre-rebuild production source is commit `d3ffc8c7a04f1877065497dc3690a33777133dad`. Revert the integration commit rather than rewriting history if rollback is required.
