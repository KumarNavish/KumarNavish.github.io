const PUB_RAW_DATA_URL = "/assets/data/works_raw.json";
const PUB_CURATION_URL = "/assets/data/research-curation.json";
const PUB_DEFAULT_ARC = "general";

function pubGetUserId(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.searchParams.get("user") || "";
  } catch {
    return "";
  }
}

function pubInferArc(work) {
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

  return PUB_DEFAULT_ARC;
}

function pubFallbackSummary(description, venue) {
  if (description) {
    const firstSentence = description.split(/\.\s+/)[0]?.trim();
    if (firstSentence && firstSentence.length > 30) {
      return `${firstSentence}.`;
    }
  }
  return venue || "Work in progress.";
}

function pubVenue(work) {
  return work.journal || work.book || work.conference || work.venue || "";
}

function pubScholarUrl(work, userId) {
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

function pubNormalizeWorks(raw, curation) {
  const userId = pubGetUserId(raw.source || curation.site?.scholar_url || "");
  const overrides = curation.overrides || {};

  const normalized = (raw.works || []).map((work) => {
    const override = overrides[work.id] || {};
    const venue = pubVenue(work);

    return {
      ...work,
      arc: override.arc || pubInferArc(work),
      featured: Boolean(override.featured),
      schematic: override.schematic || "lines",
      summary: override.summary || pubFallbackSummary(work.description, venue),
      contribution: override.contribution || "",
      tags: Array.isArray(override.tags) ? override.tags : [],
      venue,
      links: [
        { label: "Paper", href: work.external_url || "" },
        { label: "PDF", href: work.pdf_url || "" },
        { label: "Scholar", href: pubScholarUrl(work, userId) }
      ].filter((link) => Boolean(link.href))
    };
  });

  return normalized.sort((a, b) => {
    if ((b.year || 0) !== (a.year || 0)) {
      return (b.year || 0) - (a.year || 0);
    }
    return (b.citations || 0) - (a.citations || 0);
  });
}

function pubArcNames(curation) {
  return Object.fromEntries((curation.arcs || []).map((arc) => [arc.id, arc.name]));
}

function pubMotifMarkup(type) {
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

function pubRenderSyncDate(raw) {
  const dateTarget = document.getElementById("pub-sync-date");
  if (!dateTarget) {
    return;
  }

  if (!raw.fetched_at) {
    dateTarget.textContent = "";
    return;
  }

  const asDate = new Date(`${raw.fetched_at}T00:00:00Z`);
  if (Number.isNaN(asDate.getTime())) {
    dateTarget.textContent = `Source synchronized from Google Scholar on ${raw.fetched_at}.`;
    return;
  }

  const formatted = asDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  dateTarget.textContent = `Source synchronized from Google Scholar on ${formatted}.`;
}

function pubRenderFeatured(curation, works) {
  const root = document.getElementById("pub-featured-grid");
  if (!root) {
    return;
  }

  const arcs = pubArcNames(curation);
  const featured = works.filter((work) => work.featured);

  root.innerHTML = featured
    .map((work) => {
      const links = work.links
        .map((link) => `<a href="${link.href}" target="_blank" rel="noreferrer">${link.label}</a>`)
        .join("");

      return `
        <article class="research-paper-card research-reveal">
          <div class="research-paper-top">
            <span class="research-arc-chip">${arcs[work.arc] || "Unsorted"}</span>
            <span class="research-paper-year">${work.year || ""}</span>
          </div>
          ${pubMotifMarkup(work.schematic)}
          <h3>${work.title}</h3>
          <p class="research-paper-summary">${work.summary}</p>
          <p class="research-paper-contribution">${work.contribution}</p>
          <div class="research-paper-links">${links}</div>
        </article>
      `;
    })
    .join("");
}

function pubRenderAllByArc(curation, works) {
  const root = document.getElementById("pub-arc-groups");
  if (!root) {
    return;
  }

  const arcMap = Object.fromEntries((curation.arcs || []).map((arc) => [arc.id, arc]));
  const grouped = works.reduce((acc, work) => {
    const key = work.arc || PUB_DEFAULT_ARC;
    acc[key] = acc[key] || [];
    acc[key].push(work);
    return acc;
  }, {});

  const orderedArcIds = (curation.arcs || []).map((arc) => arc.id).filter((arcId) => (grouped[arcId] || []).length > 0);

  root.innerHTML = orderedArcIds
    .map((arcId) => {
      const arc = arcMap[arcId] || { name: "Unsorted", thesis: "" };
      const entries = grouped[arcId]
        .map((work) => {
          const links = work.links
            .map((link) => `<a href="${link.href}" target="_blank" rel="noreferrer">${link.label}</a>`)
            .join("");
          const tags = work.tags.length ? `<p class="research-work-meta">${work.tags.join(" | ")}</p>` : "";

          return `
            <li class="research-work-item">
              <div class="research-work-head">
                <h4 class="research-work-title">${work.title}</h4>
                <span class="research-work-year">${work.year || ""}</span>
              </div>
              <p class="research-work-meta">${work.authors || ""}</p>
              <p class="research-work-meta">${work.venue || ""}</p>
              <p class="research-work-summary">${work.summary}</p>
              <p class="research-work-meta">Cited by ${work.citations || 0}</p>
              ${tags}
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
          <p class="research-work-meta" style="margin-top:0.75rem;">${arc.thesis || ""}</p>
          <ul class="research-work-list">${entries}</ul>
        </section>
      `;
    })
    .join("");
}

function pubApplyRevealAnimation() {
  const nodes = document.querySelectorAll(".research-reveal");
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("is-visible"));
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

  nodes.forEach((node) => observer.observe(node));
}

async function initPublicationsPage() {
  const app = document.getElementById("research-publications-app");
  if (!app) {
    return;
  }

  try {
    const [rawResp, curationResp] = await Promise.all([
      fetch(PUB_RAW_DATA_URL),
      fetch(PUB_CURATION_URL)
    ]);

    if (!rawResp.ok) {
      throw new Error(`Failed to load ${PUB_RAW_DATA_URL}: ${rawResp.status}`);
    }
    if (!curationResp.ok) {
      throw new Error(`Failed to load ${PUB_CURATION_URL}: ${curationResp.status}`);
    }

    const raw = await rawResp.json();
    const curation = await curationResp.json();
    const works = pubNormalizeWorks(raw, curation);

    pubRenderSyncDate(raw);
    pubRenderFeatured(curation, works);
    pubRenderAllByArc(curation, works);
    pubApplyRevealAnimation();
  } catch (error) {
    console.error(error);
    app.innerHTML = `
      <section class="research-section research-section-first">
        <header class="research-section-head">
          <h2>Unable to load publication data</h2>
          <p>Check that <code>/assets/data/works_raw.json</code> and <code>/assets/data/research-curation.json</code> are present.</p>
        </header>
      </section>
    `;
  }
}

initPublicationsPage();
