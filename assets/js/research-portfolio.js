const RESEARCH_RAW_DATA_URL = "/assets/data/works_raw.json";
const RESEARCH_CURATION_URL = "/assets/data/research-curation.json";
const RESEARCH_DEFAULT_ARC = "general";

function getResearchUserId(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.searchParams.get("user") || "";
  } catch (error) {
    return "";
  }
}

function inferResearchArc(work) {
  const text = `${work.title || ""} ${work.description || ""}`.toLowerCase();

  if (text.includes("variational") || text.includes("natural-gradient") || text.includes("natural gradient")) {
    return "geometric-inference";
  }
  if (text.includes("delivery") || text.includes("cargo-bike") || text.includes("cargo bike") || text.includes("micro-regions")) {
    return "urban-logistics";
  }
  if (text.includes("laplacian") || text.includes("gain graph") || text.includes("eigenvalue")) {
    return "spectral-graphs";
  }
  if (text.includes("hate") || text.includes("twitter") || text.includes("counter")) {
    return "social-dynamics";
  }

  return RESEARCH_DEFAULT_ARC;
}

function fallbackSummary(description, venue) {
  if (description) {
    const firstSentence = description.split(/\.\s+/)[0]?.trim();
    if (firstSentence && firstSentence.length > 30) {
      return `${firstSentence}.`;
    }
  }
  return venue || "Work in progress.";
}

function cleanResearchVenue(work) {
  return work.journal || work.book || work.conference || work.venue || "";
}

function scholarEntryUrl(work, userId) {
  if (work.scholar_citation_url) {
    return work.scholar_citation_url;
  }

  if (work.scholar_citation_path) {
    if (work.scholar_citation_path.startsWith("http")) {
      return work.scholar_citation_path;
    }
    return `https://scholar.google.com${work.scholar_citation_path}`;
  }

  if (work.id && userId) {
    return `https://scholar.google.com/citations?view_op=view_citation&hl=en&user=${userId}&citation_for_view=${userId}:${work.id}`;
  }

  return "";
}

function normalizeResearchWorks(raw, curation) {
  const userId = getResearchUserId(raw.source || curation.site?.scholar_url || "");
  const overrides = curation.overrides || {};

  const normalized = (raw.works || []).map((work) => {
    const override = overrides[work.id] || {};
    const arc = override.arc || inferResearchArc(work);
    const venue = cleanResearchVenue(work);

    const links = [
      { label: "Paper", href: work.external_url || "" },
      { label: "PDF", href: work.pdf_url || "" },
      { label: "Scholar", href: scholarEntryUrl(work, userId) }
    ].filter((link) => Boolean(link.href));

    return {
      ...work,
      arc,
      featured: Boolean(override.featured),
      schematic: override.schematic || "lines",
      summary: override.summary || fallbackSummary(work.description, venue),
      contribution: override.contribution || "",
      tags: Array.isArray(override.tags) ? override.tags : [],
      relatedTo: Array.isArray(override.related_to) ? override.related_to : [],
      venue,
      links
    };
  });

  const byId = Object.fromEntries(normalized.map((work) => [work.id, work]));
  normalized.forEach((work) => {
    work.relatedTitles = work.relatedTo
      .map((entryId) => byId[entryId])
      .filter(Boolean)
      .map((entry) => entry.title);
  });

  return normalized.sort((a, b) => {
    if ((b.year || 0) !== (a.year || 0)) {
      return (b.year || 0) - (a.year || 0);
    }
    return (b.citations || 0) - (a.citations || 0);
  });
}

function motifMarkup(type) {
  const kind = type || "lines";
  const spanCount = {
    geometry: 4,
    hex: 7,
    spectrum: 5,
    dialogue: 3,
    lines: 3
  }[kind] || 3;

  const spans = Array.from({ length: spanCount }, () => "<span></span>").join("");
  return `<div class=\"research-motif research-motif-${kind}\" aria-hidden=\"true\">${spans}</div>`;
}

function renderResearchHero(raw, curation, works) {
  const site = curation.site || {};
  const profile = raw.profile || {};

  const titleEl = document.getElementById("research-hero-title");
  const heroTextEl = document.getElementById("research-hero-text");
  const heroMetaEl = document.getElementById("research-hero-meta");
  const scholarEl = document.getElementById("research-scholar");

  const worksStatEl = document.getElementById("research-stat-works");
  const citationsStatEl = document.getElementById("research-stat-citations");
  const arcsStatEl = document.getElementById("research-stat-arcs");

  if (titleEl) {
    titleEl.textContent = `${site.name || profile.name || "Research"} | ${site.title || "Research Portfolio"}`;
  }
  if (heroTextEl) {
    heroTextEl.textContent = site.statement || "A curated research portfolio.";
  }
  if (heroMetaEl) {
    heroMetaEl.textContent = profile.affiliation || "";
  }
  if (scholarEl) {
    scholarEl.href = site.scholar_url || raw.source || "#";
  }

  const totalCitations = works.reduce((sum, work) => sum + (work.citations || 0), 0);
  const totalArcs = new Set(works.map((work) => work.arc)).size;

  if (worksStatEl) {
    worksStatEl.textContent = String(works.length);
  }
  if (citationsStatEl) {
    citationsStatEl.textContent = String(totalCitations);
  }
  if (arcsStatEl) {
    arcsStatEl.textContent = String(totalArcs);
  }
}

function yearsRange(yearValues) {
  const years = yearValues.filter((entry) => Number.isFinite(entry));
  if (!years.length) {
    return "n/a";
  }
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}` : `${min}-${max}`;
}

function renderResearchArcs(curation, works) {
  const root = document.getElementById("research-arc-grid");
  if (!root) {
    return;
  }

  const arcs = curation.arcs || [];
  root.innerHTML = arcs
    .map((arc) => {
      const inArc = works.filter((work) => work.arc === arc.id);
      if (!inArc.length) {
        return "";
      }

      const range = yearsRange(inArc.map((work) => work.year));

      return `
        <article class="research-arc-card research-reveal">
          <div class="research-arc-title-row">
            <h3 class="research-arc-title">${arc.name}</h3>
            <p class="research-arc-range">${range}</p>
          </div>
          <p class="research-arc-thesis">${arc.thesis}</p>
          <div class="research-arc-foot">
            <span>${inArc.length} work${inArc.length === 1 ? "" : "s"}</span>
            <span>${arc.id}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function pickFeaturedWorks(works) {
  const explicitlyFeatured = works.filter((work) => work.featured);
  if (explicitlyFeatured.length >= 3) {
    return explicitlyFeatured.slice(0, 3);
  }

  const supplement = works
    .filter((work) => !work.featured)
    .sort((a, b) => (b.citations || 0) - (a.citations || 0));

  return [...explicitlyFeatured, ...supplement].slice(0, 3);
}

function arcNameLookup(curation) {
  return Object.fromEntries((curation.arcs || []).map((arc) => [arc.id, arc.name]));
}

function renderFeaturedWorks(curation, works) {
  const root = document.getElementById("research-featured-grid");
  if (!root) {
    return;
  }

  const arcNames = arcNameLookup(curation);
  const cards = pickFeaturedWorks(works).map((work) => {
    const links = work.links
      .map((link) => `<a href="${link.href}" target="_blank" rel="noreferrer">${link.label}</a>`)
      .join("");

    return `
      <article class="research-paper-card research-reveal">
        <div class="research-paper-top">
          <span class="research-arc-chip">${arcNames[work.arc] || "Unsorted"}</span>
          <span class="research-paper-year">${work.year || ""}</span>
        </div>
        ${motifMarkup(work.schematic)}
        <h3>${work.title}</h3>
        <p class="research-paper-summary">${work.summary}</p>
        <p class="research-paper-contribution">${work.contribution}</p>
        <div class="research-paper-links">${links}</div>
      </article>
    `;
  });

  root.innerHTML = cards.join("");
}

function renderResearchProgression(curation, works) {
  const root = document.getElementById("research-progression-list");
  if (!root) {
    return;
  }

  const arcNames = arcNameLookup(curation);
  root.innerHTML = [...works]
    .sort((a, b) => {
      if ((a.year || 0) !== (b.year || 0)) {
        return (a.year || 0) - (b.year || 0);
      }
      return a.title.localeCompare(b.title);
    })
    .map((work) => {
      const primaryLink = work.links.find((link) => link.label === "Paper") || work.links[0];
      const titleMarkup = primaryLink
        ? `<a href="${primaryLink.href}" target="_blank" rel="noreferrer">${work.title}</a>`
        : work.title;
      const related = work.relatedTitles.length ? `Builds from: ${work.relatedTitles.join("; ")}.` : "";

      return `
        <article class="research-progress-row research-reveal">
          <div class="research-progress-year">${work.year || ""}</div>
          <div class="research-progress-body">
            <h3 class="research-progress-title">${titleMarkup}</h3>
            <p class="research-progress-note">${arcNames[work.arc] || "Unsorted"} | ${work.summary}</p>
            ${related ? `<p class="research-progress-note">${related}</p>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderWorksByArc(curation, works, selectedArcId) {
  const root = document.getElementById("research-works-groups");
  if (!root) {
    return;
  }

  const arcsById = Object.fromEntries((curation.arcs || []).map((arc) => [arc.id, arc]));
  const filtered = selectedArcId === "all" ? works : works.filter((work) => work.arc === selectedArcId);

  const grouped = filtered.reduce((acc, work) => {
    const key = work.arc || RESEARCH_DEFAULT_ARC;
    acc[key] = acc[key] || [];
    acc[key].push(work);
    return acc;
  }, {});

  const orderedArcIds = (curation.arcs || []).map((arc) => arc.id).filter((arcId) => (grouped[arcId] || []).length > 0);

  root.innerHTML = orderedArcIds
    .map((arcId) => {
      const arc = arcsById[arcId] || { name: "Unsorted" };
      const entries = grouped[arcId]
        .sort((a, b) => {
          if ((b.year || 0) !== (a.year || 0)) {
            return (b.year || 0) - (a.year || 0);
          }
          return (b.citations || 0) - (a.citations || 0);
        })
        .map((work) => {
          const links = work.links
            .map((link) => `<a href="${link.href}" target="_blank" rel="noreferrer">${link.label}</a>`)
            .join("");

          const related = work.relatedTitles.length
            ? `<p class="research-work-related">Connects to: ${work.relatedTitles.join("; ")}.</p>`
            : "";

          const tags = work.tags.length ? work.tags.join(" | ") : "";

          return `
            <li class="research-work-item">
              <div class="research-work-head">
                <h4 class="research-work-title">${work.title}</h4>
                <span class="research-work-year">${work.year || ""}</span>
              </div>
              <p class="research-work-meta">${work.authors || ""}</p>
              <p class="research-work-meta">${work.venue || ""}</p>
              <p class="research-work-summary">${work.summary}</p>
              ${related}
              ${tags ? `<p class="research-work-meta">${tags}</p>` : ""}
              <div class="research-work-links">${links}</div>
            </li>
          `;
        })
        .join("");

      return `
        <section class="research-arc-group research-reveal">
          <header class="research-arc-group-head">
            <h3 class="research-arc-group-title">${arc.name}</h3>
            <p class="research-arc-group-sub">${grouped[arcId].length} work${grouped[arcId].length === 1 ? "" : "s"}</p>
          </header>
          <ul class="research-work-list">${entries}</ul>
        </section>
      `;
    })
    .join("");
}

function mountArcFilters(curation, works, onFilterChange) {
  const root = document.getElementById("research-filters");
  if (!root) {
    return;
  }

  const counts = Object.fromEntries((curation.arcs || []).map((arc) => [arc.id, 0]));
  works.forEach((work) => {
    counts[work.arc] = (counts[work.arc] || 0) + 1;
  });

  root.innerHTML = "";

  function addButton(id, label) {
    const button = document.createElement("button");
    button.className = "research-filter-btn";
    button.dataset.filter = id;
    button.textContent = label;
    button.type = "button";
    button.addEventListener("click", () => onFilterChange(id));
    root.appendChild(button);
  }

  addButton("all", "All works");

  (curation.arcs || []).forEach((arc) => {
    if ((counts[arc.id] || 0) > 0) {
      addButton(arc.id, arc.name);
    }
  });

  onFilterChange("all");
}

function applyRevealAnimation() {
  const revealNodes = document.querySelectorAll(".research-reveal");
  if (!("IntersectionObserver" in window)) {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealNodes.forEach((node) => observer.observe(node));
}

async function initResearchPortfolio() {
  const app = document.getElementById("research-app");
  if (!app) {
    return;
  }

  try {
    const [rawResp, curationResp] = await Promise.all([
      fetch(RESEARCH_RAW_DATA_URL),
      fetch(RESEARCH_CURATION_URL)
    ]);

    if (!rawResp.ok) {
      throw new Error(`Failed to load ${RESEARCH_RAW_DATA_URL}: ${rawResp.status}`);
    }
    if (!curationResp.ok) {
      throw new Error(`Failed to load ${RESEARCH_CURATION_URL}: ${curationResp.status}`);
    }

    const raw = await rawResp.json();
    const curation = await curationResp.json();
    const works = normalizeResearchWorks(raw, curation);

    renderResearchHero(raw, curation, works);
    renderResearchArcs(curation, works);
    renderFeaturedWorks(curation, works);
    renderResearchProgression(curation, works);

    let activeFilter = "all";
    const setFilter = (nextFilter) => {
      activeFilter = nextFilter;
      document.querySelectorAll(".research-filter-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.filter === activeFilter);
      });
      renderWorksByArc(curation, works, activeFilter);
      applyRevealAnimation();
    };

    mountArcFilters(curation, works, setFilter);
    applyRevealAnimation();
  } catch (error) {
    console.error(error);
    app.innerHTML = `
      <section class="research-section">
        <header class="research-section-head">
          <h2>Unable to load research data</h2>
          <p>Check that <code>/assets/data/works_raw.json</code> and <code>/assets/data/research-curation.json</code> exist in the deployed site.</p>
        </header>
      </section>
    `;
  }
}

initResearchPortfolio();
