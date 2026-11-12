const images = document.querySelectorAll('img');

images.forEach((image) => {
  if (image.closest('.site-loader')) return;

  image.classList.add('image-reveal');

  const revealImage = () => image.classList.add('is-loaded');

  if (image.complete) {
    requestAnimationFrame(revealImage);
  } else {
    image.addEventListener('load', revealImage, { once: true });
    image.addEventListener('error', revealImage, { once: true });
  }
});

const revealItems = document.querySelectorAll('body:not(.home-page) .project-body > *');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (revealItems.length && 'IntersectionObserver' in window && !reduceMotion) {
  document.body.classList.add('has-scroll-reveal');

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '0px 0px -5% 0px',
    threshold: 0.01
  });

  revealItems.forEach((item) => revealObserver.observe(item));
}
