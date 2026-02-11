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

  function renderHero(data) {
    var site = data.curation.site || {};
    var overview = getOverview(data);

    setText("home-kicker", overview.hero_byline || site.name || data.raw.profile.name || "Research Portfolio");
    setText("home-title", overview.hero_title || site.statement || site.name || "Research");
    setText("home-statement", overview.hero_subtitle || site.context || "");
    setText("home-context", overview.hero_context || "");
    setText("home-identity-line", overview.identity_line || site.context || "");
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
          '<li class="overview-v4-pillar intentional-reveal">' +
            '<h3>' + escape(item.title) + '</h3>' +
            '<p>' + escape(item.text) + '</p>' +
          '</li>'
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
        var connector = index < logic.length - 1 ? '<span class="overview-v4-logic-connector" aria-hidden="true"></span>' : "";
        return (
          '<article class="overview-v4-logic-step intentional-reveal">' +
            '<p class="overview-v4-step-index">' + String(index + 1).padStart(2, "0") + '</p>' +
            '<h3>' + escape(item.title) + '</h3>' +
            '<p>' + escape(item.text) + '</p>' +
            connector +
          '</article>'
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
          '<li class="overview-v4-question intentional-reveal">' +
            '<span class="overview-v4-question-index">Q' + String(index + 1) + '</span>' +
            '<p>' + escape(question) + '</p>' +
          '</li>'
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
        var anchor = pickArcAnchor(inArc);
        var anchorLink = anchor ? window.ResearchCore.workPrimaryLink(anchor) : "";

        return (
          '<article class="overview-v4-arc intentional-reveal">' +
            '<header class="overview-v4-arc-head">' +
              '<p class="overview-v4-step-index">' + String(index + 1).padStart(2, "0") + '</p>' +
              '<h3>' + escape(arc.name) + '</h3>' +
              '<span>' + inArc.length + ' works</span>' +
            '</header>' +
            '<p class="overview-v4-arc-thesis">' + escape(arc.thesis || "") + '</p>' +
            '<p class="overview-v4-arc-line"><strong>Methods:</strong> ' + escape(arc.methods || "") + '</p>' +
            '<p class="overview-v4-arc-line"><strong>Practice:</strong> ' + escape(arc.practice || "") + '</p>' +
            (anchor
              ? '<p class="overview-v4-arc-anchor"><span>Anchor work:</span> ' +
                (anchorLink
                  ? '<a href="' + escape(anchorLink) + '" target="_blank" rel="noreferrer">' + escape(anchor.title) + '</a>'
                  : escape(anchor.title)) +
                '</p>'
              : "") +
            '<a class="intentional-link" href="/publications/?arc=' + escape(arc.id) + '">Open Program</a>' +
          '</article>'
        );
      })
      .join("");
  }

  function evidenceSpotlight(work, arcName) {
    var primary = window.ResearchCore.workPrimaryLink(work);
    var reasoning = toText(work.contribution);
    var system = toText(work.build);
    var relevance = toText(work.impact);

    var links = (work.links || [])
      .map(function (link) {
        return '<a href="' + escape(link.href) + '" target="_blank" rel="noreferrer">' + escape(link.label) + '</a>';
      })
      .join("");

    return (
      '<article class="overview-v4-spotlight intentional-reveal">' +
        '<div class="overview-v4-spotlight-meta">' +
          '<span class="intentional-chip">' + escape(arcName) + '</span>' +
          '<span class="overview-v4-work-meta">' + escape(work.year) + ' | cited by ' + window.ResearchCore.formatNumber(work.citations) + '</span>' +
        '</div>' +
        '<h3>' + (primary
          ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + '</a>'
          : escape(work.title)) + '</h3>' +
        '<p class="overview-v4-spotlight-summary">' + escape(work.summary) + '</p>' +
        '<div class="overview-v4-spotlight-axis">' +
          (reasoning ? '<p><strong>Reasoning:</strong> ' + escape(reasoning) + '</p>' : "") +
          (system ? '<p><strong>System:</strong> ' + escape(system) + '</p>' : "") +
          (relevance ? '<p><strong>Relevance:</strong> ' + escape(relevance) + '</p>' : "") +
        '</div>' +
        '<div class="intentional-work-links">' + links + '</div>' +
      '</article>'
    );
  }

  function evidenceCompact(work, arcName) {
    var primary = window.ResearchCore.workPrimaryLink(work);
    return (
      '<article class="overview-v4-compact intentional-reveal">' +
        '<p class="overview-v4-compact-meta">' + escape(arcName) + ' | ' + escape(work.year) + '</p>' +
        '<h3>' + (primary
          ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + '</a>'
          : escape(work.title)) + '</h3>' +
        '<p>' + escape(work.summary) + '</p>' +
      '</article>'
    );
  }

  function renderFeatured(data) {
    var root = document.getElementById("home-featured");
    if (!root) {
      return;
    }

    var featured = data.works.filter(function (work) {
      return work.featured;
    });
    if (!featured.length) {
      featured = data.works.slice(0, 3);
    }

    featured = featured.slice(0, 3);
    if (!featured.length) {
      root.innerHTML = "";
      return;
    }

    var first = featured[0];
    var rest = featured.slice(1);
    var firstArc = data.arcMap[first.arc] || { name: "Unsorted" };

    root.innerHTML =
      evidenceSpotlight(first, firstArc.name) +
      '<div class="overview-v4-compact-grid">' +
        rest
          .map(function (work) {
            var arc = data.arcMap[work.arc] || { name: "Unsorted" };
            return evidenceCompact(work, arc.name);
          })
          .join("") +
      '</div>';
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
          '<li class="overview-v4-progress-item intentional-reveal">' +
            '<div class="overview-v4-progress-year">' + escape(item.year) + '</div>' +
            '<div>' +
              '<h3>' + escape(item.title) + '</h3>' +
              '<p>' + escape(item.note) + '</p>' +
            '</div>' +
          '</li>'
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
      node.style.transitionDelay = String(Math.min(index * 0.045, 0.3)) + "s";
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
      { threshold: 0.15 }
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
