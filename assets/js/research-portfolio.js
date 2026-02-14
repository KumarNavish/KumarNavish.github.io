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

  function compactText(value, maxLength) {
    var text = toText(value);
    if (!text) {
      return "";
    }

    var firstSentence = text.split(/\.\s+/)[0];
    if (firstSentence && firstSentence.length <= maxLength) {
      return firstSentence.replace(/[.\s]*$/, "") + ".";
    }

    if (text.length <= maxLength) {
      return text;
    }

    return text.slice(0, Math.max(24, maxLength - 1)).trim().replace(/[,;:\s]+$/, "") + "…";
  }

  function compactPhrase(value, maxLength) {
    var text = toText(value);
    if (!text) {
      return "";
    }

    var first = text.split(/[;,]/)[0].trim();
    if (first.length <= maxLength) {
      return first;
    }

    return first.slice(0, Math.max(24, maxLength - 1)).trim().replace(/[\s]+$/, "") + "…";
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
    var scholarUrl = site.scholar_url || data.raw.source || "#";

    setText("home-kicker", overview.hero_byline || site.name || data.raw.profile.name || "Research Portfolio");
    setText("home-title", overview.hero_title || site.statement || "Research");
    setText("home-statement", compactText(overview.hero_subtitle || site.context || "", 180));
    setText("home-context", compactText(overview.hero_context || "", 180));
    setText("home-identity-line", compactText(overview.identity_line || site.context || "", 145));
    setText(
      "home-invite",
      compactText(
        overview.closing_invite ||
          "The archive maps each work to the question it answers, the method it uses, and the decision it informs.",
        180
      )
    );

    setText("home-stat-works", String(data.stats.works));
    setText("home-stat-citations", window.ResearchCore.formatNumber(data.stats.citations));
    setText("home-stat-years", data.stats.years);
    setText("home-stat-arcs", String(data.stats.arcs));

    var scholarPrimary = document.getElementById("home-scholar-link");
    if (scholarPrimary) {
      scholarPrimary.href = scholarUrl;
    }

    var scholarSecondary = document.getElementById("home-scholar-link-secondary");
    if (scholarSecondary) {
      scholarSecondary.href = scholarUrl;
    }
  }

  function renderSignature(data) {
    var root = document.getElementById("home-signature");
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
          '<article class="overview-v8-signature-item intentional-reveal">' +
            "<h3>" + escape(item.title) + "</h3>" +
            "<p>" + escape(compactText(item.text, 90)) + "</p>" +
          "</article>"
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
    if (!logic.length) {
      logic = [
        { title: "Question", text: "Define the structural claim." },
        { title: "System", text: "Build and instrument the testbed." },
        { title: "Decision", text: "Translate evidence into design choices." }
      ];
    }

    root.innerHTML = logic
      .slice(0, 3)
      .map(function (item, index) {
        return (
          '<article class="overview-v8-logic-step intentional-reveal">' +
            '<p class="overview-v8-index">' + String(index + 1).padStart(2, "0") + "</p>" +
            "<h3>" + escape(item.title) + "</h3>" +
            "<p>" + escape(compactText(item.text, 92)) + "</p>" +
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

  function renderArcMetaRow(label, value) {
    var text = compactPhrase(value, 82);
    if (!text) {
      return "";
    }

    return (
      "<div>" +
        "<dt>" + escape(label) + "</dt>" +
        "<dd>" + escape(text) + "</dd>" +
      "</div>"
    );
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
        var label = count === 1 ? "1 work" : String(count) + " works";
        var meta =
          renderArcMetaRow("Method", arc.methods) +
          renderArcMetaRow("Use", arc.practice);

        return (
          '<article class="overview-v8-arc intentional-reveal">' +
            '<header class="overview-v8-arc-head">' +
              "<h3>" + escape(arc.name) + "</h3>" +
              '<span class="overview-v8-arc-count">' + label + "</span>" +
            "</header>" +
            '<p class="overview-v8-arc-thesis">' + escape(compactText(arc.thesis, 120)) + "</p>" +
            (meta ? '<dl class="overview-v8-arc-meta">' + meta + "</dl>" : "") +
            '<a class="intentional-link" href="/publications/?arc=' + escape(arc.id) + '">Open Program</a>' +
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
    var seen = {};

    (data.curation.arcs || []).forEach(function (arc) {
      var lead = arcLeadWork(data, arc.id);
      if (lead && !seen[lead.id]) {
        selected.push(lead);
        seen[lead.id] = true;
      }
    });

    data.works.forEach(function (work) {
      if (selected.length >= 3 || seen[work.id]) {
        return;
      }
      selected.push(work);
      seen[work.id] = true;
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
        var summary = compactText(work.summary || work.description, 130);

        return (
          '<article class="overview-v8-work intentional-reveal">' +
            '<p class="overview-v8-work-meta">' +
              escape(arc.name) + " | " +
              escape(workYear(work)) + " | cited by " +
              window.ResearchCore.formatNumber(work.citations || 0) +
            "</p>" +
            "<h3>" +
              (primary
                ? '<a href="' + escape(primary) + '" target="_blank" rel="noreferrer">' + escape(work.title) + "</a>"
                : escape(work.title)) +
            "</h3>" +
            '<p class="overview-v8-work-summary">' + escape(summary) + "</p>" +
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
      node.style.transitionDelay = String(Math.min(index * 0.03, 0.18)) + "s";
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
