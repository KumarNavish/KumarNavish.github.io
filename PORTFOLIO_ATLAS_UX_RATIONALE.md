# Portfolio Atlas — Senior UX Critique and Design Response

## Critique of the approved visual direction

The original concept established a strong visual world, but it still behaved primarily as a high-end composition rather than a product.

### 1. Awe came from rendering, not agency

The central object and floating cards looked impressive, but the visitor had no meaningful role beyond scrolling. The visual depth was decorative rather than operational.

**Response:** make the hero a spatial research atlas with drag-to-orbit, depth control, keyboard navigation, semantic layout changes, guided camera movement, and inspectable nodes.

### 2. The interaction model was ambiguous

The interface exposed many navigational elements, cards, labels, and controls without establishing which interaction was primary. A visitor could admire the screen without knowing what to do next.

**Response:** reduce the first-view interaction model to three explicit actions:

1. enter a guided atlas;
2. explore the spatial graph manually;
3. skip directly to written evidence.

### 3. Three-dimensionality did not communicate structure

Floating work cards suggested depth, but their positions did not explain chronology, conceptual relationships, or frontier direction.

**Response:** give the same work three meaningful spatial organizations:

- **Constellation:** conceptual relationships;
- **Trajectory:** progression from foundations to current work;
- **Frontier:** published foundations recede while active directions move forward.

### 4. The page risked becoming a portfolio dashboard

Dense panels and repeated cards could make the work feel like inventory. That weakens the desired signal of coherent thought.

**Response:** replace conventional project cards with compact monographs organized as:

`Problem → Insight → Build → Evidence → Next`

### 5. Motion lacked a semantic contract

Animation could easily become a layer of spectacle unrelated to comprehension.

**Response:** adopt the reference video’s strongest principles:

- assemble information progressively;
- draw connections only when they become relevant;
- reframe the camera when the meaning changes;
- reserve accent color for the active causal path;
- let the system reorganize rather than merely animate in place.

### 6. Immersion could compromise accessibility and speed

A 3D-first experience can exclude visitors with motion sensitivity, keyboard-only navigation, low-power devices, or limited time.

**Response:**

- dependency-free projected 3D rather than a heavy WebGL framework;
- capped device-pixel ratio;
- animation pauses when the scene leaves the viewport;
- explicit pause/resume control;
- `prefers-reduced-motion` support;
- full keyboard access and command search;
- a linear evidence path beneath the atlas;
- secondary nodes removed from the compact mobile scene;
- project details remain accessible as structured text.

## Product-level interaction architecture

### Layer 1 — Signal

A single thesis, three capability signals, and the spatial atlas establish identity within seconds.

### Layer 2 — Evidence

Selected work is presented through decision chains with direct links to OpenReview, papers, benchmarks, repositories, and live systems.

### Layer 3 — Depth

Clicking an atlas node opens a structured research sheet: question, built artifact, evidence, unresolved boundary, and external proof.

### Layer 4 — Frontier

The research map and spatial-computing thesis show where the body of work is heading without presenting unfinished work as completed evidence.

## Memorable interactions

1. **Spatial research atlas:** orbit, zoom, focus, and inspect the body of work.
2. **Semantic morph:** reorganize identical nodes as constellation, trajectory, or frontier.
3. **Motion thesis film:** a restrained sequence that demonstrates how questions become papers, systems, and future directions.

The result is intended to make the site itself evidence of product judgment: ambitious in conception, restrained in interface, legible under time pressure, and progressively deeper for visitors who continue exploring.
