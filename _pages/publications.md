---
layout: intentional
permalink: /publications/
title: Archive
description: Complete publication archive with thematic grouping and concise context.
page_class: page-archive
custom_js:
  - /assets/js/research-core.js
  - /assets/js/research-publications.js
---

<article id="intentional-archive" class="intentional-panel" aria-label="Publication archive">
  <section class="intentional-hero" aria-labelledby="archive-title">
    <p class="intentional-kicker">Research Archive</p>
    <h1 id="archive-title" class="intentional-title">Publication Archive</h1>
    <p class="intentional-subtitle">Each paper is placed in a program so intellectual progression is explicit, not inferred.</p>
    <p id="archive-sync" class="intentional-context"></p>

    <div class="intentional-stats" aria-label="Archive statistics">
      <article class="intentional-stat">
        <p id="archive-stat-works" class="intentional-stat-value">0</p>
        <p class="intentional-stat-label">Works</p>
      </article>
      <article class="intentional-stat">
        <p id="archive-stat-citations" class="intentional-stat-value">0</p>
        <p class="intentional-stat-label">Citations</p>
      </article>
      <article class="intentional-stat">
        <p id="archive-stat-arcs" class="intentional-stat-value">0</p>
        <p class="intentional-stat-label">Arcs</p>
      </article>
    </div>
  </section>

  <section class="intentional-section" aria-labelledby="archive-map-title">
    <header class="intentional-section-head">
      <h2 id="archive-map-title">Arc Map</h2>
      <p>Start with programs, then move into individual works.</p>
    </header>
    <div id="archive-arc-map" class="intentional-arc-map"></div>
  </section>

  <section class="intentional-section" aria-labelledby="archive-controls-title">
    <header class="intentional-section-head">
      <h2 id="archive-controls-title">Browse</h2>
      <p>Filter by program and search by method, concept, or domain.</p>
    </header>

    <div class="intentional-controls">
      <label class="intentional-search" for="archive-search">
        <span>Search</span>
        <input id="archive-search" type="search" placeholder="e.g., variational, logistics, laplacian" autocomplete="off" />
      </label>
      <div id="archive-filters" class="intentional-filters" aria-label="Filter works by arc"></div>
    </div>
  </section>

  <section class="intentional-section" aria-labelledby="archive-list-title">
    <header class="intentional-section-head">
      <h2 id="archive-list-title">All Works</h2>
      <p>Organized by program, then year, with concise context for fast review.</p>
    </header>
    <div id="archive-list" class="intentional-archive-list"></div>
    <p id="archive-empty" class="intentional-empty" hidden>No works match the current filter.</p>
  </section>
</article>
