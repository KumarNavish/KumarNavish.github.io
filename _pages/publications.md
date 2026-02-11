---
layout: research-home
permalink: /publications/
title: Publications
description: Curated publication record organized by research arc.
nav: true
nav_order: 2
custom_css:
  - /assets/css/research-portfolio.css
custom_js:
  - /assets/js/research-publications.js
---

<div id="research-publications-app">
  <section class="research-section research-section-first" aria-labelledby="pub-overview-title">
    <header class="research-section-head">
      <h1 id="pub-overview-title">Publication Record</h1>
      <p>
        A coherent map of publications grouped by research arcs, with concise summaries and links to original sources.
      </p>
    </header>
    <p id="pub-sync-date" class="research-publications-note"></p>
  </section>

  <section class="research-section" aria-labelledby="pub-selected-title">
    <header class="research-section-head">
      <h2 id="pub-selected-title">Selected Contributions</h2>
      <p>
        Works chosen for conceptual centrality in the broader research trajectory.
      </p>
    </header>
    <div id="pub-featured-grid" class="research-featured-grid"></div>
  </section>

  <section class="research-section" aria-labelledby="pub-all-title">
    <header class="research-section-head">
      <h2 id="pub-all-title">Complete List by Arc</h2>
      <p>
        Full publication list with context-first summaries, venue metadata, and direct links.
      </p>
    </header>
    <div id="pub-arc-groups" class="research-works-groups"></div>
  </section>
</div>
