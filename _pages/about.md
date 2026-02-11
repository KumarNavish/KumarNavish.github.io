---
layout: research-home
title: Research
permalink: /
subtitle: Basel, Switzerland
nav: true
nav_order: 1
custom_css:
  - /assets/css/research-portfolio.css
custom_js:
  - /assets/js/research-portfolio.js
---

<div id="research-app">
  <section class="research-hero" aria-labelledby="research-hero-title">
    <p class="research-kicker">Designed Intellectual Work</p>
    <h1 id="research-hero-title">Research Portfolio</h1>
    <p id="research-hero-text" class="research-hero-text"></p>
    <p id="research-hero-meta" class="research-hero-meta"></p>
    <div class="research-hero-actions">
      <a id="research-scholar" class="research-btn research-btn-primary" href="#" target="_blank" rel="noreferrer">Google Scholar</a>
      <a class="research-btn research-btn-quiet" href="#research-all-works">Browse All Works</a>
    </div>
    <div class="research-stats" aria-label="Research statistics">
      <article class="research-stat-card">
        <p id="research-stat-works" class="research-stat-value">0</p>
        <p class="research-stat-label">Works</p>
      </article>
      <article class="research-stat-card">
        <p id="research-stat-citations" class="research-stat-value">0</p>
        <p class="research-stat-label">Citations</p>
      </article>
      <article class="research-stat-card">
        <p id="research-stat-arcs" class="research-stat-value">0</p>
        <p class="research-stat-label">Research Arcs</p>
      </article>
    </div>
  </section>

  <section class="research-section" id="research-arcs" aria-labelledby="research-arcs-title">
    <header class="research-section-head">
      <h2 id="research-arcs-title">Research Arcs</h2>
      <p>The portfolio is organized by themes rather than chronology, so each paper sits within an explicit line of thought.</p>
    </header>
    <div id="research-arc-grid" class="research-arc-grid"></div>
  </section>

  <section class="research-section" id="research-selected" aria-labelledby="research-selected-title">
    <header class="research-section-head">
      <h2 id="research-selected-title">Selected Works</h2>
      <p>Highlighted papers combine concise summaries, design motifs, and contribution statements for fast orientation.</p>
    </header>
    <div id="research-featured-grid" class="research-featured-grid"></div>
  </section>

  <section class="research-section" id="research-progression" aria-labelledby="research-progression-title">
    <header class="research-section-head">
      <h2 id="research-progression-title">Intellectual Progression</h2>
      <p>A chronological reading to see how ideas connect, branch, and compound.</p>
    </header>
    <div id="research-progression-list" class="research-progression"></div>
  </section>

  <section class="research-section" id="research-all-works" aria-labelledby="research-all-title">
    <header class="research-section-head">
      <h2 id="research-all-title">All Works</h2>
      <p>Publications grouped by research arc with thematic filters and direct links.</p>
    </header>
    <div id="research-filters" class="research-filters" aria-label="Filter publications by arc"></div>
    <div id="research-works-groups" class="research-works-groups"></div>
  </section>

  <footer class="research-footer">
    <p>
      Data source: <a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer">Google Scholar</a>.
      Curation is authored in <code>assets/data/research-curation.json</code>.
    </p>
  </footer>
</div>
