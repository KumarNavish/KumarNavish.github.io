(function () {
  "use strict";

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = value || "";
    }
  }

  function renderHero(data) {
    var site = data.curation.site || {};

    setText("home-kicker", site.kicker || "Research Portfolio");
    setText("home-title", site.name || data.raw.profile.name || "Research");
    setText("home-statement", site.statement || "");
    setText("home-context", (site.role || data.raw.profile.affiliation || "") + (site.context ? " | " + site.context : ""));

    setText("home-stat-works", data.stats.works);
    setText("home-stat-citations", window.ResearchCore.formatNumber(data.stats.citations));
    setText("home-stat-years", data.stats.years);

    var scholarLink = document.getElementById("home-scholar-link");
    if (scholarLink) {
      scholarLink.href = site.scholar_url || data.raw.source || "#";
    }
  }

  function renderPrinciples(data) {
    var root = document.getElementById("home-principles");
    if (!root) {
      return;
    }

    var principles = data.curation.principles || [];

    root.innerHTML = principles
      .map(function (item) {
        return (
          '<article class="intentional-principle intentional-reveal">' +
            '<h3>' + window.ResearchCore.escapeHtml(item.title) + '</h3>' +
            '<p>' + window.ResearchCore.escapeHtml(item.text) + '</p>' +
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
      .map(function (arc) {
        var inArc = worksByArc[arc.id] || [];
        var keyWorks = inArc
          .slice(0, 2)
          .map(function (work) {
            var link = window.ResearchCore.workPrimaryLink(work);
            var title = window.ResearchCore.escapeHtml(work.title);
            if (!link) {
              return '<li>' + title + '</li>';
            }
            return '<li><a href="' + window.ResearchCore.escapeHtml(link) + '" target="_blank" rel="noreferrer">' + title + '</a></li>';
          })
          .join("");

        return (
          '<article class="intentional-arc intentional-reveal">' +
            '<header class="intentional-arc-head">' +
              '<h3>' + window.ResearchCore.escapeHtml(arc.name) + '</h3>' +
              '<span>' + inArc.length + (inArc.length === 1 ? ' work' : ' works') + '</span>' +
            '</header>' +
            '<p class="intentional-arc-thesis">' + window.ResearchCore.escapeHtml(arc.thesis || "") + '</p>' +
            '<p class="intentional-arc-meta"><strong>Methods:</strong> ' + window.ResearchCore.escapeHtml(arc.methods || "") + '</p>' +
            '<p class="intentional-arc-meta"><strong>Practice:</strong> ' + window.ResearchCore.escapeHtml(arc.practice || "") + '</p>' +
            '<ul class="intentional-arc-works">' + keyWorks + '</ul>' +
            '<a class="intentional-inline-link" href="/publications/?arc=' + window.ResearchCore.escapeHtml(arc.id) + '">View all in this arc</a>' +
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
        var safeTitle = window.ResearchCore.escapeHtml(work.title);

        var links = (work.links || [])
          .map(function (link) {
            return '<a href="' + window.ResearchCore.escapeHtml(link.href) + '" target="_blank" rel="noreferrer">' + window.ResearchCore.escapeHtml(link.label) + '</a>';
          })
          .join("");

        return (
          '<article class="intentional-work intentional-reveal">' +
            '<div class="intentional-work-top">' +
              '<span class="intentional-chip">' + window.ResearchCore.escapeHtml(arc.name) + '</span>' +
              '<span class="intentional-year">' + window.ResearchCore.escapeHtml(work.year) + '</span>' +
            '</div>' +
            '<h3>' + (primary ? '<a href="' + window.ResearchCore.escapeHtml(primary) + '" target="_blank" rel="noreferrer">' + safeTitle + '</a>' : safeTitle) + '</h3>' +
            '<p class="intentional-summary">' + window.ResearchCore.escapeHtml(work.summary) + '</p>' +
            '<p class="intentional-detail"><strong>Contribution:</strong> ' + window.ResearchCore.escapeHtml(work.contribution) + '</p>' +
            '<p class="intentional-detail"><strong>Build:</strong> ' + window.ResearchCore.escapeHtml(work.build) + '</p>' +
            '<p class="intentional-detail"><strong>Practice:</strong> ' + window.ResearchCore.escapeHtml(work.impact) + '</p>' +
            '<div class="intentional-links">' + links + '</div>' +
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
        var yearWorks = data.works.filter(function (work) {
          return String(work.year || "") === String(item.year || "");
        });

        var workLinks = yearWorks
          .map(function (work) {
            var href = window.ResearchCore.workPrimaryLink(work);
            var title = window.ResearchCore.escapeHtml(work.title);
            if (!href) {
              return '<li>' + title + '</li>';
            }
            return '<li><a href="' + window.ResearchCore.escapeHtml(href) + '" target="_blank" rel="noreferrer">' + title + '</a></li>';
          })
          .join("");

        return (
          '<li class="intentional-step intentional-reveal">' +
            '<div class="intentional-step-year">' + window.ResearchCore.escapeHtml(item.year) + '</div>' +
            '<div class="intentional-step-body">' +
              '<h3>' + window.ResearchCore.escapeHtml(item.title || "") + '</h3>' +
              '<p>' + window.ResearchCore.escapeHtml(item.note || "") + '</p>' +
              (workLinks ? '<ul class="intentional-step-works">' + workLinks + '</ul>' : '') +
            '</div>' +
          '</li>'
        );
      })
      .join("");
  }

  function renderSyncNote(data) {
    var text = "Data source: Google Scholar profile BFCHfngAAAAJ.";
    if (data.fetchedLabel) {
      text += " Last synchronized on " + data.fetchedLabel + ".";
    }
    setText("home-sync", text);
  }

  function applyReveal() {
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
      renderPrinciples(data);
      renderArcs(data);
      renderFeatured(data);
      renderProgression(data);
      renderSyncNote(data);
      applyReveal();
    } catch (error) {
      console.error(error);
      app.innerHTML = "<p class=\"intentional-error\">Unable to load research content. Check /assets/data/works_raw.json and /assets/data/research-curation.json.</p>";
    }
  }

  init();
})();
