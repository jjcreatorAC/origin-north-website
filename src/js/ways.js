import { gsap, reduceMotion } from './core.js';

/** The spheres in each column drift together as the section scrolls in: software, then support, then operations. */
export function initWays() {
  if (reduceMotion()) return;

  gsap.utils.toArray('[data-orb]').forEach((orb) => {
    const [x, y] = (orb.dataset.from || '0 0').split(' ').map(Number);
    gsap.fromTo(
      orb,
      { x, y, scale: orb.dataset.from ? 0.92 : 0.86, transformOrigin: '50% 50%' },
      {
        x: 0,
        y: 0,
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: orb.closest('.way'), start: 'top 88%', end: 'top 38%', scrub: true },
      },
    );
  });
}
