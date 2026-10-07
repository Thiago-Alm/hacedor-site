/**
 * Two small interactions that belong to the lower half of the page:
 * the pool of light that follows the cursor across a team card, and the
 * button that puts the contact address on the clipboard.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Team cards: the glow's position is two custom properties, written on
     the card itself. Only one card can be under the cursor at a time, so
     this costs a single style write per move.
     --------------------------------------------------------------------- */

  var cards = document.querySelectorAll("[data-member]");
  Array.prototype.forEach.call(cards, function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", e.clientX - r.left + "px");
      card.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  /* ---------------------------------------------------------------------
     Copy the address. The clipboard can be refused (an insecure origin, a
     denied permission), and that is fine: the mailto link beside it does
     the same job.
     --------------------------------------------------------------------- */

  var copyBtn = document.querySelector("[data-copy]");
  if (copyBtn) {
    var status = document.querySelector("[data-copy-status]");
    var timer = null;

    copyBtn.addEventListener("click", function () {
      var text = copyBtn.getAttribute("data-copy");
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(text).then(
        function () {
          copyBtn.setAttribute("data-state", "copied");
          if (status) status.textContent = "Email address copied to clipboard";
          clearTimeout(timer);
          timer = setTimeout(function () {
            copyBtn.removeAttribute("data-state");
            if (status) status.textContent = "";
          }, 2200);
        },
        function () {},
      );
    });
  }
})();
