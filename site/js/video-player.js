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

    // A mouse brings the controls back by merely moving, so it can afford
    // to lose them quickly. A finger has to travel and land on a target it
    // can no longer see, so hiding too eagerly turns into a chase.
    var IDLE_MOUSE = 2600;
    var IDLE_TOUCH = 4000;

    var idleTimer = null;
    var lastPointer = "mouse";

    // Is somebody navigating the controls with the keyboard right now?
    //
    // Having focus is not enough to say yes: clicking the play button
    // leaves focus on it, and that must not keep the bar up for the whole
    // video. The browsers' own answer to this, :focus-visible, does not
    // mean the same thing everywhere — some of them call a clicked button
    // keyboard-focused — and when it says yes wrongly the controls never
    // leave. So the question is answered here instead, by remembering
    // what the visitor last did.
    var lastInputWasKey = false;
    document.addEventListener("keydown", function () { lastInputWasKey = true; }, true);
    document.addEventListener("pointerdown", function () { lastInputWasKey = false; }, true);

    function keyboardInside() {
      var el = document.activeElement;
      if (!el || el === video || !box.contains(el)) return false;
      return lastInputWasKey;
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
      if (!video.paused) {
        idleTimer = setTimeout(sleep, lastPointer === "mouse" ? IDLE_MOUSE : IDLE_TOUCH);
      }
    }

    box.addEventListener("pointermove", function (e) {
      lastPointer = e.pointerType || "mouse";
      wake();
    });

    box.addEventListener("pointerdown", function (e) {
      lastPointer = e.pointerType || "mouse";
      // Pressing a control restarts the clock. Not the video itself: a
      // tap there, while the controls are away, is only asking for them
      // back, and that is settled on the click so the video is not
      // paused by the same gesture.
      if (e.target !== video) wake();
    });

    box.addEventListener("focusin", wake);
    box.addEventListener("focusout", wake);

    box.addEventListener("pointerleave", function (e) {
      // Only a mouse can leave. A finger lifting off the glass also
      // raises this event, and it does so at the end of every single
      // tap — including the tap that just asked for the controls. Acting
      // on that put them away again before they could be used, which
      // left them impossible to reach on a phone.
      if ((e.pointerType || "mouse") !== "mouse") return;
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

      // The big button has just disappeared under the playing video, and
      // leaving the focus on something invisible is a dead end: the
      // visitor cannot see what the keyboard would act on. Somebody who
      // got here with the keyboard is handed the pause button, which is
      // where they were going anyway; somebody who clicked simply lets it
      // go, and with it the only reason the controls would have stayed up.
      if (document.activeElement === bigPlay) {
        if (lastInputWasKey) playBtn.focus();
        else bigPlay.blur();
      }

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
