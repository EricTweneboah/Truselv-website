(() => {
  const carousel = document.querySelector('[data-home-tess-carousel]');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('[data-home-tess-slide]'));
  const previous = carousel.querySelector('[data-home-tess-previous]');
  const next = carousel.querySelector('[data-home-tess-next]');
  const status = carousel.querySelector('[data-home-tess-status]');
  const controls = carousel.querySelector('[data-home-tess-controls]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = 0;
  let isVisible = false;
  let isPaused = false;
  let timer;

  function showSlide(index) {
    const nextIndex = (index + slides.length) % slides.length;
    if (nextIndex === activeIndex) return;
    const previousSlide = slides[activeIndex];
    const nextSlide = slides[nextIndex];
    nextSlide.hidden = false;
    nextSlide.classList.add('is-entering');
    window.requestAnimationFrame(() => nextSlide.classList.add('is-active'));
    window.setTimeout(() => {
      previousSlide.classList.remove('is-active');
      previousSlide.hidden = true;
      nextSlide.classList.remove('is-entering');
    }, reduceMotion ? 0 : 560);
    activeIndex = nextIndex;
    status.textContent = `Image ${activeIndex + 1} of ${slides.length}`;
  }

  function stop() {
    window.clearInterval(timer);
    timer = undefined;
  }

  function start() {
    if (reduceMotion || !isVisible || isPaused || timer) return;
    timer = window.setInterval(() => showSlide(activeIndex + 1), 5000);
  }

  previous.addEventListener('click', () => showSlide(activeIndex - 1));
  next.addEventListener('click', () => showSlide(activeIndex + 1));
  carousel.addEventListener('mouseenter', () => { isPaused = true; stop(); });
  carousel.addEventListener('mouseleave', () => { isPaused = false; start(); });
  carousel.addEventListener('focusin', () => { isPaused = true; stop(); });
  carousel.addEventListener('focusout', () => { isPaused = false; start(); });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

  new IntersectionObserver((entries) => {
    isVisible = entries[0].isIntersecting;
    if (isVisible) start(); else stop();
  }, { threshold: 0.4 }).observe(carousel);

  controls.hidden = false;
})();
