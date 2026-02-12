(function () {
  "use strict";

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = value || "";
    }
  }

  function escape(value) {
    return window.ResearchCore.escapeHtml(value);
  }

  function toText(value) {
    return String(value || "").trim();
  }

  function getOverview(data) {
    return data.curation.overview || {};
  }

  function workYear(work) {
    return work.year ? String(work.year) : "Undated";
  }

  function renderHero(data) {
    var site = data.curation.site || {};
    var overview = getOverview(data);

    setText("home-kicker", overview.hero_byline || site.name || data.raw.profile.name || "Research Portfolio");
    setText("home-title", overview.hero_title || site.statement || site.name || "Research");
    setText("home-statement", overview.hero_subtitle || site.context || "");
    setText("home-identity-line", overview.identity_line || site.context || "");
    setText("home-context", overview.hero_context || "");
    setText("home-scroll-note", overview.scroll_note || "");
    setText("home-method-thesis", overview.method_thesis || overview.identity_line || "");
    setText("home-invite", overview.closing_invite || "");

    setText("home-stat-works", String(data.stats.works));
    setText("home-stat-citations", window.ResearchCore.formatNumber(data.stats.citations));
    setText("home-stat-years", data.stats.years);

    var scholarLink = document.getElementById("home-scholar-link");
    if (scholarLink) {
      scholarLink.href = site.scholar_url || data.raw.source || "#";
    }
  }

  function renderPillars(data) {
    var root = document.getElementById("home-pillars");
    if (!root) {
      return;
    }

    var signature = getOverview(data).signature || [];
    if (!signature.length) {
      signature = (data.curation.frames || []).slice(0, 3).map(function (item) {
        return { title: item.title, text: item.text };
      });
    }

    root.innerHTML = signature
      .map(function (item) {
        return (
          '<li class="overview-v7-pillar intentional-reveal">' +
            '<h3>' + escape(item.title) + '</h3>' +
            '<p>' + escape(item.text) + '</p>' +
          "</li>"
        );
      })
      .join("");
  }

  function renderLogic(data) {
    var root = document.getElementById("home-logic");
    if (!root) {
      return;
    }

    var logic = data.curation.logic || [];

    root.innerHTML = logic
      .map(function (item, index) {
        return (
          '<article class="overview-v7-logic-step intentional-reveal">' +
            '<p class="overview-v7-index">' + String(index + 1).padStart(2, "0") + "</p>" +
            "<h3>" + escape(item.title) + "</h3>" +
            "<p>" + escape(item.text) + "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderQuestions(data) {
    var root = document.getElementById("home-questions");
    if (!root) {
      return;
    }

    var questions = getOverview(data).questions || [];
    if (!questions.length) {
      questions = (data.curation.arcs || []).map(function (arc) {
        return arc.thesis;
      });
    }

    root.innerHTML = questions
      .map(function (question, index) {
        return (
          '<li class="overview-v7-question intentional-reveal">' +
            '<span class="overview-v7-question-index">Q' + String(index + 1) + "</span>" +
            "<p>" + escape(question) + "</p>" +
          "</li>"
        );
      })
      .join("");
  }

  function pickArcAnchor(worksInArc) {
    var sorted = worksInArc.slice().sort(function (a, b) {
      if ((b.citations || 0) !== (a.citations || 0)) {
        return (b.citations || 0) - (a.citations || 0);
      }
      return (b.year || 0) - (a.year || 0);
    });

    return sorted[0] || null;
  }

  function renderArcs(data) {
    var root = document.getElementById("home-arcs");
    if (!root) {
      return;
    }

    var worksByArc = {};
    data.works.forEach(function (work) {
      if (!worksByArc[work.arc]) {
        worksByArc[work.arc] = [];
      }
      worksByArc[work.arc].push(work);
    });

    root.innerHTML = (data.curation.arcs || [])
      .filter(function (arc) {
        return Boolean(worksByArc[arc.id] && worksByArc[arc.id].length);
      })
      .map(function (arc, index) {
        var inArc = worksByArc[arc.id] || [];
        var countLabel = inArc.length === 1 ? "1 work" : String(inArc.length) + " works";
        var anchor = pickArcAnchor(inArc);
        var anchorLink = anchor ? window.ResearchCore.workPrimaryLink(anchor) : "";

        return (
          '<article class="overview-v7-arc intentional-reveal">' +
            '<header class="overview-v7-arc-head">' +
              '<p class="overview-v7-index">' + String(index + 1).padStart(2, "0") + "</p>" +
              "<h3>" + escape(arc.name) + "</h3>" +
              '<span class="overview-v7-arc-count">' + countLabel + "</span>" +
            "</header>" +
            '<p class="overview-v7-arc-thesis">' + escape(arc.thesis || "") + "</p>" +
            '<p class="overview-v7-arc-line"><strong>Methods:</strong> ' + escape(arc.methods || "") + "</p>" +
            '<p class="overview-v7-arc-line"><strong>Practice:</strong> ' + escape(arc.practice || "") + "</p>" +
            (anchor
              ? '<p class="overview-v7-arc-anchor"><span>Anchor:</span> ' +
                (anchorLink
                  ? '<a href="' + escape(anchorLink) + '" target="_blank" rel="noreferrer">' + escape(anchor.title) + "</a>"
                  : escape(anchor.title)) +
                "</p>"
              : "") +
            '<a class="intentional-link" href="/publications/?arc=' + escape(arc.id) + '">Trace in Archive</a>' +
          "</article>"
        );
      })
      .join("");
  }

  function arcLeadingWork(data, arcId) {
    var pool = data.works
      .filter(function (work) {
        return work.arc === arcId;
      })
      .sort(function (a, b) {
        if ((b.year || 0) !== (a.year || 0)) {
          return (b.year || 0) - (a.year || 0);
        }
        return (b.citations || 0) - (a.citations || 0);
      });

    return pool[0] || null;
  }

  function selectEvidenceWorks(data) {
    var selected = [];
    var selectedMap = {};

    (data.curation.arcs || []).forEach(function (arc) {
      if (selected.length >= 3) {
        return;
      }

      var lead = arcLeadingWork(data, arc.id);
      if (lead && !selectedMap[lead.id]) {
        selected.push(lead);
        selectedMap[lead.id] = true;
      }
    });

    var featured = data.works.filter(function (work) {
      return Boolean(work.featured);
    });

    featured.forEach(function (work) {
      if (selected.length >= 3 || selectedMap[work.id]) {
        return;
      }
      selected.push(work);
      selectedMap[work.id] = true;
    });

    data.works.forEach(function (work) {
      if (selected.length >= 3 || selectedMap[work.id]) {
        return;
      }
      selected.push(work);
      selectedMap[work.id] = true;
    });

    return selected.slice(0, 3);
  }

  function spotlightAxis(label, value) {
    var text = toText(value);
    if (!text) {
      return "";
    }

    return "<p><strong>" + escape(label) + ":</strong> " + escape(text) + "</p>";
  }

  function workLinks(work) {
    var links = (work.links || [])
      .map(function (link) {
        return '<a href="' + escape(link.href) + '" target="_blank" rel="noreferrer">' + escape(link.label) + "</a>";
      })
      .join("");

    return links ? '<div class="intentional-work-links">' + links + "</div>" : "";
  }

  function renderEvidenceSpotlight(work, arcName) {
    var primary = window.ResearchCore.workPrimaryLink(work);
    var axis =
      spotlightAxis("Reasoning", work.contribution) +
      spotlightAxis("System", work.build) +
      spotlightAxis("Relevance", work.impact);

    return (
      '<article class="overview-v7-spotlight intentional-reveal">' +
        '<p class="overview-v7-evidence-meta">' + escape(arcName) + " | " + escape(workYear(work)) + " | cited by " + window.ResearchCore.formatNumber(work.citations || 0) + "</p>" +
        "<h3>" + (primary
          ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + "</a>"
          : escape(work.title)) + "</h3>" +
        '<p class="overview-v7-evidence-summary">' + escape(work.summary) + "</p>" +
        (axis ? '<div class="overview-v7-spotlight-axis">' + axis + "</div>" : "") +
        workLinks(work) +
      "</article>"
    );
  }

  function renderEvidenceItem(work, arcName) {
    var primary = window.ResearchCore.workPrimaryLink(work);
    return (
      '<article class="overview-v7-evidence-item intentional-reveal">' +
        '<p class="overview-v7-evidence-meta">' + escape(arcName) + " | " + escape(workYear(work)) + "</p>" +
        "<h3>" + (primary
          ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + "</a>"
          : escape(work.title)) + "</h3>" +
        "<p>" + escape(work.summary) + "</p>" +
      "</article>"
    );
  }

  function renderFeatured(data) {
    var root = document.getElementById("home-featured");
    if (!root) {
      return;
    }

    var selected = selectEvidenceWorks(data);
    if (!selected.length) {
      root.innerHTML = "";
      return;
    }

    var spotlight = selected[0];
    var supporting = selected.slice(1);
    var spotlightArc = data.arcMap[spotlight.arc] || { name: "Unsorted" };

    root.innerHTML =
      renderEvidenceSpotlight(spotlight, spotlightArc.name) +
      '<div class="overview-v7-evidence-list">' +
        supporting
          .map(function (work) {
            var arc = data.arcMap[work.arc] || { name: "Unsorted" };
            return renderEvidenceItem(work, arc.name);
          })
          .join("") +
      "</div>";
  }

  function renderProgression(data) {
    var root = document.getElementById("home-progression");
    if (!root) {
      return;
    }

    var timeline = data.curation.timeline || [];
    if (!timeline.length) {
      timeline = data.works
        .slice()
        .reverse()
        .map(function (work) {
          return {
            year: work.year,
            title: work.title,
            note: work.timelineNote || work.summary
          };
        });
    }

    root.innerHTML = timeline
      .map(function (item) {
        return (
          '<li class="overview-v7-progress-item intentional-reveal">' +
            '<div class="overview-v7-progress-year">' + escape(item.year) + "</div>" +
            "<div>" +
              "<h3>" + escape(item.title) + "</h3>" +
              "<p>" + escape(item.note) + "</p>" +
            "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function renderSync(data) {
    var note = "Source: Google Scholar profile BFCHfngAAAAJ.";
    if (data.fetchedLabel) {
      note += " Last synchronized on " + data.fetchedLabel + ".";
    }
    setText("home-sync", note);
  }

  function reveal() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(".intentional-reveal"));

    nodes.forEach(function (node, index) {
      node.style.transitionDelay = String(Math.min(index * 0.04, 0.26)) + "s";
    });

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (node) {
        node.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    nodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  async function init() {
    var app = document.getElementById("intentional-home");
    if (!app || !window.ResearchCore) {
      return;
    }

    try {
      var data = await window.ResearchCore.loadData();
      renderHero(data);
      renderPillars(data);
      renderLogic(data);
      renderQuestions(data);
      renderArcs(data);
      renderFeatured(data);
      renderProgression(data);
      renderSync(data);
      reveal();
    } catch (error) {
      console.error(error);
      app.innerHTML = '<p class="intentional-error">Unable to load portfolio data. Check assets/data/works_raw.json and assets/data/research-curation.json.</p>';
    }
  }

  init();
})();
