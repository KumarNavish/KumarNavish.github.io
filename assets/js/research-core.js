(function () {
  "use strict";

  var RAW_DATA_URL = "/assets/data/works_raw.json";
  var CURATION_URL = "/assets/data/research-curation.json";
  var DEFAULT_ARC = "mathematical-structure";

  var cache = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNumber(value) {
    var number = Number(value || 0);
    return new Intl.NumberFormat("en-US").format(number);
  }

  function formatDate(isoDate) {
    if (!isoDate) {
      return "";
    }

    var parsed = new Date(String(isoDate) + "T00:00:00Z");
    if (Number.isNaN(parsed.getTime())) {
      return String(isoDate);
    }

    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function yearsRange(works) {
    var years = works
      .map(function (work) {
        return Number(work.year);
      })
      .filter(function (year) {
        return Number.isFinite(year);
      });

    if (!years.length) {
      return "-";
    }

    var min = Math.min.apply(null, years);
    var max = Math.max.apply(null, years);

    if (min === max) {
      return String(min);
    }

    return String(min) + "-" + String(max);
  }

  function getScholarUserId(sourceUrl) {
    if (!sourceUrl) {
      return "";
    }

    try {
      var parsed = new URL(sourceUrl);
      return parsed.searchParams.get("user") || "";
    } catch (error) {
      return "";
    }
  }

  function resolveScholarLink(work, userId) {
    if (work.scholar_citation_url) {
      return work.scholar_citation_url;
    }

    if (work.scholar_citation_path) {
      if (String(work.scholar_citation_path).indexOf("http") === 0) {
        return work.scholar_citation_path;
      }
      return "https://scholar.google.com" + work.scholar_citation_path;
    }

    if (work.id && userId) {
      return "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=" + userId + "&citation_for_view=" + userId + ":" + work.id;
    }

    return "";
  }

  function cleanVenue(work) {
    return work.journal || work.book || work.conference || work.venue || "";
  }

  function fallbackSummary(work) {
    var description = work.description || "";
    if (description) {
      var sentence = description.split(/\.\s+/)[0];
      if (sentence && sentence.length > 40) {
        return sentence.replace(/[.\s]*$/, "") + ".";
      }
    }

    var venue = cleanVenue(work);
    if (venue) {
      return "Published in " + venue + ".";
    }

    return "Context summary is not yet curated.";
  }

  function inferArc(work, arcs) {
    var text = ((work.title || "") + " " + (work.description || "")).toLowerCase();

    if (
      text.indexOf("variational") >= 0 ||
      text.indexOf("laplacian") >= 0 ||
      text.indexOf("eigenvalue") >= 0 ||
      text.indexOf("gain graph") >= 0
    ) {
      return "mathematical-structure";
    }

    if (
      text.indexOf("delivery") >= 0 ||
      text.indexOf("cargo-bike") >= 0 ||
      text.indexOf("cargo bike") >= 0 ||
      text.indexOf("micro-regions") >= 0
    ) {
      return "urban-logistics";
    }

    if (
      text.indexOf("hate") >= 0 ||
      text.indexOf("counter") >= 0 ||
      text.indexOf("twitter") >= 0
    ) {
      return "social-resilience";
    }

    if (arcs && arcs.length) {
      return arcs[0].id;
    }

    return DEFAULT_ARC;
  }

  function buildLinks(work, userId) {
    return [
      { label: "Paper", href: work.external_url || "" },
      { label: "PDF", href: work.pdf_url || "" },
      { label: "Scholar", href: resolveScholarLink(work, userId) }
    ].filter(function (link) {
      return Boolean(link.href);
    });
  }

  function normalizeWorks(raw, curation) {
    var arcs = curation.arcs || [];
    var overrides = curation.overrides || {};
    var userId = getScholarUserId(raw.source || ((curation.site && curation.site.scholar_url) || ""));

    return (raw.works || [])
      .map(function (work) {
        var override = overrides[work.id] || {};
        var venue = cleanVenue(work);

        return {
          id: work.id || "",
          title: work.title || "Untitled work",
          authors: work.authors || "",
          year: work.year || null,
          citations: Number(work.citations || 0),
          venue: venue,
          description: work.description || "",
          arc: override.arc || inferArc(work, arcs),
          featured: Boolean(override.featured),
          summary: override.summary || fallbackSummary(work),
          contribution: override.contribution || "",
          build: override.build || "",
          impact: override.impact || "",
          timelineNote: override.timeline_note || "",
          tags: Array.isArray(override.tags) ? override.tags : [],
          links: buildLinks(work, userId)
        };
      })
      .sort(function (a, b) {
        if ((b.year || 0) !== (a.year || 0)) {
          return (b.year || 0) - (a.year || 0);
        }
        return (b.citations || 0) - (a.citations || 0);
      });
  }

  function arcById(curation) {
    var map = {};
    (curation.arcs || []).forEach(function (arc) {
      map[arc.id] = arc;
    });
    return map;
  }

  function groupByYear(works) {
    var grouped = {};
    works.forEach(function (work) {
      var year = work.year || "Undated";
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(work);
    });
    return grouped;
  }

  function workPrimaryLink(work) {
    if (!work.links || !work.links.length) {
      return "";
    }

    var direct = work.links.find(function (link) {
      return link.label === "Paper";
    });

    return (direct || work.links[0]).href;
  }

  function totalCitations(works) {
    return works.reduce(function (sum, work) {
      return sum + Number(work.citations || 0);
    }, 0);
  }

  async function loadData() {
    if (cache) {
      return cache;
    }

    var responses = await Promise.all([fetch(RAW_DATA_URL), fetch(CURATION_URL)]);
    var rawResponse = responses[0];
    var curationResponse = responses[1];

    if (!rawResponse.ok) {
      throw new Error("Failed to load " + RAW_DATA_URL + ": " + rawResponse.status);
    }

    if (!curationResponse.ok) {
      throw new Error("Failed to load " + CURATION_URL + ": " + curationResponse.status);
    }

    var raw = await rawResponse.json();
    var curation = await curationResponse.json();
    var works = normalizeWorks(raw, curation);

    cache = {
      raw: raw,
      curation: curation,
      works: works,
      arcMap: arcById(curation),
      fetchedLabel: formatDate(raw.fetched_at),
      stats: {
        works: works.length,
        citations: totalCitations(works),
        years: yearsRange(works),
        arcs: new Set(
          works.map(function (work) {
            return work.arc;
          })
        ).size
      }
    };

    return cache;
  }

  window.ResearchCore = {
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    formatNumber: formatNumber,
    groupByYear: groupByYear,
    loadData: loadData,
    workPrimaryLink: workPrimaryLink
  };
})();
