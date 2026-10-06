/**
 * "How it works" is scroll-driven in both of its layouts.
 *
 * On a screen with room the stage is pinned for three viewport heights and
 * the scroll position chooses the step. Everywhere else the four steps are a
 * timeline whose rail fills as the list goes by.
 *
 * Both read the page position the same way: how far the scroll has travelled
 * between two points, expressed as 0 to 1. The rail is then a single
 * `--progress` custom property, and the browser scales it on the GPU.
 */
(function () {
  "use strict";

  var section = document.getElementById("how-it-works");
  if (!section) return;

  var STEPS = 4;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** Scroll position, clamped to 0..1, between two document offsets. */
  function between(from, to) {
    if (to <= from) return 0;
    return Math.min(1, Math.max(0, (window.scrollY - from) / (to - from)));
  }

  var writes = [];
  var queued = false;

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      for (var i = 0; i < writes.length; i++) writes[i]();
    });
  }

  /* ---------------------------------------------------------------------
     The pinned stage
     --------------------------------------------------------------------- */

  var track = section.querySelector("[data-pinned-track]");
  if (track) {
    var stepsEls = section.querySelectorAll("[data-pinned] [data-step]");
    var arts = section.querySelectorAll(".hiw-stage > .step-art");
    var hud = section.querySelector("[data-hud]");
    // the chip is one text run; its last node carries the label
    var rail = section.querySelector("[data-pinned] .hiw-rail");
    var active = -1;

    // The travel is the part of the track that scrolls past while the stage
    // is stuck: its height less one viewport.
    function bounds() {
      var top = track.getBoundingClientRect().top + window.scrollY;
      return { top: top, travel: track.offsetHeight - window.innerHeight };
    }

    function paintPinned() {
      var b = bounds();
      var p = between(b.top, b.top + b.travel);
      if (rail) rail.style.setProperty("--progress", String(p));

      var i = Math.min(STEPS - 1, Math.max(0, Math.floor(p * STEPS)));
      if (i === active) return;
      active = i;

      for (var k = 0; k < stepsEls.length; k++) {
        stepsEls[k].toggleAttribute("data-on", k === i);
        var btn = stepsEls[k].querySelector("button");
        if (btn) {
          if (k === i) btn.setAttribute("aria-current", "step");
          else btn.removeAttribute("aria-current");
        }
      }
      for (var j = 0; j < arts.length; j++) {
        arts[j].toggleAttribute("data-on", j === i);
        // the sweep only runs on the diagram in play
        arts[j].setAttribute("data-active", j === i && arts[j].dataset.inview === "1" ? "true" : "false");
      }
      if (hud) hud.style.setProperty("--step-accent", stepsEls[i].style.getPropertyValue("--step-accent"));
      if (hud) hud.lastChild.textContent = "Step " + stepsEls[i].getAttribute("data-n") + " / 04";
    }

    writes.push(paintPinned);

    // Clicking a step scrolls to the middle of its stretch of the track.
    Array.prototype.forEach.call(stepsEls, function (li, i) {
      var btn = li.querySelector("button");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var b = bounds();
        var y = b.top + ((i + 0.5) / STEPS) * b.travel;
        if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.4 });
        else window.scrollTo({ top: y, behavior: reduced.matches ? "auto" : "smooth" });
      });
    });
  }

  /* ---------------------------------------------------------------------
     The stacked timeline

     The rail starts filling when the list reaches three quarters of the way
     up the viewport and is full when its end passes sixty percent.
     --------------------------------------------------------------------- */

  var list = section.querySelector("[data-stacked-list]");
  if (list) {
    var stackedRail = list.querySelector(".hiw-rail");
    writes.push(function () {
      var r = list.getBoundingClientRect();
      var top = r.top + window.scrollY;
      var from = top - window.innerHeight * 0.75;
      var to = top + r.height - window.innerHeight * 0.6;
      if (stackedRail) stackedRail.style.setProperty("--progress", String(between(from, to)));
    });
  }

  /* ---------------------------------------------------------------------
     Only a diagram that is on screen may animate: animations inside an SVG
     are not composited, so an off-screen one would still cost every frame.
     --------------------------------------------------------------------- */

  var allArt = section.querySelectorAll(".step-art");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          e.target.dataset.inview = e.isIntersecting ? "1" : "0";
          // in the stacked layout every step is "in play"; in the pinned one
          // the stage decides, and paintPinned has the last word
          if (!e.target.closest("[data-pinned]")) {
            e.target.setAttribute("data-active", e.isIntersecting ? "true" : "false");
          } else if (!e.isIntersecting) {
            e.target.setAttribute("data-active", "false");
          }
        });
      },
      { rootMargin: "10% 0px" },
    );
    Array.prototype.forEach.call(allArt, function (el) {
      io.observe(el);
    });
  } else {
    Array.prototype.forEach.call(allArt, function (el) {
      el.setAttribute("data-active", "true");
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
})();
