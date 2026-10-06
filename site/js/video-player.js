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

    video.addEventListener("click", toggle);
    bigPlay.addEventListener("click", toggle);
    playBtn.addEventListener("click", toggle);

    video.addEventListener("play", function () {
      box.setAttribute("data-playing", "");
      box.setAttribute("data-started", "");
      bigPlay.tabIndex = -1;
      playBtn.setAttribute("aria-label", "Pause");
    });
    video.addEventListener("pause", function () {
      box.removeAttribute("data-playing");
      bigPlay.tabIndex = 0;
      playBtn.setAttribute("aria-label", "Play");
    });
    video.addEventListener("ended", function () {
      box.removeAttribute("data-playing");
      bigPlay.tabIndex = 0;
    });

    video.addEventListener("loadedmetadata", setDuration);
    video.addEventListener("durationchange", setDuration);
    video.addEventListener("timeupdate", paintSeek);
    // Metadata can already be there when this runs.
    if (video.readyState >= 1) setDuration();

    seek.addEventListener("input", function () {
      video.currentTime = Number(seek.value);
      paintSeek();
    });

    muteBtn.addEventListener("click", function () {
      video.muted = !video.muted;
      box.toggleAttribute("data-muted", video.muted);
      muteBtn.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
    });

    fsBtn.addEventListener("click", function () {
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
