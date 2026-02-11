(function () {
  "use strict";

  var state = {
    query: "",
    arc: "all"
  };

  var currentData = null;

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = value || "";
    }
  }

  function parseArcFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get("arc") || "all";
    } catch (error) {
      return "all";
    }
  }

  function renderTop(data) {
    setText("archive-sync", data.fetchedLabel ? "Source synchronized on " + data.fetchedLabel + "." : "Source synchronized from Google Scholar.");
    setText("archive-stat-works", String(data.stats.works));
    setText("archive-stat-citations", window.ResearchCore.formatNumber(data.stats.citations));
    setText("archive-stat-arcs", String(data.stats.arcs));
  }

  function matchesQuery(work, query) {
    if (!query) {
      return true;
    }

    var haystack = [
      work.title,
      work.authors,
      work.venue,
      work.summary,
      work.contribution,
      work.build,
      work.impact,
      (work.tags || []).join(" ")
    ]
      .join(" ")
      .toLowerCase();

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every(function (token) {
        return haystack.indexOf(token) >= 0;
      });
  }

  function filteredWorks() {
    return currentData.works.filter(function (work) {
      var arcOk = state.arc === "all" || work.arc === state.arc;
      var queryOk = matchesQuery(work, state.query);
      return arcOk && queryOk;
    });
  }

  function renderFilters() {
    var root = document.getElementById("archive-filters");
    if (!root || !currentData) {
      return;
    }

    var counts = {};
    currentData.works.forEach(function (work) {
      counts[work.arc] = (counts[work.arc] || 0) + 1;
    });

    var buttons = [
      {
        id: "all",
        label: "All",
        count: currentData.works.length
      }
    ];

    (currentData.curation.arcs || []).forEach(function (arc) {
      if (counts[arc.id]) {
        buttons.push({
          id: arc.id,
          label: arc.name,
          count: counts[arc.id]
        });
      }
    });

    root.innerHTML = buttons
      .map(function (button) {
        var active = button.id === state.arc ? " active" : "";
        return (
          '<button class="intentional-filter' + active + '" type="button" data-filter="' + window.ResearchCore.escapeHtml(button.id) + '">' +
            '<span>' + window.ResearchCore.escapeHtml(button.label) + '</span>' +
            '<em>' + button.count + '</em>' +
          '</button>'
        );
      })
      .join("");

    root.querySelectorAll("button").forEach(function (button) {
      button.addEventListener("click", function () {
        state.arc = button.dataset.filter || "all";
        renderFilters();
        renderList();
      });
    });
  }

  function renderList() {
    var root = document.getElementById("archive-list");
    var empty = document.getElementById("archive-empty");
    if (!root || !currentData) {
      return;
    }

    var works = filteredWorks();

    if (!works.length) {
      root.innerHTML = "";
      if (empty) {
        empty.hidden = false;
      }
      return;
    }

    if (empty) {
      empty.hidden = true;
    }

    var grouped = window.ResearchCore.groupByYear(works);
    var years = Object.keys(grouped).sort(function (a, b) {
      if (a === "Undated") {
        return 1;
      }
      if (b === "Undated") {
        return -1;
      }
      return Number(b) - Number(a);
    });

    root.innerHTML = years
      .map(function (year) {
        var entries = grouped[year]
          .sort(function (a, b) {
            return (b.citations || 0) - (a.citations || 0);
          })
          .map(function (work) {
            var arc = currentData.arcMap[work.arc] || { name: "Unsorted" };
            var primary = window.ResearchCore.workPrimaryLink(work);
            var title = window.ResearchCore.escapeHtml(work.title);
            var links = (work.links || [])
              .map(function (link) {
                return '<a href="' + window.ResearchCore.escapeHtml(link.href) + '" target="_blank" rel="noreferrer">' + window.ResearchCore.escapeHtml(link.label) + '</a>';
              })
              .join("");

            var tags = work.tags && work.tags.length
              ? '<p class="intentional-item-tags">' + work.tags.map(window.ResearchCore.escapeHtml).join(" | ") + '</p>'
              : "";

            return (
              '<article class="intentional-item">' +
                '<header class="intentional-item-head">' +
                  '<span class="intentional-chip">' + window.ResearchCore.escapeHtml(arc.name) + '</span>' +
                  '<span class="intentional-citations">Cited by ' + window.ResearchCore.formatNumber(work.citations) + '</span>' +
                '</header>' +
                '<h3>' + (primary ? '<a href="' + window.ResearchCore.escapeHtml(primary) + '" target="_blank" rel="noreferrer">' + title + '</a>' : title) + '</h3>' +
                '<p class="intentional-item-meta">' + window.ResearchCore.escapeHtml(work.authors) + '</p>' +
                '<p class="intentional-item-meta">' + window.ResearchCore.escapeHtml(work.venue) + '</p>' +
                '<p class="intentional-summary">' + window.ResearchCore.escapeHtml(work.summary) + '</p>' +
                (work.contribution ? '<p class="intentional-detail"><strong>Contribution:</strong> ' + window.ResearchCore.escapeHtml(work.contribution) + '</p>' : '') +
                (work.build ? '<p class="intentional-detail"><strong>Build:</strong> ' + window.ResearchCore.escapeHtml(work.build) + '</p>' : '') +
                (work.impact ? '<p class="intentional-detail"><strong>Practice:</strong> ' + window.ResearchCore.escapeHtml(work.impact) + '</p>' : '') +
                tags +
                '<div class="intentional-links">' + links + '</div>' +
              '</article>'
            );
          })
          .join("");

        return (
          '<section class="intentional-year-group">' +
            '<h3 class="intentional-year-title">' + window.ResearchCore.escapeHtml(year) + '</h3>' +
            '<div class="intentional-year-items">' + entries + '</div>' +
          '</section>'
        );
      })
      .join("");
  }

  function wireSearch() {
    var input = document.getElementById("archive-search");
    if (!input) {
      return;
    }

    input.addEventListener("input", function () {
      state.query = input.value || "";
      renderList();
    });
  }

  async function init() {
    var app = document.getElementById("intentional-archive");
    if (!app || !window.ResearchCore) {
      return;
    }

    try {
      currentData = await window.ResearchCore.loadData();
      state.arc = parseArcFromUrl();

      var arcExists = state.arc === "all" || Boolean(currentData.arcMap[state.arc]);
      if (!arcExists) {
        state.arc = "all";
      }

      renderTop(currentData);
      wireSearch();
      renderFilters();
      renderList();
    } catch (error) {
      console.error(error);
      app.innerHTML = "<p class=\"intentional-error\">Unable to load publication archive. Check /assets/data/works_raw.json and /assets/data/research-curation.json.</p>";
    }
  }

  init();
})();
