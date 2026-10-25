import { gsap, ScrollTrigger, MEDIA } from './core.js';

/** The five steps: a sideways journey on large screens, a route that fills in on small ones. */
export function initProcess() {
  const root = document.querySelector('[data-process]');
  if (!root) return;

  const stage = root.querySelector('[data-process-pin]');
  const track = root.querySelector('[data-process-track]');
  const steps = root.querySelector('[data-process-steps]');
  const route = root.querySelector('[data-route]');
  const fill = root.querySelector('[data-route-fill]');
  const items = gsap.utils.toArray('.step', root);
  const mm = gsap.matchMedia();

  mm.add(MEDIA.desktop, () => {
    root.classList.add('is-horizontal');
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    const travel = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
        onRefresh: () => {
          route.style.setProperty('--route-left', `${steps.offsetLeft}px`);
          route.style.setProperty('--route-width', `${steps.offsetWidth}px`);
        },
        onUpdate: (self) => gsap.set(fill, { scaleX: self.progress }),
      },
    });

    // Each step settles in as it travels into view.
    items.forEach((item) => {
      gsap.from(item, {
        opacity: 0.2,
        y: 28,
        ease: 'none',
        scrollTrigger: { trigger: item, containerAnimation: travel, start: 'left 92%', end: 'left 62%', scrub: true },
      });
    });

    return () => {
      root.classList.remove('is-horizontal');
      gsap.set(track, { clearProps: 'transform' });
    };
  });

  mm.add(MEDIA.mobile, () => {
    gsap.fromTo(steps, { '--draw': 0 }, { '--draw': 1, ease: 'none', scrollTrigger: { trigger: steps, start: 'top 75%', end: 'bottom 70%', scrub: true } });
    items.forEach((item) => {
      gsap.from(item, { opacity: 0, y: 32, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: item, start: 'top 86%', once: true } });
    });
  });
}
