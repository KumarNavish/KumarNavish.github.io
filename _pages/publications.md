---
layout: research-home
permalink: /publications/
title: Archive
description: Complete publication archive grouped by research arc.
nav: true
nav_order: 2
page_class: intentional-site
custom_css:
  - /assets/css/research-portfolio.css
custom_js:
  - /assets/js/research-core.js
  - /assets/js/research-publications.js
---

<main id="intentional-archive" class="intentional-root" aria-label="Publication archive">
  <section class="intentional-hero intentional-hero-compact" aria-labelledby="archive-title">
    <p class="intentional-kicker">Research Archive</p>
    <h1 id="archive-title">Complete Publication Record</h1>
    <p class="intentional-lead">Every paper is indexed by arc, intent, and contribution so the trajectory is readable at a glance.</p>
    <p id="archive-sync" class="intentional-context"></p>
    <div class="intentional-stats intentional-stats-compact" aria-label="Archive statistics">
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

  <section class="intentional-section intentional-section-tight" aria-labelledby="archive-controls-title">
    <header class="intentional-section-head">
      <h2 id="archive-controls-title">Find Quickly</h2>
      <p>Filter by arc and search across titles, methods, and summaries.</p>
    </header>
    <div class="intentional-controls">
      <label class="intentional-search" for="archive-search">
        <span>Search</span>
        <input id="archive-search" type="search" placeholder="e.g., variational, logistics, laplacian" autocomplete="off" />
      </label>
      <div id="archive-filters" class="intentional-filters" aria-label="Filter by research arc"></div>
    </div>
  </section>

  <section class="intentional-section" aria-labelledby="archive-list-title">
    <header class="intentional-section-head">
      <h2 id="archive-list-title">All Works</h2>
      <p>Grouped by year, annotated with arc context and concise significance notes.</p>
    </header>
    <div id="archive-list" class="intentional-archive-list"></div>
    <p id="archive-empty" class="intentional-empty" hidden>No works match this filter yet.</p>
  </section>
</main>
