import { gsap, ScrollTrigger, reduceMotion } from './core.js';

/**
 * Capabilities circle the centred line on a tilted ring. Scrolling turns the
 * ring a little; the ring eases towards that angle rather than following the
 * wheel exactly, so changing direction stays smooth and readable.
 */
export function initOrbit() {
  const root = document.querySelector('[data-orbit]');
  if (!root) return;

  const stage = root.querySelector('[data-orbit-pin]');
  const ring = root.querySelector('.orbit__ring');
  const items = gsap.utils.toArray('.orbit__item', root);
  const count = items.length;
  const still = reduceMotion();

  const SCROLL_TURN = Math.PI * 0.3; // about 55° over the whole pinned scroll
  const DRIFT = 0.00002; // radians per millisecond, a little over 1° a second

  let sizes = [];
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let target = 0;
  let angle = 0;
  let drift = 0;
  let visible = false;

  // Sizes are measured on refresh only; the per-frame layout below never reads the page.
  const measure = () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    sizes = items.map((item) => [item.offsetWidth, item.offsetHeight]);
  };

  const layout = () => {
    const narrow = vw < 768;
    const rx = narrow ? vw * 0.62 : Math.min(vw * 0.4, 660);
    const ry = narrow ? vh * 0.35 : Math.min(vh * 0.37, 390);

    items.forEach((item, i) => {
      const a = angle + drift + (i / count) * Math.PI * 2 - Math.PI / 2;
      const depth = (Math.sin(a) + 1) / 2;
      const [w, h] = sizes[i] || [0, 0];
      const x = Math.cos(a) * rx - w / 2;
      const y = Math.sin(a) * ry - h / 2;
      item.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(0.86 + depth * 0.18).toFixed(3)})`;
      item.style.opacity = (0.5 + depth * 0.5).toFixed(3);
      item.style.zIndex = String(Math.round(depth * 10));
    });
  };

  measure();
  layout();
  ScrollTrigger.addEventListener('refresh', () => {
    measure();
    layout();
  });

  if (still) return;

  ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => `+=${Math.round(window.innerHeight)}`,
    pin: true,
    onUpdate: (self) => (target = self.progress * SCROLL_TURN),
  });
  ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'bottom top', refreshPriority: -1, onToggle: (self) => (visible = self.isActive) });

  // The ring settles in as the section arrives.
  gsap.from(ring, {
    autoAlpha: 0,
    scale: 0.92,
    duration: 1.6,
    ease: 'expo.out',
    scrollTrigger: { trigger: root, start: 'top 65%', once: true },
  });

  gsap.ticker.add((time, deltaTime) => {
    if (!visible) return;
    const dt = Math.min(deltaTime, 50);
    angle += (target - angle) * (1 - Math.exp(-dt / 260));
    drift += dt * DRIFT;
    layout();
  });
}
