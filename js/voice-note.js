/**
 * Silent "voice note" visual: a waveform of vertical bars with a playhead
 * sweeping across it, rendered in a single full-screen fragment shader.
 * No audio is involved.
 *
 * Plain WebGL on purpose: the whole effect is one shader, so a 3D engine
 * would only add ~300 KB of JavaScript.
 *
 * Exposes `window.VoiceNote.LOOP_SECONDS` and `window.VoiceNote.create()`.
 */
(function () {
  "use strict";

  var LOOP_SECONDS = 11;
  /**
   * What costs is the number of pixels shaded per frame, not the device pixel
   * ratio. A Retina laptop at 1680x1050 asks for 4M pixels where a phone asks
   * for 0.33M, so a ratio cap alone lets big high-density screens — exactly
   * the ones with integrated graphics — do ten times the work of a phone.
   */
  var PIXEL_BUDGET = 1300000;
  var MAX_DPR_WIDE = 1.5;
  var MAX_DPR_SMALL = 1;
  /** Below 1 the canvas is upscaled; the bars are soft shapes, so it holds up. */
  var MIN_DPR = 0.7;

  var vertex = [
    "attribute vec2 aPos;",
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = aPos * 0.5 + 0.5;",
    "  gl_Position = vec4(aPos, 0.0, 1.0);",
    "}",
  ].join("\n");

  var fragment = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "  precision highp float;",
    "#else",
    "  precision mediump float;",
    "#endif",
    "  varying vec2 vUv;",
    "",
    "  uniform vec2 uRes;",
    "  uniform float uTime;",
    "  uniform float uProgress;",
    "  uniform float uBars;",
    "  uniform float uStatic;",
    "  // Layout: the wave composes around the copy instead of sitting under it.",
    "  uniform float uQuiet;     // 0..1 — how strongly the left side is ducked",
    "  uniform float uQuietTo;   // x (0..1) where the copy ends and the wave opens",
    "  uniform float uCenterY;   // vertical centre of the wave (0 = bottom)",
    "  uniform float uAmpScale;  // max bar half-height, as a share of the height",
    "",
    "  float hash11(float p) {",
    "    p = fract(p * 0.1031);",
    "    p *= p + 33.33;",
    "    p *= p + p;",
    "    return fract(p);",
    "  }",
    "  // Speech-like envelope: syllable bursts with pauses between phrases.",
    "  float amplitude(float id) {",
    "    float syllable = 0.5 + 0.5 * sin(id * 0.43 + 2.0 * sin(id * 0.11));",
    "    float phrase = 0.20 + 0.80 * smoothstep(0.10, 0.48, 0.5 + 0.5 * sin(id * 0.105 + 1.3));",
    "    float grit = 0.35 + 0.65 * hash11(id * 1.37);",
    "    return clamp(syllable * phrase * grit + 0.05, 0.05, 1.0);",
    "  }",
    "",
    "  void main() {",
    "    vec2 px = vUv * uRes;",
    "",
    "    // The paper lives in CSS; this canvas is transparent and lays ink on top",
    "    // of it. Output is premultiplied alpha, which composites as source-over.",
    "    vec3 INK = vec3(0.078, 0.118, 0.102);     // #141e1a",
    "    vec3 ACCENT = vec3(0.039, 0.435, 0.659);  // #0a6fa8",
    "",
    "    vec3 col = INK;",
    "    float a = 0.0;",
    "",
    "    // ---------- voice-note bars ----------",
    "    float pitch = uRes.x / uBars;",
    "    float barW = pitch * 0.42;",
    "    float id = floor(px.x / pitch);",
    "    float cx = (id + 0.5) * pitch;",
    "    float nx = cx / uRes.x;",
    "",
    "    // Ease the loop restart: the recorded part fades back before it wraps.",
    "    float fade = mix(1.0, (1.0 - smoothstep(0.94, 1.0, uProgress)), 1.0 - uStatic);",
    "    float head = uProgress * uBars;",
    "    float played = (1.0 - step(head, id + 0.5)) * fade;",
    "    float dHead = (id + 0.5 - head);",
    "",
    "    // Stay low and faint where the copy sits (left on wide screens), then",
    "    // open up to the right, so the text never needs a scrim over the wave.",
    "    float duck = mix(1.0, 0.04 + 0.96 * smoothstep(uQuietTo - 0.06, uQuietTo + 0.16, nx), uQuiet);",
    "",
    "    float amp = amplitude(id);",
    "    // Live motion concentrated around the playhead.",
    "    float near = exp(-dHead * dHead * 0.02) * (1.0 - uStatic);",
    "    amp *= 1.0 + near * (0.35 * sin(uTime * 13.0 + id * 1.7) + 0.25);",
    "    amp = clamp(amp, 0.04, 1.0) * duck;",
    "",
    "    float halfH = amp * uRes.y * uAmpScale;",
    "    float cy = uRes.y * uCenterY;",
    "    float dx = abs(px.x - cx);",
    "    float dy = abs(px.y - cy);",
    "    vec2 q = vec2(dx, max(dy - max(halfH - barW * 0.5, 0.0), 0.0));",
    "    float d = length(q) - barW * 0.5;",
    "    float body = 1.0 - smoothstep(-0.5, 1.0, d);",
    "",
    "    // Recorded so far reads in the accent; still to come is a light ink grey.",
    "    col = mix(INK, ACCENT, played);",
    "    float barAlpha = body * mix(0.34, 0.9, played)",
    "                     * mix(1.0, 0.06 + 0.94 * smoothstep(uQuietTo - 0.04, uQuietTo + 0.14, nx), uQuiet);",
    "    a = barAlpha;",
    "",
    "    // ---------- time axis: a measured strip, not a music player ----------",
    "    float axisY = cy - uRes.y * (uAmpScale + 0.055);",
    "    float tickSpacing = uRes.x / 28.0;",
    "    float tx = abs(mod(px.x + tickSpacing * 0.5, tickSpacing) - tickSpacing * 0.5);",
    "    float onTick = (1.0 - smoothstep(0.4, 1.2, tx))",
    "                 * (1.0 - smoothstep(uRes.y * 0.004, uRes.y * 0.013, abs(px.y - axisY)));",
    "    float axisAlpha = onTick * 0.3 * uQuiet",
    "                    * smoothstep(0.02, 0.14, nx) * (1.0 - smoothstep(0.86, 0.99, nx));",
    "    col = mix(col, INK, step(a, axisAlpha));",
    "    a = max(a, axisAlpha);",
    "",
    "    // ---------- playhead ----------",
    "    float headPx = head * pitch;",
    "    float dp = abs(px.x - headPx);",
    "    float line = (1.0 - smoothstep(0.0, 1.3, dp))",
    "               * (1.0 - smoothstep(uRes.y * uAmpScale * 0.3, uRes.y * (uAmpScale + 0.02), abs(px.y - cy)));",
    "    float headDuck = mix(1.0, 0.2 + 0.8 * smoothstep(uQuietTo - 0.06, uQuietTo + 0.18, headPx / uRes.x), uQuiet);",
    "    float lineAlpha = line * 0.85 * fade * headDuck;",
    "    col = mix(col, ACCENT, step(a, lineAlpha));",
    "    a = max(a, lineAlpha);",
    "",
    "    a = clamp(a, 0.0, 1.0);",
    "    gl_FragColor = vec4(col * a, a);",
    "  }",
  ].join("\n");

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.wrap    element the canvas fills
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} [opts.copy]  block the wave should stay quiet behind
   * @param {function} [opts.onFrame]  called each frame with the playhead (0–1)
   */
  function create(opts) {
    var box = opts.wrap;
    var cv = opts.canvas;
    if (!box || !cv) return;

    var gl = cv.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    var vs = compile(gl, gl.VERTEX_SHADER, vertex);
    var fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
    var program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // One oversized triangle covers the whole viewport.
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // The shader writes premultiplied RGBA directly: no blending.
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);

    var uRes = gl.getUniformLocation(program, "uRes");
    var uTime = gl.getUniformLocation(program, "uTime");
    var uProgress = gl.getUniformLocation(program, "uProgress");
    var uBars = gl.getUniformLocation(program, "uBars");
    var uStatic = gl.getUniformLocation(program, "uStatic");
    var uQuiet = gl.getUniformLocation(program, "uQuiet");
    var uQuietTo = gl.getUniformLocation(program, "uQuietTo");
    var uCenterY = gl.getUniformLocation(program, "uCenterY");
    var uAmpScale = gl.getUniformLocation(program, "uAmpScale");

    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    var reduced = mq.matches;
    var visible = true;
    var raf = 0;
    var start = -1;

    // Halved once, and only once, if the first seconds come in slow: there is
    // no way to know a visitor's GPU up front.
    var budget = PIXEL_BUDGET;

    function resize() {
      var cap = box.clientWidth >= 1024 ? MAX_DPR_WIDE : MAX_DPR_SMALL;
      var area = Math.max(1, box.clientWidth * box.clientHeight);
      var dpr = Math.min(
        Math.max(window.devicePixelRatio || 1, 1),
        cap,
        Math.max(MIN_DPR, Math.sqrt(budget / area)),
      );
      var w = Math.max(1, Math.round(box.clientWidth * dpr));
      var h = Math.max(1, Math.round(box.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      // ~1 bar per 17 CSS px, clamped so phones still get a dense, legible wave.
      gl.uniform1f(uBars, Math.max(44, Math.min(150, Math.round(box.clientWidth / 17))));

      // Wide: copy on the left, wave opens to the right, both centred.
      // Narrow: copy on top, the whole wave drops to the lower half.
      // Mirrors the `hero-side` media query in site.css.
      var cssW = box.clientWidth;
      var wide = cssW >= 1024 || (cssW >= 640 && box.clientHeight <= 620);
      gl.uniform1f(uQuiet, wide ? 1 : 0);
      // Where the copy actually ends, measured rather than assumed: on very
      // wide screens the centred container pushes it far from the left edge.
      var copy = opts.copy;
      var copyRight = copy
        ? (copy.getBoundingClientRect().right - box.getBoundingClientRect().left) / cssW
        : 0.45;
      gl.uniform1f(uQuietTo, Math.min(0.72, Math.max(0.2, copyRight)));
      gl.uniform1f(uCenterY, wide ? 0.5 : 0.3);
      gl.uniform1f(uAmpScale, wide ? 0.3 : 0.24);
    }

    function draw(progress, t) {
      gl.uniform1f(uTime, t);
      gl.uniform1f(uProgress, progress);
      gl.uniform1f(uStatic, reduced ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Frame-time watch: samples the opening seconds and, if the device is
    // clearly struggling, drops the budget once and re-sizes.
    var samples = [];
    var lastFrame = 0;
    var downgraded = false;

    function watch(now) {
      if (downgraded) return;
      if (lastFrame) samples.push(now - lastFrame);
      lastFrame = now;
      if (samples.length < 90) return;
      var median = samples.sort(function (a, b) {
        return a - b;
      })[45];
      samples = [];
      if (median > 24) {
        downgraded = true;
        budget = Math.round(budget * 0.55);
        resize();
      }
    }

    function tick() {
      var now = performance.now();
      if (start < 0) start = now;
      var t = (now - start) / 1000;
      var progress = (t % LOOP_SECONDS) / LOOP_SECONDS;
      draw(progress, t);
      if (opts.onFrame) opts.onFrame(progress);
      watch(now);
      raf = requestAnimationFrame(tick);
    }

    function sync() {
      cancelAnimationFrame(raf);
      resize();
      if (reduced) draw(0.58, 0); // a still frame
      else if (visible) raf = requestAnimationFrame(tick);
    }

    var ro = new ResizeObserver(function () {
      resize();
      if (reduced) draw(0.58, 0);
    });
    ro.observe(box);
    if (opts.copy) ro.observe(opts.copy);

    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    });
    io.observe(box);

    mq.addEventListener("change", function () {
      reduced = mq.matches;
      sync();
    });

    cv.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
    });

    sync();
  }

  window.VoiceNote = { LOOP_SECONDS: LOOP_SECONDS, create: create };
})();
