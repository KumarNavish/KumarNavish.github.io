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

  function compactSentence(value, maxLength) {
    var text = toText(value);
    if (!text) {
      return "";
    }

    var firstSentence = text.split(/\.\s+/)[0].trim();
    if (firstSentence && firstSentence.length <= maxLength) {
      return firstSentence.replace(/[.\s]*$/, "") + ".";
    }

    if (text.length <= maxLength) {
      return text;
    }

    return text.slice(0, Math.max(24, maxLength - 1)).trim().replace(/[,:;\s]+$/, "") + "…";
  }

  function compactWords(value, maxWords, maxLength) {
    var text = toText(value);
    if (!text) {
      return "";
    }

    var words = text
      .replace(/[|]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, Math.max(1, maxWords));

    var phrase = words.join(" ").replace(/[,:;\s]+$/, "");
    if (phrase.length > maxLength) {
      phrase = phrase.slice(0, Math.max(16, maxLength - 1)).trim().replace(/[,:;\s]+$/, "");
    }

    return phrase + (phrase.length < text.length ? "…" : "");
  }

  function getOverview(data) {
    return data.curation.overview || {};
  }

  function setScholarLinks(url) {
    ["home-scholar-link", "home-scholar-link-secondary"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.href = url;
      }
    });
  }

  function renderHero(data) {
    var site = data.curation.site || {};
    var overview = getOverview(data);
    var scholarUrl = site.scholar_url || data.raw.source || "#";

    setText("home-kicker", overview.hero_byline || site.name || data.raw.profile.name || "Research Portfolio");
    setText("home-title", compactSentence(overview.hero_title || site.statement || "Research", 108));
    setText("home-statement", compactSentence(overview.hero_subtitle || site.context || "", 120));
    setText("home-context", compactSentence(overview.hero_context || site.context || "", 90));
    setText("home-identity-line", compactSentence(overview.identity_line || site.context || "", 92));
    setText(
      "home-invite",
      compactSentence(
        overview.closing_invite || "Open the archive to view each work by program, method, and practical use.",
        100
      )
    );

    setText("home-stat-works", String(data.stats.works));
    setText("home-stat-citations", window.ResearchCore.formatNumber(data.stats.citations));
    setText("home-stat-years", data.stats.years);
    setText("home-stat-arcs", String(data.stats.arcs));

    setScholarLinks(scholarUrl);
  }

  function renderPrinciples(data) {
    var root = document.getElementById("home-principles");
    if (!root) {
      return;
    }

    var overview = getOverview(data);
    var signature = overview.signature || [];

    if (!signature.length) {
      signature = (data.curation.frames || []).slice(0, 3).map(function (item) {
        return { title: item.title, text: item.text };
      });
    }

    root.innerHTML = signature
      .slice(0, 3)
      .map(function (item) {
        return (
          '<article class="overview-v9-principle intentional-reveal">' +
            "<h3>" + escape(item.title) + "</h3>" +
            "<p>" + escape(compactWords(item.text, 7, 52)) + "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function countByArc(works) {
    var counts = {};
    works.forEach(function (work) {
      counts[work.arc] = (counts[work.arc] || 0) + 1;
    });
    return counts;
  }

  function renderArcs(data) {
    var root = document.getElementById("home-arcs");
    if (!root) {
      return;
    }

    var counts = countByArc(data.works);

    root.innerHTML = (data.curation.arcs || [])
      .filter(function (arc) {
        return Boolean(counts[arc.id]);
      })
      .map(function (arc) {
        var count = counts[arc.id] || 0;
        var countLabel = count === 1 ? "1 work" : String(count) + " works";

        return (
          '<article class="overview-v9-arc intentional-reveal">' +
            '<header class="overview-v9-arc-head">' +
              "<h3>" + escape(arc.name) + "</h3>" +
              '<span class="overview-v9-arc-count">' + escape(countLabel) + "</span>" +
            "</header>" +
            '<p class="overview-v9-arc-thesis">' + escape(compactSentence(arc.thesis, 92)) + "</p>" +
            '<ul class="overview-v9-arc-signals">' +
              "<li><span>Method</span><strong>" + escape(compactWords(arc.methods, 8, 56)) + "</strong></li>" +
              "<li><span>Use</span><strong>" + escape(compactWords(arc.practice, 8, 56)) + "</strong></li>" +
            "</ul>" +
            '<a class="intentional-link" href="/publications/?arc=' + escape(arc.id) + '">Open</a>' +
          "</article>"
        );
      })
      .join("");
  }

  function arcLeadWork(data, arcId) {
    var pool = data.works
      .filter(function (work) {
        return work.arc === arcId;
      })
      .sort(function (a, b) {
        if (Number(b.featured) !== Number(a.featured)) {
          return Number(b.featured) - Number(a.featured);
        }
        if ((b.citations || 0) !== (a.citations || 0)) {
          return (b.citations || 0) - (a.citations || 0);
        }
        return (b.year || 0) - (a.year || 0);
      });

    return pool[0] || null;
  }

  function selectFeaturedWorks(data) {
    var selected = [];
    var selectedMap = {};

    (data.curation.arcs || []).forEach(function (arc) {
      var lead = arcLeadWork(data, arc.id);
      if (lead && !selectedMap[lead.id]) {
        selected.push(lead);
        selectedMap[lead.id] = true;
      }
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

  function renderWorkLinks(work) {
    var links = (work.links || [])
      .slice()
      .sort(function (a, b) {
        var order = { Paper: 0, PDF: 1, Scholar: 2 };
        return (order[a.label] || 9) - (order[b.label] || 9);
      })
      .slice(0, 2)
      .map(function (link) {
        return '<a href="' + escape(link.href) + '" target="_blank" rel="noreferrer">' + escape(link.label) + "</a>";
      })
      .join("");

    return links ? '<div class="intentional-work-links">' + links + "</div>" : "";
  }

  function renderWorkTags(work) {
    var tags = (work.tags || []).slice(0, 2);
    if (!tags.length) {
      return "";
    }

    return (
      '<ul class="overview-v9-work-tags">' +
      tags
        .map(function (tag) {
          return "<li>" + escape(compactWords(tag, 3, 26)) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function renderFeatured(data) {
    var root = document.getElementById("home-featured");
    if (!root) {
      return;
    }

    var selected = selectFeaturedWorks(data);
    if (!selected.length) {
      root.innerHTML = "";
      return;
    }

    root.innerHTML = selected
      .map(function (work) {
        var arc = data.arcMap[work.arc] || { name: "Unsorted" };
        var primary = window.ResearchCore.workPrimaryLink(work);

        return (
          '<article class="overview-v9-work intentional-reveal">' +
            '<p class="overview-v9-work-arc">' + escape(arc.name) + "</p>" +
            "<h3>" +
              (primary
                ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + "</a>"
                : escape(work.title)) +
            "</h3>" +
            '<p class="overview-v9-work-metrics">' +
              escape(work.year || "Undated") + " | cited by " + window.ResearchCore.formatNumber(work.citations || 0) +
            "</p>" +
            renderWorkTags(work) +
            renderWorkLinks(work) +
          "</article>"
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
      node.style.transitionDelay = String(Math.min(index * 0.02, 0.14)) + "s";
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
      renderPrinciples(data);
      renderArcs(data);
      renderFeatured(data);
      renderSync(data);
      reveal();
    } catch (error) {
      console.error(error);
      app.innerHTML = '<p class="intentional-error">Unable to load portfolio data. Check assets/data/works_raw.json and assets/data/research-curation.json.</p>';
    }
  }

  init();
})();
