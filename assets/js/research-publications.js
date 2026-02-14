(function () {
  "use strict";

  var state = {
    arc: "all",
    query: ""
  };

  var dataStore = null;

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = value || "";
    }
  }

  function escape(value) {
    return window.ResearchCore.escapeHtml(value);
  }

  function readArcFromUrl() {
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

  function workMatchesQuery(work, query) {
    if (!query) {
      return true;
    }

    var corpus = [
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
        return corpus.indexOf(token) >= 0;
      });
  }

  function filteredWorks() {
    return dataStore.works.filter(function (work) {
      var arcPass = state.arc === "all" || work.arc === state.arc;
      var queryPass = workMatchesQuery(work, state.query);
      return arcPass && queryPass;
    });
  }

  function arcCountMap(works) {
    var counts = {};
    works.forEach(function (work) {
      counts[work.arc] = (counts[work.arc] || 0) + 1;
    });
    return counts;
  }

  function orderedArcIds(works) {
    var counts = arcCountMap(works);
    var known = {};
    var ids = [];

    (dataStore.curation.arcs || []).forEach(function (arc) {
      if (counts[arc.id]) {
        ids.push(arc.id);
        known[arc.id] = true;
      }
    });

    Object.keys(counts).forEach(function (arcId) {
      if (!known[arcId]) {
        ids.push(arcId);
      }
    });

    return ids;
  }

  function renderFilters() {
    var root = document.getElementById("archive-filters");
    if (!root || !dataStore) {
      return;
    }

    var counts = arcCountMap(dataStore.works);

    var options = [
      { id: "all", label: "All", count: dataStore.works.length }
    ];

    (dataStore.curation.arcs || []).forEach(function (arc) {
      if (counts[arc.id]) {
        options.push({ id: arc.id, label: arc.name, count: counts[arc.id] });
      }
    });

    root.innerHTML = options
      .map(function (item) {
        var active = item.id === state.arc ? " active" : "";
        return (
          '<button class="intentional-filter' + active + '" type="button" data-filter="' + escape(item.id) + '">' +
            '<span>' + escape(item.label) + '</span>' +
            '<em>' + item.count + '</em>' +
          '</button>'
        );
      })
      .join("");

    root.querySelectorAll("button").forEach(function (button) {
      button.addEventListener("click", function () {
        state.arc = button.dataset.filter || "all";
        renderFilters();
        renderArcMap();
        renderList();
      });
    });
  }

  function renderArcMap() {
    var root = document.getElementById("archive-arc-map");
    if (!root || !dataStore) {
      return;
    }

    var counts = arcCountMap(dataStore.works);
    var cards = (dataStore.curation.arcs || [])
      .filter(function (arc) {
        return Boolean(counts[arc.id]);
      })
      .map(function (arc) {
        var activeClass = state.arc === arc.id ? " active" : "";
        var buttonLabel = state.arc === arc.id ? "Active" : "Filter";

        return (
          '<article class="intentional-arc-map-card' + activeClass + '">' +
            '<header class="intentional-arc-map-head">' +
              '<h3>' + escape(arc.name) + '</h3>' +
              '<span>' + counts[arc.id] + ' works</span>' +
            '</header>' +
            '<p>' + escape(arc.thesis || "") + '</p>' +
            '<p><strong>Methods:</strong> ' + escape(arc.methods || "") + '</p>' +
            '<p><strong>Practice:</strong> ' + escape(arc.practice || "") + '</p>' +
            '<button type="button" class="intentional-link" data-arc-map="' + escape(arc.id) + '">' + buttonLabel + '</button>' +
          '</article>'
        );
      })
      .join("");

    root.innerHTML = cards;

    root.querySelectorAll("button[data-arc-map]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.arc = button.dataset.arcMap || "all";
        renderFilters();
        renderArcMap();
        renderList();
      });
    });
  }

  function compactSignal(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "";
    }

    var sentence = text.split(/(?<=[.!?])\s+/)[0] || text;
    if (sentence.length > 120) {
      return sentence.slice(0, 117).trimEnd() + "...";
    }

    return sentence;
  }

  function renderWorkItem(work, arc) {
    var primary = window.ResearchCore.workPrimaryLink(work);
    var links = (work.links || [])
      .map(function (link) {
        return '<a href="' + escape(link.href) + '" target="_blank" rel="noreferrer">' + escape(link.label) + '</a>';
      })
      .join("");

    var tags = work.tags && work.tags.length
      ? '<p class="intentional-item-tags">' + work.tags.map(escape).join(" | ") + "</p>"
      : "";

    var signals = [
      { label: "Reasoning", text: compactSignal(work.contribution) },
      { label: "System", text: compactSignal(work.build) },
      { label: "Relevance", text: compactSignal(work.impact) }
    ].filter(function (item) {
      return Boolean(item.text);
    });

    var signalMarkup = signals.length
      ? '<ul class="intentional-item-signals">' + signals.map(function (item) {
          return (
            '<li class="intentional-item-signal">' +
              '<strong>' + escape(item.label) + '</strong>' +
              '<span>' + escape(item.text) + '</span>' +
            '</li>'
          );
        }).join("") + "</ul>"
      : "";

    return (
      '<article class="intentional-item">' +
        '<header class="intentional-item-head">' +
          '<span class="intentional-chip">' + escape(arc.name || "Unsorted") + '</span>' +
          '<span class="intentional-year">Cited by ' + window.ResearchCore.formatNumber(work.citations) + '</span>' +
        '</header>' +
        '<h3>' + (primary ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + '</a>' : escape(work.title)) + '</h3>' +
        '<p class="intentional-item-meta">' + escape(work.authors) + '</p>' +
        '<p class="intentional-item-meta">' + escape(work.venue) + '</p>' +
        '<p class="intentional-item-meta">' + escape(work.summary) + '</p>' +
        signalMarkup +
        tags +
        '<div class="intentional-work-links">' + links + '</div>' +
      "</article>"
    );
  }

  function renderArcSection(arcId, worksInArc) {
    var arc = dataStore.arcMap[arcId] || {
      name: "Unsorted",
      thesis: "",
      methods: "",
      practice: ""
    };

    var grouped = window.ResearchCore.groupByYear(worksInArc);
    var years = Object.keys(grouped).sort(function (a, b) {
      if (a === "Undated") {
        return 1;
      }
      if (b === "Undated") {
        return -1;
      }
      return Number(b) - Number(a);
    });

    var yearMarkup = years
      .map(function (year) {
        var entries = grouped[year]
          .slice()
          .sort(function (a, b) {
            return (b.citations || 0) - (a.citations || 0);
          })
          .map(function (work) {
            return renderWorkItem(work, arc);
          })
          .join("");

        return (
          '<section class="intentional-year-group">' +
            '<h3 class="intentional-year-title">' + escape(year) + "</h3>" +
            '<div class="intentional-year-items">' + entries + "</div>" +
          "</section>"
        );
      })
      .join("");

    return (
      '<section class="intentional-arc-group">' +
        '<header class="intentional-arc-group-head">' +
          '<h3>' + escape(arc.name) + '</h3>' +
          '<span>' + worksInArc.length + ' works</span>' +
        '</header>' +
        (arc.thesis ? '<p class="intentional-arc-group-meta">' + escape(arc.thesis) + '</p>' : "") +
        (arc.methods ? '<p class="intentional-arc-group-meta"><strong>Methods:</strong> ' + escape(arc.methods) + '</p>' : "") +
        (arc.practice ? '<p class="intentional-arc-group-meta"><strong>Practice:</strong> ' + escape(arc.practice) + '</p>' : "") +
        '<div class="intentional-arc-group-list">' + yearMarkup + "</div>" +
      "</section>"
    );
  }

  function renderList() {
    var root = document.getElementById("archive-list");
    var empty = document.getElementById("archive-empty");
    if (!root || !dataStore) {
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

    var byArc = {};
    works.forEach(function (work) {
      if (!byArc[work.arc]) {
        byArc[work.arc] = [];
      }
      byArc[work.arc].push(work);
    });

    var arcIds = orderedArcIds(works);

    root.innerHTML = arcIds
      .map(function (arcId) {
        return renderArcSection(arcId, byArc[arcId]);
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
      dataStore = await window.ResearchCore.loadData();
      state.arc = readArcFromUrl();
      if (state.arc !== "all" && !dataStore.arcMap[state.arc]) {
        state.arc = "all";
      }

      renderTop(dataStore);
      wireSearch();
      renderFilters();
      renderArcMap();
      renderList();
    } catch (error) {
      console.error(error);
      app.innerHTML = '<p class="intentional-error">Unable to load archive data. Check assets/data/works_raw.json and assets/data/research-curation.json.</p>';
    }
  }

  init();
})();
