/**
 * Site-wide behaviour: smooth scrolling, scroll reveals, and pausing
 * animations that have scrolled out of view.
 *
 * Everything here is plain DOM. The only dependency is Lenis, which is
 * framework-agnostic and loaded before this file.
 */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------------
     Smooth scrolling
     --------------------------------------------------------------------- */

  var lenis = null;

  if (window.Lenis && !reduced.matches) {
    lenis = new window.Lenis({ lerp: 0.09 });
    requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    });
    // Other scripts have to scroll through Lenis rather than around it:
    // window.scrollTo is undone on the next frame by Lenis's own target.
    window.__lenis = lenis;
  }

  /* ---------------------------------------------------------------------
     In-page anchors: a slow, eased slide to the target section rather than
     the browser's jump (instant when the visitor prefers reduced motion).
     --------------------------------------------------------------------- */

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;

    var href = a.getAttribute("href");
    if (!href || href === "#") return;

    var target = href === "#top" ? 0 : href;
    if (href !== "#top" && !document.querySelector(href)) return;

    e.preventDefault();
    var instant = reduced.matches;

    if (lenis) {
      lenis.scrollTo(target, { duration: 1.6, easing: easeOutQuart, immediate: instant });
    } else if (target === 0) {
      window.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
    } else {
      document.querySelector(href).scrollIntoView({ behavior: instant ? "auto" : "smooth" });
    }
  });

  /* ---------------------------------------------------------------------
     Reveal on scroll

     `data-reveal` holds the fraction of the element that must be on screen
     before it animates in, matching the `amount` the old components asked
     for. Each element is unobserved once it has played: these only ever
     run once.
     --------------------------------------------------------------------- */

  var revealed = [];

  function revealAll() {
    for (var i = 0; i < revealed.length; i++) revealed[i].classList.add("is-visible");
  }

  function initReveals() {
    // `data-reveal` animates the element itself. `data-reveal-group` does not
    // animate — it waits for the same threshold and then lets its
    // `data-rise` children in, each on its own delay.
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll("[data-reveal], [data-reveal-group]"),
    );
    revealed = nodes;

    if (!("IntersectionObserver" in window) || reduced.matches) {
      revealAll();
      return;
    }

    // One observer per distinct threshold: IntersectionObserver takes the
    // threshold at construction, not per element.
    var byAmount = {};
    nodes.forEach(function (el) {
      var raw = el.getAttribute("data-reveal");
      if (raw === null || raw === "") raw = el.getAttribute("data-reveal-group");
      var amount = parseFloat(raw) || 0;
      (byAmount[amount] = byAmount[amount] || []).push(el);
    });

    Object.keys(byAmount).forEach(function (amount) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          });
        },
        { threshold: Math.min(0.99, parseFloat(amount)) },
      );
      byAmount[amount].forEach(function (el) {
        io.observe(el);
      });
    });
  }

  /* ---------------------------------------------------------------------
     Pause off-screen animations

     Looping CSS animations keep the main thread busy on every frame even
     when scrolled far out of view. Marked sections get [data-paused] while
     they are away.
     --------------------------------------------------------------------- */

  function initPauseOffscreen() {
    if (!("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll("[data-pause-offscreen]");
    if (!targets.length) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          e.target.toggleAttribute("data-paused", !e.isIntersecting);
        });
      },
      { rootMargin: "120px 0px" },
    );
    Array.prototype.forEach.call(targets, function (el) {
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     Entrance animations

     The hero's opening sequence is CSS; it waits for `.is-ready` on the
     document so the transitions have a frame to settle first and cannot
     play before the page has painted.
     --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     Copyright year

     Written into the HTML so the footer is right with scripting off, and
     refreshed here so the page does not go stale on its own.
     --------------------------------------------------------------------- */

  function initYear() {
    var el = document.querySelector("[data-year]");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function start() {
    initReveals();
    initPauseOffscreen();
    initYear();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.classList.add("is-ready");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
