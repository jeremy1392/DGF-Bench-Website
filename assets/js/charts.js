/* DGF-Bench website: charts rendered from window.DGF_DATA (data/results.js). No dependencies.

   API (window.DGFCharts):
     renderLeaderboard(el, {size: "hero"|"normal", passed, clean, link, headingLevel, titleId})
     renderScoreBars(el)
     renderHeatmap(el, {families: ["injection", ...], controls: true|false, totals, order: "data"|"rank", attackHref})
     renderCleanVsAttack(el, {order})
     helpers: data, level(score), heatLevel(a, n), modelsByRank(), model(id), attack(slug), fmt(n)

   Declarative use: any element with data-chart is rendered on DOMContentLoaded:
     <section data-chart="leaderboard" data-size="hero"></section>
     <div data-chart="score-bars"></div>
     <div data-chart="heatmap" data-families="injection,document" data-controls="true"></div>
     <div data-chart="clean-vs-attack"></div>
   Keep static fallback HTML inside the element: it is replaced only when the data loaded. */
(function () {
  "use strict";

  var D = window.DGF_DATA;
  var SVGNS = "http://www.w3.org/2000/svg";

  /* Helpers ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function score1(s) { return Number(s).toFixed(1); }
  function pct(a, n) { return n ? Math.round((100 * a) / n) + "%" : "0%"; }
  function level(score) {
    var L = D.score_rule.levels;
    return score >= L.high ? "high" : score >= L.mid ? "mid" : "low";
  }
  /* Success share -> heatmap level 0-5 (0 = no success). */
  function heatLevel(a, n) {
    if (!n || !a) return 0;
    var r = a / n;
    return r <= 0.1 ? 1 : r <= 0.25 ? 2 : r <= 0.5 ? 3 : r <= 0.75 ? 4 : 5;
  }
  function model(id) { for (var i = 0; i < D.models.length; i++) if (D.models[i].id === id) return D.models[i]; return null; }
  function modelsByRank() { return D.ranking.map(model); }
  function modelsInOrder(order) { return order === "rank" ? modelsByRank() : D.models.slice(); }
  function attack(slug) { for (var i = 0; i < D.attacks.length; i++) if (D.attacks[i].slug === slug || D.attacks[i].kind === slug) return D.attacks[i]; return null; }
  function family(key) { for (var i = 0; i < D.families.length; i++) if (D.families[i].key === key) return D.families[i]; return null; }
  function uid(prefix) { uid.n = (uid.n || 0) + 1; return prefix + "-" + uid.n; }
  function svgEl(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  /* Horizontal bar path: square at the baseline, 4px rounded data end. */
  function hbarPath(x, y, w, h) {
    var r = Math.min(4, w / 2, h / 2);
    if (w <= 0) return "";
    return "M" + x + " " + y + "H" + (x + w - r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r +
      "V" + (y + h - r) + "a" + r + " " + r + " 0 0 1 " + -r + " " + r + "H" + x + "Z";
  }
  function wrapWords(text, maxChars) {
    var words = String(text).split(" "), lines = [], line = "";
    words.forEach(function (w) {
      if ((line + " " + w).trim().length > maxChars && line) { lines.push(line); line = w; }
      else line = (line + " " + w).trim();
    });
    if (line) lines.push(line);
    return lines;
  }
  function passedText(m, maxList) {
    var p = m.dgf.passed;
    if (!p.length) return "none";
    if (p.length > (maxList || 4)) return p.length + " attacks (see the attack matrix)";
    return p.map(function (x) { return x.name; }).join(", ");
  }
  function attackHrefFor(opts) {
    if (typeof opts.attackHref === "function") return opts.attackHref;
    var tpl = opts.attackHref == null ? "attacks.html#attack-{slug}" : opts.attackHref;
    return function (a) { return tpl ? tpl.replace("{slug}", a.slug).replace("{id}", a.id) : null; };
  }

  /* Shared tooltip ------------------------------------------------------------ */
  var tip = null;
  function tooltip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "tooltip";
    tip.id = "dgf-tooltip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    window.addEventListener("scroll", hideTip, { passive: true });
    return tip;
  }
  function showTip(target, html, point) {
    var t = tooltip();
    t.innerHTML = html;
    t.setAttribute("data-show", "");
    var r = target.getBoundingClientRect();
    var tw = t.offsetWidth, th = t.offsetHeight, vw = document.documentElement.clientWidth;
    var cx = point ? point.x : r.left + r.width / 2;
    var top = (point ? point.y : r.top) - th - 10;
    if (top < 8) top = (point ? point.y : r.bottom) + 12;
    var left = Math.max(8, Math.min(vw - tw - 8, cx - tw / 2));
    t.style.left = left + "px";
    t.style.top = top + "px";
  }
  function hideTip() { if (tip) tip.removeAttribute("data-show"); }
  function bindTips(container, selector, htmlFor) {
    container.addEventListener("mouseover", function (e) {
      var c = e.target.closest && e.target.closest(selector);
      if (c && container.contains(c)) showTip(c, htmlFor(c));
    });
    container.addEventListener("mouseout", function (e) {
      var c = e.target.closest && e.target.closest(selector);
      if (c && (!e.relatedTarget || !c.contains(e.relatedTarget))) hideTip();
    });
    container.addEventListener("focusin", function (e) {
      var c = e.target.closest && e.target.closest(selector);
      if (c) showTip(c, htmlFor(c));
    });
    container.addEventListener("focusout", hideTip);
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideTip(); });

  /* Roving focus with arrow keys over the cells of a table (one tab stop). */
  function rovingGrid(table, cellSelector) {
    var cells = table.querySelectorAll(cellSelector);
    if (!cells.length) return;
    Array.prototype.forEach.call(cells, function (c, i) { c.tabIndex = i === 0 ? 0 : -1; });
    table.addEventListener("keydown", function (e) {
      var cell = e.target.closest && e.target.closest(cellSelector);
      if (!cell) return;
      var row = cell.parentElement, rows = Array.prototype.filter.call(table.querySelectorAll("tr"), function (r) { return r.querySelector(cellSelector); });
      var ri = rows.indexOf(row), rowCells = row.querySelectorAll(cellSelector), ci = Array.prototype.indexOf.call(rowCells, cell), next = null;
      if (e.key === "ArrowRight") next = rowCells[ci + 1];
      else if (e.key === "ArrowLeft") next = rowCells[ci - 1];
      else if (e.key === "ArrowDown" && rows[ri + 1]) next = rows[ri + 1].querySelectorAll(cellSelector)[ci];
      else if (e.key === "ArrowUp" && rows[ri - 1]) next = rows[ri - 1].querySelectorAll(cellSelector)[ci];
      else if (e.key === "Home") next = rowCells[0];
      else if (e.key === "End") next = rowCells[rowCells.length - 1];
      if (next) {
        e.preventDefault();
        cell.tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
      }
    });
  }

  /* 1. Leaderboard ----------------------------------------------------------------
     The big DGF score list. size "hero" (home page) or "normal" (adds the passed attacks). */
  function leaderboardHTML(opts) {
    var size = opts.size === "hero" ? "hero" : "normal";
    var showPassed = opts.passed != null ? !!opts.passed : size === "normal";
    var showClean = opts.clean != null ? !!opts.clean : true;
    var h = "h" + (opts.headingLevel || 2);
    var titleId = opts.titleId;
    var s = D.setup;
    var L = D.score_rule.levels.labels;
    var out = '<div class="leaderboard__head">' +
      "<" + h + ' class="leaderboard__title no-anchor" id="' + esc(titleId) + '">DGF score <span>out of 100</span></' + h + ">" +
      '<p class="leaderboard__legend"><span class="visually-hidden">Bar color: </span>' +
      '<span class="legend-swatch legend-swatch--high">' + esc(L.high) + "</span>" +
      '<span class="legend-swatch legend-swatch--mid">' + esc(L.mid) + "</span>" +
      '<span class="legend-swatch legend-swatch--low">' + esc(L.low) + "</span></p></div>";
    out += '<ol class="leaderboard__list" aria-labelledby="' + esc(titleId) + '">';
    modelsByRank().forEach(function (m) {
      var d = m.dgf;
      var meta = "<code>" + esc(m.id) + "</code>" + (m.provider ? " · " + esc(m.provider) : "");
      /* the title keeps the full id and provider readable where the hero row ends them in an ellipsis */
      var metaTitle = m.id + (m.provider ? " · " + m.provider : "");
      out += '<li class="lb-row" data-level="' + d.level + '">' +
        '<span class="lb-row__rank">' + m.rank + "</span>" +
        '<div class="lb-row__who"><span class="lb-row__name">' + esc(m.name) + '</span><span class="lb-row__meta" title="' + esc(metaTitle) + '">' + meta + "</span></div>" +
        '<div class="lb-row__score"><span class="visually-hidden">DGF score </span><span class="lb-row__value">' + score1(d.score) +
        '</span><span class="lb-row__max">/100</span></div>' +
        '<div class="lb-row__barline"><span class="lb-bar" aria-hidden="true"><span class="lb-bar__fill" style="--w:' + d.score + '%"></span></span>' +
        '<span class="lb-row__detail">blocked <strong>' + d.blocked + "</strong> of " + d.applicable + " attacks" +
        (showClean ? '<span class="lb-row__clean"> · clean ' + m.clean_outcome_strict.outcome_strict + "/" + m.clean_outcome_strict.gates + "</span>" : "") +
        "</span></div>" +
        (showPassed ? '<p class="lb-row__passed">Passed: ' + esc(passedText(m, 5)) + "</p>" : "") +
        "</li>";
    });
    if (opts.slot !== false) {
      /* Open slot inviting labs to submit a score (see get-started.html#submit); same subject and body as the
         "Send your score" links of the pages (tools/build_data.py SUBMIT_MAILTO writes the same string). */
      var mail = "mailto:contact@dgfbench.com?subject=DGF-Bench%20score%20submission%3A%20%3Cmodel%3E&body=" +
        "Model%20id%20%28OpenRouter%29%3A%20%0D%0Adgf-bench%20version%20%28dgf-bench%20--version%29%3A%20%0D%0A" +
        "Exact%20command%3A%20%0D%0A%0D%0AAttached%3A%20report.json%20and%20REPORT.md%20%28from%20runs%2F%3Cmodel%3E_%3CN%3Ed%2Freport%2F%29%0D%0A";
      out += '<li class="lb-row lb-row--slot">' +
        '<span class="lb-row__rank" aria-hidden="true">+</span>' +
        '<div class="lb-row__who"><a class="lb-row__name" href="' + esc(mail) + '">Add your latest model here</a>' +
        '<span class="lb-row__meta">Run <code>dgf-bench run</code> on your model, then e-mail the report to contact@dgfbench.com</span></div>' +
        '<div class="lb-row__score" aria-hidden="true"><span class="lb-row__value">?</span><span class="lb-row__max">/100</span></div>' +
        '<div class="lb-row__barline"><span class="lb-bar lb-bar--empty" aria-hidden="true"></span>' +
        '<a class="lb-row__detail link-arrow" href="get-started.html#submit">How to submit your score</a></div>' +
        "</li>";
    }
    out += "</ol>";
    out += '<div class="leaderboard__foot"><p>DGF score = share of the ' + s.fixed_attacks + " fixed attacks a model blocks (" +
      (s.fixed_attacks - 1) + " for text-only models); higher is better." +
      (showClean ? " Clean = outcome-strict gates of " + s.scheduled_gates + " without attack." : "") +
      " Results of " + esc(D.date_label) + " · " + s.dossier_count + " dossiers · " + fmt(s.attacked_gates_fixed) + " attacked gates on the fixed attacks." +
      (opts.link ? ' <a class="link-arrow" href="' + esc(opts.link) + '">Full results</a>' : "") +
      "</p></div>";
    return out;
  }
  function renderLeaderboard(el, opts) {
    if (!el || !D) return;
    opts = opts || {};
    var size = opts.size === "hero" ? "hero" : "normal";
    el.classList.add("leaderboard");
    el.classList.toggle("leaderboard--hero", size === "hero");
    var titleId = opts.titleId || el.getAttribute("aria-labelledby") || (el.id ? el.id + "-title" : uid("leaderboard-title"));
    if (!el.getAttribute("aria-labelledby")) el.setAttribute("aria-labelledby", titleId);
    var link = opts.link !== undefined ? opts.link : (size === "hero" ? "results.html" : null);
    el.innerHTML = leaderboardHTML({ size: size, passed: opts.passed, clean: opts.clean, link: link,
      headingLevel: opts.headingLevel, titleId: titleId });
    el.setAttribute("data-rendered", "");
  }

  /* 2. Score bars (SVG) -------------------------------------------------------------
     Six models sorted by DGF score, axis 0-100, value labels, blocked/applicable and passed attacks. */
  function scoreTableHTML(models) {
    var s = D.setup;
    var h = '<details class="chart-data"><summary>Show the data as a table</summary><div class="table-scroll">' +
      '<table class="table table--compact"><caption>DGF score per model: ' + s.fixed_attacks + " fixed attacks (" + (s.fixed_attacks - 1) +
      " for text-only models); an attack passes when it succeeds at least once</caption><thead><tr>" +
      '<th scope="col" class="num">Rank</th><th scope="col">Model</th><th scope="col">OpenRouter id</th><th scope="col" class="num">DGF score</th>' +
      '<th scope="col" class="num">Blocked</th><th scope="col">Attacks that passed</th></tr></thead><tbody>';
    models.forEach(function (m) {
      h += '<tr><td class="num">' + m.rank + "</td><th scope=\"row\">" + esc(m.name) + "</th><td><code>" + esc(m.id) + "</code></td>" +
        '<td class="num">' + score1(m.dgf.score) + '</td><td class="num">' + m.dgf.blocked + " / " + m.dgf.applicable + "</td><td>" +
        esc(m.dgf.passed.map(function (x) { return x.name; }).join(", ") || "none") + "</td></tr>";
    });
    return h + "</tbody></table></div></details>";
  }

  function renderScoreBars(el) {
    if (!el || !D) return;
    el.classList.add("chart");
    var models = modelsByRank();
    /* SVG host (redrawn on resize) + a data table alternative (rendered once) */
    el.innerHTML = '<div class="chart__svg"></div>' + scoreTableHTML(models);
    var host = el.querySelector(".chart__svg");
    function draw() {
      var width = Math.max(300, Math.round(host.clientWidth || el.clientWidth || 720));
      if (el._lastWidth === width && host.querySelector("svg")) return;
      el._lastWidth = width;
      var narrow = width < 640;
      var nameW = narrow ? 0 : Math.min(250, Math.round(width * 0.28));
      var x0 = narrow ? 4 : nameW + 16, valueW = 64, x1 = width - valueW - 4, barH = 22;
      var subChars = Math.max(28, Math.floor((x1 - x0) / 6.6));
      var top = 34, y = top, rows = [];
      models.forEach(function (m) {
        var sub = "blocked " + m.dgf.blocked + " of " + m.dgf.applicable + " attacks · passed: " + passedText(m, 4);
        var lines = wrapWords(sub, subChars);
        var head = narrow ? 36 : 0;
        rows.push({ m: m, y: y + head, lines: lines });
        y += head + barH + 10 + lines.length * 16 + 22;
      });
      var height = y + 4;
      var label = "DGF score per model, out of 100, sorted: " + models.map(function (m) {
        return m.name + " " + score1(m.dgf.score) + " (blocked " + m.dgf.blocked + " of " + m.dgf.applicable + ")";
      }).join("; ") + ".";
      var svg = svgEl("svg", { width: width, height: height, viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": label });
      var g = svgEl("g", {});
      var ticks = [0, 25, 50, 75, 100];
      ticks.forEach(function (t) {
        var x = x0 + ((x1 - x0) * t) / 100;
        g.appendChild(svgEl("text", { x: x, y: top - 16, "text-anchor": "middle", "class": "bc-tick" }, String(t)));
      });
      rows.forEach(function (r) {
        var m = r.m, yb = r.y;
        if (narrow) {
          g.appendChild(svgEl("text", { x: x0, y: yb - 20, "class": "bc-name" }, m.name));
          g.appendChild(svgEl("text", { x: x0, y: yb - 6, "class": "bc-id" }, m.id));
        } else {
          g.appendChild(svgEl("text", { x: nameW, y: yb + 10, "text-anchor": "end", "class": "bc-name" }, m.name));
          g.appendChild(svgEl("text", { x: nameW, y: yb + 27, "text-anchor": "end", "class": "bc-id" }, m.id));
        }
        g.appendChild(svgEl("path", { d: hbarPath(x0, yb, x1 - x0, barH), "class": "bc-track" }));
        /* gridlines only across the bar band (over the track, under the bar), never across the labels */
        ticks.forEach(function (t) {
          var x = x0 + ((x1 - x0) * t) / 100;
          g.appendChild(svgEl("line", { x1: x, x2: x, y1: yb - 4, y2: yb + barH + 4, "class": t === 0 ? "bc-axis" : "bc-grid" }));
        });
        var bar = svgEl("path", { d: hbarPath(x0, yb, ((x1 - x0) * m.dgf.score) / 100, barH), "class": "bc-bar", "data-level": m.dgf.level, "data-model": m.id });
        g.appendChild(bar);
        g.appendChild(svgEl("text", { x: x1 + 10, y: yb + 18, "class": "bc-value" }, score1(m.dgf.score)));
        r.lines.forEach(function (line, i) {
          g.appendChild(svgEl("text", { x: x0, y: yb + barH + 18 + i * 16, "class": "bc-sub" }, line));
        });
      });
      svg.appendChild(g);
      host.innerHTML = "";
      host.appendChild(svg);
      el.setAttribute("data-rendered", "");
    }
    draw();
    el.addEventListener("mousemove", function (e) {
      var b = e.target.closest && e.target.closest(".bc-bar");
      if (!b) { hideTip(); return; }
      var m = model(b.getAttribute("data-model"));
      showTip(b, "<strong>" + esc(m.name) + "</strong><span class=\"tooltip__value\">DGF score " + score1(m.dgf.score) +
        " · blocked " + m.dgf.blocked + " of " + m.dgf.applicable + "</span><br>Passed: " + esc(passedText(m, 30)),
        { x: e.clientX, y: e.clientY });
    });
    el.addEventListener("mouseleave", hideTip);
    if (window.ResizeObserver) {
      var raf = 0;
      new ResizeObserver(function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(el);
    } else {
      window.addEventListener("resize", draw);
    }
  }

  /* 3. Heatmap: attacks x models ----------------------------------------------------- */
  function heatLegendHTML(kind) {
    var steps = "";
    for (var i = 1; i <= 5; i++) steps += '<span style="background:var(--heat-' + i + ')"></span>';
    return '<div class="heat-legend" aria-hidden="' + (kind === "hidden" ? "true" : "false") + '">' +
      '<span><span class="heat-swatch heat-swatch--0"></span>0 successes</span>' +
      '<span class="heat-legend__scale">share of attacked gates <span>&gt;0</span><span class="heat-legend__steps">' + steps + "</span><span>100%</span></span>" +
      '<span><span class="heat-swatch heat-swatch--na"></span>n/a: an image cannot be sent to a text-only model</span></div>';
  }
  function renderHeatmap(el, opts) {
    if (!el || !D) return;
    opts = opts || {};
    var allKeys = D.families.map(function (f) { return f.key; });
    var active = (opts.families && opts.families.length ? opts.families : allKeys).slice();
    var models = modelsInOrder(opts.order);
    var hrefFor = attackHrefFor(opts);
    var showTotals = opts.totals !== false;
    var capId = uid("heatmap-cap");
    el.classList.add("chart");

    function tableHTML() {
      var rowsShown = 0;
      var h = '<div class="heatmap-wrap" role="region" tabindex="0" aria-labelledby="' + capId + '"><table class="heatmap">' +
        '<caption id="' + capId + '" class="visually-hidden">Attributable attack successes over attacked gates, per attack and model</caption>' +
        '<thead><tr><th scope="col">Attack</th>';
      models.forEach(function (m) {
        h += '<th scope="col">' + esc(m.name) + "<small>" + (m.image_input ? "image input" : "text only") + "</small></th>";
      });
      h += "</tr></thead><tbody>";
      var sums = {};
      models.forEach(function (m) { sums[m.id] = { a: 0, n: 0 }; });
      D.families.forEach(function (f) {
        if (active.indexOf(f.key) < 0) return;
        h += '<tr class="heatmap__group"><th scope="colgroup" colspan="' + (models.length + 1) + '"><span class="heatmap__grouplabel"><span class="chip chip--' + f.key + '">' +
          esc(f.plural) + "</span><span>rows " + f.rows[0] + "–" + f.rows[1] + " · " + esc(f.mode) + (f.key === "adaptive" ? " · not in the DGF score" : "") + "</span></span></th></tr>";
        D.attacks.forEach(function (a) {
          if (a.family !== f.key) return;
          rowsShown++;
          var href = hrefFor(a);
          h += '<tr><th scope="row" class="heatmap__rowhead"><span class="heatmap__id">' + a.id + "</span> " +
            (href ? '<a href="' + esc(href) + '">' + esc(a.name) + "</a>" : esc(a.name)) + "</th>";
          models.forEach(function (m) {
            var c = a.cells[m.id];
            if (!c) {
              h += '<td class="heatmap__cell" data-level="na" data-attack="' + a.id + '" data-model="' + esc(m.id) + '">n/a</td>';
              return;
            }
            sums[m.id].a += c.attributable;
            sums[m.id].n += c.attacked;
            h += '<td class="heatmap__cell" data-level="' + heatLevel(c.attributable, c.attacked) + '" data-attack="' + a.id +
              '" data-model="' + esc(m.id) + '">' + c.attributable + "/" + c.attacked + "</td>";
          });
          h += "</tr>";
        });
      });
      h += "</tbody>";
      if (showTotals) {
        var all = active.length === allKeys.length;
        /* text-only models run fewer attacks: the image attack is n/a for them */
        var ran = function (m) { return D.attacks.filter(function (a) { return a.cells[m.id]; }).length; };
        var textRuns = models.filter(function (m) { return !m.image_input; }).map(ran);
        var fewer = textRuns.length && Math.max.apply(null, textRuns) < D.attacks.length ? Math.max.apply(null, textRuns) : 0;
        h += "<tfoot><tr><th scope=\"row\">" + (all ? "Total, all attacks (" + D.attacks.length +
          (fewer ? "; " + fewer + " for text-only models" : "") + ")" : "Total, rows shown") + "</th>";
        models.forEach(function (m) { h += "<td>" + sums[m.id].a + "<small>of " + fmt(sums[m.id].n) + "</small></td>"; });
        h += "</tr></tfoot>";
      }
      h += "</table></div>" + heatLegendHTML();
      return { html: h, rows: rowsShown };
    }

    function controlsHTML() {
      var h = '<div class="filters" role="group" aria-label="Filter attacks by family">' +
        '<button type="button" class="filter-chip" data-family="all" aria-pressed="' + (active.length === allKeys.length) + '">All families</button>';
      D.families.forEach(function (f) {
        var pressed = active.length === 1 && active[0] === f.key;
        h += '<button type="button" class="filter-chip" data-family="' + f.key + '" aria-pressed="' + pressed + '">' +
          '<span class="filter-chip__dot" aria-hidden="true"></span>' + esc(f.plural) + "</button>";
      });
      h += '<span class="filters__count" aria-live="polite"></span></div>';
      return h;
    }

    function tipHTML(cell) {
      var a = D.attacks[Number(cell.getAttribute("data-attack")) - 1], m = model(cell.getAttribute("data-model"));
      var c = a.cells[m.id];
      var body = c ? '<span class="tooltip__value">' + c.attributable + " attributable of " + c.attacked + " attacked gates (" + pct(c.attributable, c.attacked) + ")</span>"
        : "Not applicable: an image cannot be sent to a text-only model.";
      return "<strong>" + a.id + " · " + esc(a.name) + "</strong>" + esc(m.name) + ": " + body;
    }

    function draw() {
      var t = tableHTML();
      var target = el.querySelector("[data-heatmap-body]");
      if (!target) {
        el.innerHTML = (opts.controls ? controlsHTML() : "") + '<div data-heatmap-body></div>';
        target = el.querySelector("[data-heatmap-body]");
      }
      target.innerHTML = t.html;
      var count = el.querySelector(".filters__count");
      if (count) count.textContent = t.rows + (t.rows === 1 ? " attack shown" : " attacks shown");
      rovingGrid(target.querySelector("table"), ".heatmap__cell");
      el.setAttribute("data-rendered", "");
    }

    draw();
    bindTips(el, ".heatmap__cell", tipHTML);
    if (opts.controls) {
      el.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest(".filter-chip");
        if (!b || !el.contains(b)) return;
        var key = b.getAttribute("data-family");
        active = key === "all" ? allKeys.slice() : [key];
        Array.prototype.forEach.call(el.querySelectorAll(".filter-chip"), function (x) {
          var k = x.getAttribute("data-family");
          x.setAttribute("aria-pressed", String(k === "all" ? active.length === allKeys.length : active.length === 1 && active[0] === k));
        });
        draw();
      });
    }
    el._setFamilies = function (keys) { active = keys && keys.length ? keys.slice() : allKeys.slice(); draw(); };
  }

  /* 4. Outcome-strict on the clean dossiers vs under each in-text attack ------------ */
  function renderCleanVsAttack(el, opts) {
    if (!el || !D) return;
    opts = opts || {};
    el.classList.add("chart");
    var o = D.outcome_clean_vs_attack, models = modelsInOrder(opts.order), capId = uid("cva-cap");
    var h = '<div class="heatmap-wrap" role="region" tabindex="0" aria-labelledby="' + capId + '"><table class="heatmap heatmap--delta">' +
      '<caption id="' + capId + '" class="visually-hidden">Outcome-strict gates out of ' + o.gates +
      " on the clean dossiers and under each in-text injection, per model; the small number is the change from the clean run</caption>" +
      '<thead><tr><th scope="col">Dataset</th>';
    models.forEach(function (m) { h += '<th scope="col">' + esc(m.name) + "<small>gates of " + o.gates + "</small></th>"; });
    h += "</tr></thead><tbody>";
    o.kinds.forEach(function (kind) {
      var a = kind === "clean" ? null : attack(kind);
      var name = a ? a.name : "Clean dossiers (no attack)";
      h += "<tr" + (a ? "" : ' class="heatmap__row--clean"') + '><th scope="row" class="heatmap__rowhead">' +
        (a ? '<span class="heatmap__id">' + a.id + "</span> " : "") + esc(name) + "</th>";
      models.forEach(function (m) {
        var v = o.values[m.id][kind], clean = o.values[m.id].clean.outcome_strict;
        if (!v) { h += '<td class="heatmap__cell" data-level="na" data-kind="' + kind + '" data-model="' + esc(m.id) + '">n/a</td>'; return; }
        var delta = v.outcome_strict - clean;
        var lvl = a && delta < 0 ? heatLevel(-delta, o.gates) : 0;
        var d = a && delta !== 0 ? "<small>" + (delta > 0 ? "+" : "−") + Math.abs(delta) + "</small>" : "";
        h += '<td class="heatmap__cell" data-level="' + lvl + '" data-kind="' + kind + '" data-model="' + esc(m.id) + '">' + v.outcome_strict + d + "</td>";
      });
      h += "</tr>";
    });
    h += "</tbody></table></div>";
    h += '<div class="heat-legend"><span>Cell = outcome-strict gates of ' + o.gates + "; small number = change from the clean run</span>" +
      '<span class="heat-legend__scale">drop <span class="heat-legend__steps">' +
      [1, 2, 3, 4, 5].map(function (i) { return '<span style="background:var(--heat-' + i + ')"></span>'; }).join("") +
      "</span>larger</span>" +
      '<span><span class="heat-swatch heat-swatch--na"></span>n/a: image attack, text-only model</span></div>';
    el.innerHTML = h;
    rovingGrid(el.querySelector("table"), ".heatmap__cell");
    bindTips(el, ".heatmap__cell", function (cell) {
      var kind = cell.getAttribute("data-kind"), m = model(cell.getAttribute("data-model"));
      var v = o.values[m.id][kind], clean = o.values[m.id].clean.outcome_strict, a = kind === "clean" ? null : attack(kind);
      if (!v) return "<strong>" + esc(a.name) + "</strong>" + esc(m.name) + ": not applicable (text-only model).";
      return "<strong>" + esc(a ? a.id + " · " + a.name : "Clean dossiers") + "</strong>" + esc(m.name) + ': <span class="tooltip__value">' +
        v.outcome_strict + " of " + v.gates + " gates outcome-strict" + (a ? " (clean: " + clean + ")" : "") + "</span>";
    });
    el.setAttribute("data-rendered", "");
  }

  /* Auto-render [data-chart] elements ----------------------------------------------- */
  function autoInit() {
    if (!D) {
      if (window.console) console.warn("DGF-Bench: window.DGF_DATA is missing; load data/results.js before charts.js.");
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-chart]"), function (el) {
      var kind = el.getAttribute("data-chart");
      try {
        if (kind === "leaderboard") {
          var link = el.getAttribute("data-link");
          renderLeaderboard(el, {
            size: el.getAttribute("data-size") || "normal",
            passed: el.hasAttribute("data-passed") ? el.getAttribute("data-passed") !== "false" : undefined,
            clean: el.hasAttribute("data-clean") ? el.getAttribute("data-clean") !== "false" : undefined,
            link: link === null ? undefined : (link === "" || link === "none" ? null : link),
            headingLevel: Number(el.getAttribute("data-heading-level")) || 2
          });
        } else if (kind === "score-bars") {
          renderScoreBars(el);
        } else if (kind === "heatmap") {
          var fam = el.getAttribute("data-families");
          renderHeatmap(el, {
            families: fam ? fam.split(",").map(function (s) { return s.trim(); }) : null,
            controls: el.getAttribute("data-controls") === "true",
            order: el.getAttribute("data-order") || "data",
            attackHref: el.hasAttribute("data-attack-href") ? el.getAttribute("data-attack-href") : undefined
          });
        } else if (kind === "clean-vs-attack") {
          renderCleanVsAttack(el, { order: el.getAttribute("data-order") || "data" });
        }
      } catch (err) {
        if (window.console) console.error("DGF-Bench chart failed:", kind, err);
      }
    });
  }

  window.DGFCharts = {
    data: D,
    renderLeaderboard: renderLeaderboard,
    renderScoreBars: renderScoreBars,
    renderHeatmap: renderHeatmap,
    renderCleanVsAttack: renderCleanVsAttack,
    level: level,
    heatLevel: heatLevel,
    modelsByRank: modelsByRank,
    model: model,
    attack: attack,
    family: family,
    fmt: fmt,
    showTip: showTip,
    hideTip: hideTip
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
