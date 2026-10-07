/**
 * The header is visible from the first frame, because over the hero the logo
 * is the only brandmark. It then hides while the visitor reads downward and
 * comes back on the way up — which also keeps it off the contact block, that
 * otherwise comes to rest underneath it at the very bottom of the page.
 */
(function () {
  "use strict";

  var header = document.querySelector("[data-site-header]");
  if (!header) return;

  var last = 0;
  var queued = false;

  function update() {
    queued = false;
    var y = window.scrollY;

    // The scrim only appears once the page has moved, so it never dims the
    // top of the hero.
    header.classList.toggle("is-scrolled", y > 40);

    var delta = y - last;
    // Ignore the small jitter smooth scrolling produces.
    if (Math.abs(delta) > 6) {
      var hide = y > 160 && delta > 0;
      header.classList.toggle("is-hidden", hide);
      // Keep the hidden header out of the tab order.
      header.toggleAttribute("inert", hide);
      last = y;
    }
  }

  window.addEventListener(
    "scroll",
    function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );

  update();
})();
