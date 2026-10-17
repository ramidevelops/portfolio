const feed = document.querySelector('.project-body');

if (feed) {
  const videos = [...feed.querySelectorAll('video.project-img')];

  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;

        if (entry.isIntersecting) {
          video.play();
        } else {
          video.pause();
        }
      });
    }, { rootMargin: '100px 0px' });

    videos.forEach((video) => videoObserver.observe(video));
  } else {
    videos.forEach((video) => { video.autoplay = true; });
  }
}
