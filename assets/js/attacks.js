/* DGF-Bench website: behaviour of attacks.html only (no dependencies).
   - result rows: every [data-attack-results="<id>"] is rendered from window.DGF_DATA
     (the static HTML inside is the no-JavaScript fallback, built from the same data)
   - filters: family chips + text search over the attack cards ([data-atk-filters]);
     without JavaScript every card stays visible and the filter bar is hidden by site.css
   - a link to a card hidden by a filter (#attack-<slug> or #attack-<id>) clears the filters
   - card details (.atk-card__more: placement, goal, excerpt): shipped open; collapsed on phones
     (below 640px, where their summary is shown), open again from 640px and before printing
   - "Back to filters" ([data-atk-backtop]) is shown once the filter bar is above the screen */
(function () {
  "use strict";

  var D = window.DGF_DATA;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function findAttack(id) {
    for (var i = 0; i < D.attacks.length; i++) if (D.attacks[i].id === id) return D.attacks[i];
    return null;
  }

  /* Result row: one cell per model, "attributable/attacked"; passed when attributable > 0.
     Keep in sync with the static fallback written by the page build. */
  function resultsHTML(a) {
    var passed = [];
    var h = '<ul class="atk-res-list" role="list">';
    D.models.forEach(function (m) {
      var c = a.cells[m.id];
      if (!c) {
        h += '<li class="atk-res" data-state="na"><span class="atk-res__model">' + esc(m.name) +
          '</span><span class="atk-res__value">n/a</span><span class="visually-hidden">, not applicable</span></li>';
        return;
      }
      var p = c.attributable > 0;
      if (p) passed.push(m.name);
      h += '<li class="atk-res" data-state="' + (p ? "passed" : "blocked") + '"><span class="atk-res__model">' + esc(m.name) +
        '</span><span class="atk-res__value">' + c.attributable + "/" + c.attacked +
        '</span><span class="visually-hidden">' + (p ? ", got through" : ", blocked") + "</span></li>";
    });
    h += '</ul><p class="atk-res-through"><strong>Got through:</strong> ' + (passed.length ? esc(passed.join(", ")) : "none") + ".</p>";
    return h;
  }

  function renderResults() {
    if (!D || !D.attacks || !D.models) return;
    var els = document.querySelectorAll("[data-attack-results]");
    Array.prototype.forEach.call(els, function (el) {
      var a = findAttack(Number(el.getAttribute("data-attack-results")));
      if (!a) return;
      el.innerHTML = resultsHTML(a);
      el.setAttribute("data-rendered", "");
    });
  }

  /* Filters ------------------------------------------------------------------ */
  function norm(s) {
    return String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
  }

  function initFilters() {
    var bar = document.querySelector("[data-atk-filters]");
    var list = document.querySelector("[data-atk-list]");
    if (!bar || !list) return;
    var cards = Array.prototype.slice.call(list.querySelectorAll(".atk-card"));
    var groups = Array.prototype.slice.call(list.querySelectorAll(".atk-family"));
    var chips = Array.prototype.slice.call(bar.querySelectorAll(".filter-chip"));
    var input = bar.querySelector('input[type="search"]');
    var count = bar.querySelector("[data-atk-count]");
    var empty = list.querySelector("[data-atk-empty]");
    var total = cards.length;
    var state = { family: "all", q: "" };

    /* Search text of a card: everything except the per-model tables (every card names all six
       models in its result cells), so a model name finds the attacks that got through it. */
    cards.forEach(function (c) {
      var clone = c.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll(".atk-res-list, .atk-extra__table, .heading-anchor, .atk-card__more-sum"), function (x) {
        x.parentNode.removeChild(x);
      });
      c._atkText = norm(clone.textContent);
    });

    function apply() {
      var q = norm(state.q).trim();
      var tokens = q ? q.split(" ") : [];
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (state.family === "all" || c.getAttribute("data-family") === state.family) &&
          tokens.every(function (t) { return c._atkText.indexOf(t) >= 0; });
        c.hidden = !ok;
        if (ok) shown++;
      });
      groups.forEach(function (g) {
        g.hidden = !g.querySelector(".atk-card:not([hidden])");
      });
      if (empty) empty.hidden = shown > 0;
      if (count) count.textContent = shown === total ? total + " attacks shown" : shown + " of " + total + " attacks shown";
      chips.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-family") === state.family));
      });
    }

    function reset() {
      state.family = "all";
      state.q = "";
      if (input) input.value = "";
      apply();
    }

    bar.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".filter-chip");
      if (!b || !bar.contains(b)) return;
      state.family = b.getAttribute("data-family") || "all";
      apply();
    });
    if (input) {
      input.addEventListener("input", function () { state.q = input.value; apply(); });
    }
    list.addEventListener("click", function (e) {
      var r = e.target.closest && e.target.closest("[data-atk-reset]");
      if (!r) return;
      reset();
      if (input) input.focus();
    });

    /* A link to a hidden card or family clears the filters, then scrolls to it. */
    function reveal() {
      var id = "";
      try { id = decodeURIComponent((window.location.hash || "").slice(1)); } catch (e) { id = ""; }
      if (!id) return;
      var t = document.getElementById(id);
      if (!t || !list.contains(t)) return;
      if (t.closest && t.closest("[hidden]")) {
        reset();
        t.scrollIntoView();
      }
    }
    window.addEventListener("hashchange", reveal);

    apply();
  }

  /* Card details ------------------------------------------------------------- */
  function initMore() {
    var more = document.querySelectorAll(".atk-card__more");
    if (!more.length || !window.matchMedia) return;
    var phone = window.matchMedia("(max-width: 639px)");
    function setAll(open) {
      Array.prototype.forEach.call(more, function (d) { d.open = open; });
    }
    function sync() { setAll(!phone.matches); }
    sync();
    if (phone.addEventListener) phone.addEventListener("change", sync);
    else if (phone.addListener) phone.addListener(sync);
    window.addEventListener("beforeprint", function () { setAll(true); });
    window.addEventListener("afterprint", sync);
    /* Collapsing moved the cards up: keep a linked card (#attack-...) in view. */
    if (phone.matches && window.location.hash) {
      var t = null;
      try { t = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); } catch (e) { t = null; }
      if (t && t.closest && t.closest("[data-atk-list]")) t.scrollIntoView();
    }
  }

  /* Back to filters ----------------------------------------------------------- */
  function initBackTop() {
    var p = document.querySelector("[data-atk-backtop]");
    var bar = document.querySelector("[data-atk-filters]");
    if (!p || !bar) return;
    var queued = false;
    function update() {
      queued = false;
      var past = bar.getBoundingClientRect().bottom < 0;
      if (past) p.setAttribute("data-show", "");
      else p.removeAttribute("data-show");
    }
    /* A scroll listener, not an IntersectionObserver: a jump from above the bar to a card
       below it (a #attack- link) never makes the bar intersect, so an observer would miss it. */
    window.addEventListener("scroll", function () {
      if (queued) return;
      queued = true;
      (window.requestAnimationFrame || setTimeout)(update);
    }, { passive: true });
    update();
  }

  function init() {
    renderResults();
    initFilters();
    initMore();
    initBackTop();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
