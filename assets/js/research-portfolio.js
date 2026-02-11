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

  function renderHero(data) {
    var site = data.curation.site || {};
    var overview = data.curation.overview || {};

    setText("home-kicker", overview.hero_byline || site.name || data.raw.profile.name || "Research Portfolio");
    setText("home-title", overview.hero_title || site.statement || site.name || "Research");
    setText("home-statement", overview.hero_subtitle || site.context || "");
    setText("home-context", overview.hero_context || "");
    setText("home-identity-line", overview.identity_line || site.context || "");
    setText("home-scroll-note", overview.scroll_note || "");
    setText("home-invite", overview.closing_invite || "");

    setText("home-stat-works", String(data.stats.works));
    setText("home-stat-citations", window.ResearchCore.formatNumber(data.stats.citations));
    setText("home-stat-years", data.stats.years);

    var scholarLink = document.getElementById("home-scholar-link");
    if (scholarLink) {
      scholarLink.href = site.scholar_url || data.raw.source || "#";
    }
  }

  function renderSignature(data) {
    var root = document.getElementById("home-signature");
    if (!root) {
      return;
    }

    var overview = data.curation.overview || {};
    var signature = overview.signature || [];

    if (!signature.length) {
      signature = (data.curation.frames || []).slice(0, 3).map(function (item) {
        return {
          title: item.title,
          text: item.text
        };
      });
    }

    root.innerHTML = signature
      .map(function (item) {
        return (
          '<li class="overview-v3-signature-item intentional-reveal">' +
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
        return (
          '<article class="overview-v3-logic-step intentional-reveal">' +
            '<p class="overview-v3-step-index">' + String(index + 1).padStart(2, "0") + '</p>' +
            '<h3>' + escape(item.title) + '</h3>' +
            '<p>' + escape(item.text) + '</p>' +
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

    var overview = data.curation.overview || {};
    var questions = overview.questions || [];

    if (!questions.length) {
      questions = (data.curation.arcs || []).map(function (arc) {
        return arc.thesis;
      });
    }

    root.innerHTML = questions
      .map(function (question, index) {
        return (
          '<article class="overview-v3-question intentional-reveal">' +
            '<p class="overview-v3-step-index">Q' + String(index + 1) + '</p>' +
            '<p>' + escape(question) + '</p>' +
          '</article>'
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
          '<article class="overview-v3-arc intentional-reveal">' +
            '<header class="overview-v3-arc-head">' +
              '<p class="overview-v3-step-index">' + String(index + 1).padStart(2, "0") + '</p>' +
              '<h3>' + escape(arc.name) + '</h3>' +
              '<span>' + inArc.length + ' works</span>' +
            '</header>' +
            '<p class="overview-v3-arc-line">' + escape(arc.thesis || "") + '</p>' +
            '<p class="overview-v3-arc-line"><strong>Methods:</strong> ' + escape(arc.methods || "") + '</p>' +
            '<p class="overview-v3-arc-line"><strong>Practice:</strong> ' + escape(arc.practice || "") + '</p>' +
            (anchor
              ? '<p class="overview-v3-arc-anchor"><span>Anchor work:</span> ' +
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

    root.innerHTML = featured
      .map(function (work) {
        var arc = data.arcMap[work.arc] || { name: "Unsorted" };
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
          '<article class="overview-v3-work intentional-reveal">' +
            '<div class="overview-v3-work-head">' +
              '<span class="intentional-chip">' + escape(arc.name) + '</span>' +
              '<span class="overview-v3-work-meta">' + escape(work.year) + ' | cited by ' + window.ResearchCore.formatNumber(work.citations) + '</span>' +
            '</div>' +
            '<h3>' + (primary
              ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + '</a>'
              : escape(work.title)) + '</h3>' +
            '<p class="overview-v3-work-summary">' + escape(work.summary) + '</p>' +
            '<dl class="overview-v3-work-axis">' +
              (reasoning ? '<div><dt>Reasoning</dt><dd>' + escape(reasoning) + '</dd></div>' : "") +
              (system ? '<div><dt>System</dt><dd>' + escape(system) + '</dd></div>' : "") +
              (relevance ? '<div><dt>Relevance</dt><dd>' + escape(relevance) + '</dd></div>' : "") +
            '</dl>' +
            '<div class="intentional-work-links">' + links + '</div>' +
          '</article>'
        );
      })
      .join("");
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
          '<li class="overview-v3-progress-item intentional-reveal">' +
            '<div class="overview-v3-progress-year">' + escape(item.year) + '</div>' +
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
      node.style.transitionDelay = String(Math.min(index * 0.04, 0.24)) + "s";
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
      renderSignature(data);
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
