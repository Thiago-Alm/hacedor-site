/**
 * The footer's voice-wave divider. Drawn on one small 2D canvas and only
 * while it is on screen: 120 separately animated DOM bars kept the browser
 * re-styling the page on every frame, even when scrolled far away.
 */
(function () {
  "use strict";

  var box = document.querySelector("[data-wave]");
  var cv = box && box.querySelector("canvas");
  var ctx = cv && cv.getContext("2d");
  if (!box || !cv || !ctx) return;

  // The paper-safe brand hues (see the --ink-* tokens in site.css): the raw
  // logo colours wash out completely on a bone ground.
  var PALETTE = [
    [0, 115, 182],
    [54, 125, 26],
    [121, 111, 6],
    [185, 77, 19],
    [210, 8, 130],
    [122, 26, 160],
  ];
  var BARS = 120;
  var BAR_W = 3;

  function colorAt(t) {
    var x = t * (PALETTE.length - 1);
    var i = Math.min(PALETTE.length - 2, Math.floor(x));
    var f = x - i;
    var a = PALETTE[i];
    var b = PALETTE[i + 1];
    return (
      "rgb(" +
      a
        .map(function (v, k) {
          return Math.round(v + (b[k] - v) * f);
        })
        .join(",") +
      ")"
    );
  }

  var bars = [];
  for (var i = 0; i < BARS; i++) {
    var t = i / (BARS - 1);
    // speech-like envelope, tallest mid-row, deterministic
    var envelope = 0.35 + 0.65 * Math.pow(Math.sin(t * Math.PI), 1.4);
    var grit = 0.55 + 0.45 * Math.abs(Math.sin(i * 12.9898));
    bars.push({
      color: colorAt(t),
      height: Math.round(10 + 38 * envelope * grit),
      delay: -((i * 0.37) % 2.6),
      duration: 1.9 + ((i * 7) % 10) / 10,
    });
  }

  function easeInOut(x) {
    return x * x * (3 - 2 * x);
  }

  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduced = mq.matches;
  var visible = false;
  var raf = 0;
  var w = 0;
  var h = 0;
  var dpr = 1;
  var origin = performance.now();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = box.clientWidth;
    h = box.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 0.85;
    // Phones get every other bar.
    var list = w < 768 ? bars.filter(function (_, i) { return i % 2 === 0; }) : bars;
    var step = (w - BAR_W) / (list.length - 1);

    list.forEach(function (bar, i) {
      var scale = 0.6;
      if (!reduced) {
        var frac = ((((t - bar.delay) / bar.duration) % 1) + 1) % 1;
        scale = 0.28 + 0.72 * easeInOut(frac < 0.5 ? frac * 2 : 2 - frac * 2);
      }
      var bh = bar.height * scale;
      ctx.fillStyle = bar.color;
      ctx.beginPath();
      ctx.roundRect(i * step, (h - bh) / 2, BAR_W, bh, BAR_W / 2);
      ctx.fill();
    });
  }

  // ~30fps: the pulse is slow, and this halves the work on phones.
  var lastDraw = 0;
  function tick() {
    var now = performance.now();
    if (now - lastDraw >= 32) {
      lastDraw = now;
      draw((now - origin) / 1000);
    }
    raf = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(raf);
    // Narrow screens get a single static frame: an ambient canvas loop is
    // not worth the battery for a divider.
    var still = reduced || !visible || w < 768;
    if (still) draw(0);
    else raf = requestAnimationFrame(tick);
  }

  new ResizeObserver(function () {
    resize();
    sync();
  }).observe(box);

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    sync();
  }).observe(box);

  mq.addEventListener("change", function () {
    reduced = mq.matches;
    sync();
  });
})();
