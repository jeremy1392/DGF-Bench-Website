/* DGF-Bench website: shared behaviour (no dependencies).
   - theme: dark by default for every visitor (the system setting does not decide); the toggle
     switches to light and stores the choice in localStorage; ?theme=dark or ?theme=light forces
     a theme for the page view (not stored). Every page has data-theme="dark" on <html>, so the
     first paint is dark even without JavaScript.
   - mobile menu (button[data-nav-toggle] controls .site-header[data-nav-open])
   - copy-to-clipboard: .copy-btn inside a .code-block copies its <pre>; [data-copy] copies that text
   - heading anchors on h2[id] and h3[id] inside <main> (opt out with .no-anchor)
   - active nav fallback: marks the link of the current page with aria-current="page"
   The head of every page runs a tiny inline script first that applies ?theme= or the stored choice before paint. */
(function () {
  "use strict";

  var root = document.documentElement;
  var STORAGE_KEY = "dgf-theme";

  /* Theme ---------------------------------------------------------------- */
  var THEME_COLORS = { dark: "#0c1522", light: "#fbfaf7" };  /* --c-canvas of each theme */
  function effectiveTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  function labelToggle(btn) {
    var next = effectiveTheme() === "dark" ? "light" : "dark";
    btn.setAttribute("aria-label", "Switch to " + next + " theme");
    btn.setAttribute("title", "Switch to " + next + " theme");
  }
  /* Browser UI color (meta theme-color) follows the theme in use. */
  function syncThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[effectiveTheme()]);
  }
  function initTheme() {
    try {
      var q = new URLSearchParams(window.location.search).get("theme");
      if (q === "dark" || q === "light") root.setAttribute("data-theme", q);
    } catch (e) { /* URLSearchParams unavailable: ignore */ }
    if (root.getAttribute("data-theme") !== "light") root.setAttribute("data-theme", "dark");
    syncThemeColor();
    var buttons = document.querySelectorAll("[data-theme-toggle]");
    Array.prototype.forEach.call(buttons, function (btn) {
      labelToggle(btn);
      btn.addEventListener("click", function () {
        var next = effectiveTheme() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { window.localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage blocked */ }
        Array.prototype.forEach.call(buttons, labelToggle);
        syncThemeColor();
        document.dispatchEvent(new CustomEvent("dgf:themechange", { detail: { theme: next } }));
      });
    });
  }

  /* Mobile menu -------------------------------------------------------------- */
  function initMenu() {
    var header = document.querySelector(".site-header");
    var btn = document.querySelector("[data-nav-toggle]");
    if (!header || !btn) return;
    function setOpen(open) {
      if (open) header.setAttribute("data-nav-open", "");
      else header.removeAttribute("data-nav-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    btn.addEventListener("click", function () { setOpen(!header.hasAttribute("data-nav-open")); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.hasAttribute("data-nav-open")) { setOpen(false); btn.focus(); }
    });
    header.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".site-nav a")) setOpen(false);
    });
    document.addEventListener("click", function (e) {
      if (header.hasAttribute("data-nav-open") && !header.contains(e.target)) setOpen(false);
    });
    var wide = window.matchMedia ? window.matchMedia("(min-width: 960px)") : null;
    if (wide) {
      var close = function () { if (wide.matches) setOpen(false); };
      if (wide.addEventListener) wide.addEventListener("change", close);
      else if (wide.addListener) wide.addListener(close);
    }
  }

  /* Copy to clipboard -------------------------------------------------------- */
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function textToCopy(btn) {
    if (btn.hasAttribute("data-copy")) return btn.getAttribute("data-copy");
    var block = btn.closest(".code-block, .install-chip");
    var code = block && block.querySelector("pre, code");
    return code ? code.textContent.replace(/\s+$/, "") : "";
  }
  function initCopy() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".copy-btn");
      if (!btn) return;
      var text = textToCopy(btn);
      if (!text) return;
      copyText(text).then(function (ok) {
        var label = btn.querySelector(".copy-btn__label");
        var live = document.getElementById("copy-status");
        if (label) {
          if (!btn.hasAttribute("data-label")) btn.setAttribute("data-label", label.textContent);
          label.textContent = ok ? "Copied" : "Press Ctrl+C";
        }
        if (ok) btn.setAttribute("data-copied", "");
        if (live) live.textContent = ok ? "Copied to clipboard" : "Copy failed";
        window.clearTimeout(btn._copyTimer);
        btn._copyTimer = window.setTimeout(function () {
          btn.removeAttribute("data-copied");
          if (label) label.textContent = btn.getAttribute("data-label") || "Copy";
          if (live) live.textContent = "";
        }, 1800);
      });
    });
  }

  /* Heading anchors ------------------------------------------------------------
     A "#" link after the heading text, for copying a link to the section with a pointer.
     It is hidden from assistive technology and left out of the tab order, so screen readers
     do not read the heading twice. Visually hidden headings get none (it could not be seen). */
  function initAnchors() {
    var heads = document.querySelectorAll("main h2[id], main h3[id]");
    Array.prototype.forEach.call(heads, function (h) {
      if (h.classList.contains("no-anchor") || h.classList.contains("visually-hidden") ||
          h.querySelector(".heading-anchor")) return;
      var a = document.createElement("a");
      a.className = "heading-anchor";
      a.href = "#" + h.id;
      a.setAttribute("aria-hidden", "true");
      a.tabIndex = -1;
      a.title = "Link to this section";
      a.textContent = "#";
      h.appendChild(a);
    });
  }

  /* Active nav fallback ---------------------------------------------------------- */
  function initActiveNav() {
    var nav = document.querySelector(".site-nav");
    if (!nav || nav.querySelector('[aria-current="page"]')) return;
    var file = window.location.pathname.split("/").pop() || "index.html";
    Array.prototype.forEach.call(nav.querySelectorAll(".site-nav__list a"), function (a) {
      var href = (a.getAttribute("href") || "").split("#")[0];
      if (href === file) a.setAttribute("aria-current", "page");
    });
  }

  function init() {
    root.classList.remove("no-js");
    root.classList.add("js");
    initTheme();
    initMenu();
    initCopy();
    initAnchors();
    initActiveNav();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
