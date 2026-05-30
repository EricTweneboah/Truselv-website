(function () {
  var carousels = Array.prototype.slice.call(document.querySelectorAll(".service-carousel"));
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!carousels.length || reduceMotion) {
    return;
  }

  carousels.forEach(function (carousel) {
    carousel.dataset.visible = "false";
    carousel.dataset.paused = "false";
    carousel.dataset.index = "0";

    ["pointerdown", "touchstart", "wheel", "keydown"].forEach(function (eventName) {
      carousel.addEventListener(eventName, function () {
        carousel.dataset.paused = "true";
      }, { passive: true });
    });
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      entry.target.dataset.visible = entry.isIntersecting ? "true" : "false";
    });
  }, {
    threshold: 0.55
  });

  carousels.forEach(function (carousel) {
    observer.observe(carousel);
  });

  window.setInterval(function () {
    carousels.forEach(function (carousel) {
      if (carousel.dataset.visible !== "true" || carousel.dataset.paused === "true") {
        return;
      }

      var slides = carousel.querySelectorAll("img");
      if (slides.length < 2) {
        return;
      }

      var nextIndex = (Number(carousel.dataset.index || 0) + 1) % slides.length;
      carousel.dataset.index = String(nextIndex);
      carousel.scrollTo({
        left: slides[nextIndex].offsetLeft,
        behavior: "smooth"
      });
    });
  }, 3200);
})();
