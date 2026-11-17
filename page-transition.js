const transitionKey = 'portfolio-page-transition';
const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

try {
  const navigationType = performance.getEntriesByType('navigation')[0]?.type;
  const shouldEnter =
    sessionStorage.getItem(transitionKey) === 'true' ||
    navigationType === 'back_forward';
  if (shouldEnter) {
    sessionStorage.removeItem(transitionKey);
    if (!reduceMotion) root.classList.add('page-entering');
  }
} catch (error) {
  console.warn('Page transitions are unavailable because session storage could not be accessed.', error);
}

document.addEventListener('animationend', (event) => {
  if (event.target.matches('.layout') && event.animationName === 'pageReveal') {
    root.classList.remove('page-entering');
  }
});

document.addEventListener('click', (event) => {
  if (
    reduceMotion ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) {
    return;
  }

  const link = event.target.closest('a[href]');
  if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.relList.contains('external')) {
    return;
  }

  const destination = new URL(link.href, window.location.href);
  if (
    destination.origin !== window.location.origin ||
    (destination.pathname === window.location.pathname && destination.search === window.location.search)
  ) {
    return;
  }

  event.preventDefault();

  if (root.classList.contains('page-leaving')) return;

  try {
    sessionStorage.setItem(transitionKey, 'true');
  } catch (error) {
    console.warn('Page transition could not be prepared because session storage is unavailable.', error);
    window.location.assign(destination.href);
    return;
  }

  root.classList.add('page-leaving');

  let hasNavigated = false;
  const navigate = () => {
    if (hasNavigated) return;
    hasNavigated = true;
    window.location.assign(destination.href);
  };

  const layout = document.querySelector('.layout');
  if (layout) {
    layout.addEventListener('animationend', (animationEvent) => {
      if (animationEvent.animationName === 'pageFadeOut') navigate();
    }, { once: true });
  }

  window.setTimeout(navigate, 250);
});

window.addEventListener('pageshow', (event) => {
  if (!event.persisted || reduceMotion) return;

  root.classList.remove('page-leaving', 'page-entering');
  requestAnimationFrame(() => root.classList.add('page-entering'));
});

document.addEventListener('DOMContentLoaded', () => {
  if (reduceMotion || !('IntersectionObserver' in window) || document.body.classList.contains('home-page')) return;

  const revealItems = document.querySelectorAll('.project-body > *');
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.05
  });

  revealItems.forEach((item) => {
    if (item.getBoundingClientRect().top >= window.innerHeight * 0.95) {
      item.classList.add('scroll-reveal');
      observer.observe(item);
    }
  });
});
