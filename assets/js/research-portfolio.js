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

  function renderHero(data) {
    var site = data.curation.site || {};
    var overview = data.curation.overview || {};

    setText("home-kicker", site.kicker || "Research Portfolio");
    setText("home-title", site.name || data.raw.profile.name || "Research");
    setText("home-statement", site.statement || "");
    setText("home-context", site.context || data.raw.profile.affiliation || "");
    setText("home-scroll-note", overview.scroll_note || "");

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
      signature = (data.curation.frames || [])
        .slice(0, 3)
        .map(function (frame) {
          return {
            title: frame.title,
            text: frame.text
          };
        });
    }

    root.innerHTML = signature
      .map(function (item) {
        return (
          '<li class="overview-signature-item">' +
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
        var step = String(index + 1).padStart(2, "0");
        return (
          '<article class="overview-logic-step intentional-reveal">' +
            '<span class="overview-step-index">' + step + '</span>' +
            '<h3>' + escape(item.title) + '</h3>' +
            '<p>' + escape(item.text) + '</p>' +
          '</article>'
        );
      })
      .join("");
  }

  function renderThesis(data) {
    var overview = data.curation.overview || {};
    var thesis = overview.thesis || (data.curation.site && data.curation.site.context) || "";
    setText("home-thesis", thesis);
  }

  function renderFrames(data) {
    var root = document.getElementById("home-frames");
    if (!root) {
      return;
    }

    var frames = data.curation.frames || data.curation.principles || [];

    root.innerHTML = frames
      .map(function (item) {
        return (
          '<article class="overview-frame intentional-reveal">' +
            '<h3>' + escape(item.title) + '</h3>' +
            '<p>' + escape(item.text) + '</p>' +
          '</article>'
        );
      })
      .join("");
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
        var examples = inArc
          .slice(0, 2)
          .map(function (work) {
            var link = window.ResearchCore.workPrimaryLink(work);
            var title = escape(work.title);
            if (!link) {
              return '<li>' + title + '</li>';
            }
            return '<li><a href="' + escape(link) + '" target="_blank" rel="noreferrer">' + title + '</a></li>';
          })
          .join("");

        return (
          '<article class="overview-arc intentional-reveal">' +
            '<div class="overview-arc-head">' +
              '<span class="overview-step-index">' + String(index + 1).padStart(2, "0") + '</span>' +
              '<h3>' + escape(arc.name) + '</h3>' +
              '<span class="overview-arc-count">' + inArc.length + ' works</span>' +
            '</div>' +
            '<p class="overview-arc-text">' + escape(arc.thesis || "") + '</p>' +
            '<p class="overview-arc-text"><strong>Methods:</strong> ' + escape(arc.methods || "") + '</p>' +
            '<p class="overview-arc-text"><strong>Practice:</strong> ' + escape(arc.practice || "") + '</p>' +
            '<ul class="overview-arc-examples">' + examples + '</ul>' +
            '<a class="intentional-link" href="/publications/?arc=' + escape(arc.id) + '">Open Arc</a>' +
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

    root.innerHTML = featured
      .map(function (work) {
        var arc = data.arcMap[work.arc] || { name: "Unsorted" };
        var primary = window.ResearchCore.workPrimaryLink(work);

        var links = (work.links || [])
          .map(function (link) {
            return '<a href="' + escape(link.href) + '" target="_blank" rel="noreferrer">' + escape(link.label) + '</a>';
          })
          .join("");

        return (
          '<article class="intentional-work intentional-reveal">' +
            '<div class="intentional-work-top">' +
              '<span class="intentional-chip">' + escape(arc.name) + '</span>' +
              '<span class="overview-work-meta">' + escape(work.year) + ' | cited by ' + window.ResearchCore.formatNumber(work.citations) + '</span>' +
            '</div>' +
            '<h3>' + (primary ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + '</a>' : escape(work.title)) + '</h3>' +
            '<p>' + escape(work.summary) + '</p>' +
            '<p><strong>Reasoning:</strong> ' + escape(work.contribution) + '</p>' +
            '<p><strong>System:</strong> ' + escape(work.build) + '</p>' +
            '<p><strong>Relevance:</strong> ' + escape(work.impact) + '</p>' +
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
          '<li class="intentional-step overview-step intentional-reveal">' +
            '<div class="intentional-step-year">' + escape(item.year) + '</div>' +
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
    var nodes = document.querySelectorAll(".intentional-reveal");
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
      { threshold: 0.13 }
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
      renderThesis(data);
      renderFrames(data);
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
