/**
 * Hero behaviour: the waveform, the coloured sheen that travels across the
 * headline with the playhead, the voice-note clock, the magnetic button and
 * the fade-out as the visitor scrolls away.
 *
 * Everything that runs per frame writes straight to a DOM node's own style.
 * Setting a custom property on a shared ancestor instead invalidated that
 * whole subtree every frame, which dominated CPU on a phone.
 */
(function () {
  "use strict";

  var section = document.getElementById("top");
  if (!section || !window.VoiceNote) return;

  var LOOP_SECONDS = window.VoiceNote.LOOP_SECONDS;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var wrap = section.querySelector("[data-voice-note]");
  var canvas = wrap && wrap.querySelector("canvas");
  var copy = section.querySelector("[data-hero-copy]");
  var headline = section.querySelector("[data-hero-headline]");
  var clock = section.querySelector("[data-hero-clock]");
  var fadeTargets = section.querySelectorAll("[data-hero-fade]");

  function fmt(s) {
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  /* ---------------------------------------------------------------------
     Sheen + clock, driven by the waveform's playhead
     --------------------------------------------------------------------- */

  // Headline position, measured once (and on resize) rather than every
  // frame: reading layout each frame forces the browser to re-style.
  var geom = { left: 0, box: 1 };
  var sheens = [];
  var shownSecond = -1;

  function measure() {
    if (!headline) return;
    geom.left = headline.getBoundingClientRect().left;
    geom.box = section.clientWidth || 1;
    sheens = Array.prototype.slice.call(headline.querySelectorAll(".sheen"));
  }

  function onFrame(p) {
    if (sheens.length) {
      var x = Math.round(p * geom.box - geom.left - 132) + "px 0";
      for (var i = 0; i < sheens.length; i++) {
        sheens[i].style.maskPosition = x;
        sheens[i].style.webkitMaskPosition = x;
      }
    }

    var sec = Math.floor(p * LOOP_SECONDS);
    if (clock && sec !== shownSecond) {
      shownSecond = sec;
      clock.textContent = fmt(sec);
    }
  }

  /* The sheen only exists on the wide layout, where the copy sits beside the
     wave; mirrors the `hero-side` media query in site.css. */
  var sideBySide = window.matchMedia(
    "(min-width: 1024px), (min-width: 640px) and (max-height: 620px)",
  );

  function syncSheen() {
    if (!headline) return;
    var on = sideBySide.matches && !reduced.matches;
    headline.toggleAttribute("data-sheen", on);
    measure();
    if (!on) {
      // Park it off screen so a stale position cannot show through.
      for (var i = 0; i < sheens.length; i++) {
        sheens[i].style.maskPosition = "-9999px 0";
        sheens[i].style.webkitMaskPosition = "-9999px 0";
      }
    }
  }

  syncSheen();
  sideBySide.addEventListener("change", syncSheen);
  reduced.addEventListener("change", syncSheen);

  if (headline) {
    var ro = new ResizeObserver(measure);
    ro.observe(headline);
    ro.observe(section);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  if (reduced.matches && clock) clock.textContent = fmt(Math.floor(0.58 * LOOP_SECONDS));

  window.VoiceNote.create({ wrap: wrap, canvas: canvas, copy: copy, onFrame: onFrame });

  /* ---------------------------------------------------------------------
     Hero content eases out as the visitor scrolls away
     --------------------------------------------------------------------- */

  if (fadeTargets.length && !reduced.matches) {
    var queued = false;

    function applyScroll() {
      queued = false;
      var t = Math.min(1, Math.max(0, window.scrollY / 420));
      var opacity = String(1 - t);
      var lift = "translate3d(0," + -48 * t + "px,0)";
      for (var i = 0; i < fadeTargets.length; i++) {
        var el = fadeTargets[i];
        el.style.opacity = opacity;
        // Only the copy block moves; the read-out at the edge just fades.
        if (el.hasAttribute("data-hero-lift")) el.style.transform = lift;
      }
    }

    window.addEventListener(
      "scroll",
      function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(applyScroll);
      },
      { passive: true },
    );
    applyScroll();
  }

  /* ---------------------------------------------------------------------
     Magnetic button: leans a little toward the cursor, on a spring

     Matches the spring the old component used (stiffness 220, damping 18,
     mass 0.4), integrated at a fixed step so the feel does not change with
     the display's refresh rate.
     --------------------------------------------------------------------- */

  var magnet = section.querySelector("[data-magnetic]");

  if (magnet && window.matchMedia("(hover: hover)").matches && !reduced.matches) {
    var STIFFNESS = 220;
    var DAMPING = 18;
    var MASS = 0.4;
    var STEP = 1 / 60;

    var target = { x: 0, y: 0 };
    var pos = { x: 0, y: 0 };
    var vel = { x: 0, y: 0 };
    var springRaf = 0;
    var last = 0;
    var carry = 0;

    function settle() {
      return (
        Math.abs(pos.x - target.x) < 0.01 &&
        Math.abs(pos.y - target.y) < 0.01 &&
        Math.abs(vel.x) < 0.01 &&
        Math.abs(vel.y) < 0.01
      );
    }

    function springTick(now) {
      var dt = last ? Math.min(0.064, (now - last) / 1000) : STEP;
      last = now;
      carry += dt;

      while (carry >= STEP) {
        carry -= STEP;
        ["x", "y"].forEach(function (axis) {
          var a = (-STIFFNESS * (pos[axis] - target[axis]) - DAMPING * vel[axis]) / MASS;
          vel[axis] += a * STEP;
          pos[axis] += vel[axis] * STEP;
        });
      }

      magnet.style.transform = "translate3d(" + pos.x + "px," + pos.y + "px,0)";

      if (settle()) {
        pos.x = target.x;
        pos.y = target.y;
        vel.x = 0;
        vel.y = 0;
        magnet.style.transform = "translate3d(" + pos.x + "px," + pos.y + "px,0)";
        springRaf = 0;
        last = 0;
        carry = 0;
        return;
      }
      springRaf = requestAnimationFrame(springTick);
    }

    function kick() {
      if (!springRaf) springRaf = requestAnimationFrame(springTick);
    }

    magnet.addEventListener("mousemove", function (e) {
      var r = magnet.getBoundingClientRect();
      target.x = (e.clientX - (r.left + r.width / 2)) * 0.22;
      target.y = (e.clientY - (r.top + r.height / 2)) * 0.3;
      kick();
    });

    magnet.addEventListener("mouseleave", function () {
      target.x = 0;
      target.y = 0;
      kick();
    });
  }
})();
