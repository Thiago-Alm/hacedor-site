/**
 * Custom-controlled video. There is deliberately no native `controls`
 * attribute, so the browser's download button and menu never appear. This
 * deters casual saving; it cannot stop a determined user (any video a
 * browser can play can be captured).
 *
 * The control bar's visibility is a small state machine, kept in data
 * attributes on the player so the CSS decides how each state looks:
 *   data-started  the video has been played at least once
 *   data-playing  it is playing right now
 *   data-full     it is in full screen
 *   data-idle     it is playing and nobody has touched anything for a
 *                 while, so the controls and the pointer are out of the way
 */
(function () {
  "use strict";

  function fmt(s) {
    if (!isFinite(s)) return "0:00";
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function setUp(box) {
    var video = box.querySelector("video");
    var bigPlay = box.querySelector("[data-big-play]");
    var playBtn = box.querySelector("[data-play]");
    var muteBtn = box.querySelector("[data-mute]");
    var fsBtn = box.querySelector("[data-fullscreen]");
    var seek = box.querySelector("input.seek");
    var elapsed = box.querySelector("[data-elapsed]");
    var total = box.querySelector("[data-duration]");
    if (!video) return;

    // Right-clicking a video offers "Save video as"; the custom chrome
    // exists to not advertise that, so the menu goes too.
    box.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    function toggle() {
      if (video.paused) video.play();
      else video.pause();
    }

    /* -----------------------------------------------------------------
       Getting out of the way

       While the video plays, the controls hide themselves after a few
       seconds without input, and the pointer hides with them. Anything
       the visitor does brings them back.

       Hover is not what decides this: the pointer is already on the
       player at the moment of the click that starts the video, so a
       hover rule would keep the bar up for the whole thing.
       ----------------------------------------------------------------- */

    var IDLE_DELAY = 2600;
    var idleTimer = null;

    // Is somebody navigating the controls with the keyboard right now?
    // Having focus is not enough to say yes: clicking the play button
    // leaves focus on it, and that must not keep the bar on screen for
    // the whole video. :focus-visible is the browser's own answer to
    // "was this focus reached by keyboard", which is the question.
    function keyboardInside() {
      var el = document.activeElement;
      if (!el || el === video || !box.contains(el)) return false;
      return typeof el.matches === "function" && el.matches(":focus-visible");
    }

    function sleep() {
      if (video.paused) return;
      // Hiding what somebody is tabbing through would leave them nowhere.
      // `focusout` wakes it again, so the timer restarts when they leave.
      if (keyboardInside()) return;
      box.setAttribute("data-idle", "");
    }

    function wake() {
      box.removeAttribute("data-idle");
      clearTimeout(idleTimer);
      if (!video.paused) idleTimer = setTimeout(sleep, IDLE_DELAY);
    }

    box.addEventListener("pointermove", wake);
    box.addEventListener("focusin", wake);
    box.addEventListener("focusout", wake);

    box.addEventListener("pointerleave", function () {
      // The pointer left the player: there is nothing to keep the
      // controls up for.
      clearTimeout(idleTimer);
      sleep();
    });

    function paintSeek() {
      var pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      seek.style.setProperty("--p", pct + "%");
      seek.value = String(video.currentTime);
      elapsed.textContent = fmt(video.currentTime);
    }

    function setDuration() {
      seek.max = String(video.duration || 0);
      total.textContent = fmt(video.duration);
    }

    video.addEventListener("click", function () {
      // A click that lands while the controls are hidden is asking for
      // them back, not asking to pause. With a mouse this never comes
      // up, because moving the pointer already woke them; on a phone,
      // without it, the first tap would stop the video.
      if (box.hasAttribute("data-idle")) wake();
      else toggle();
    });
    bigPlay.addEventListener("click", toggle);
    playBtn.addEventListener("click", function () {
      wake();
      toggle();
    });

    video.addEventListener("play", function () {
      box.setAttribute("data-playing", "");
      box.setAttribute("data-started", "");
      bigPlay.tabIndex = -1;
      playBtn.setAttribute("aria-label", "Pause");
      wake();
    });
    video.addEventListener("pause", function () {
      box.removeAttribute("data-playing");
      bigPlay.tabIndex = 0;
      playBtn.setAttribute("aria-label", "Play");
      wake();
    });
    video.addEventListener("ended", function () {
      box.removeAttribute("data-playing");
      bigPlay.tabIndex = 0;
      wake();
    });

    video.addEventListener("loadedmetadata", setDuration);
    video.addEventListener("durationchange", setDuration);
    video.addEventListener("timeupdate", paintSeek);
    // Metadata can already be there when this runs.
    if (video.readyState >= 1) setDuration();

    seek.addEventListener("input", function () {
      video.currentTime = Number(seek.value);
      paintSeek();
      wake();
    });

    muteBtn.addEventListener("click", function () {
      wake();
      video.muted = !video.muted;
      box.toggleAttribute("data-muted", video.muted);
      muteBtn.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
    });

    fsBtn.addEventListener("click", function () {
      wake();
      if (document.fullscreenElement) document.exitFullscreen();
      else if (box.requestFullscreen) box.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iPhone Safari
    });

    document.addEventListener("fullscreenchange", function () {
      var on = document.fullscreenElement === box;
      box.toggleAttribute("data-full", on);
      fsBtn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
    });
  }

  var players = document.querySelectorAll("[data-video-player]");
  Array.prototype.forEach.call(players, setUp);
})();
