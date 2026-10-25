import { gsap, reduceMotion } from './core.js';

/** Live local time in Denmark. */
export function initClock() {
  const clocks = document.querySelectorAll('[data-clock]');
  if (!clocks.length) return;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const tick = () => {
    const time = format.format(new Date());
    clocks.forEach((el) => (el.textContent = time));
  };
  tick();
  setInterval(tick, 10_000);
}

export function initYear() {
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = year));
}

/** Example screens tilt gently towards the pointer, like holding a device to the light. */
export function initTilt() {
  if (reduceMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.querySelectorAll('[data-tilt]').forEach((frame) => {
    const stage = frame.closest('.showcase__stage') || frame.parentElement;
    gsap.set(frame, { transformPerspective: 1400 });
    const rotateX = gsap.quickTo(frame, 'rotationX', { duration: 1.1, ease: 'power3.out' });
    const rotateY = gsap.quickTo(frame, 'rotationY', { duration: 1.1, ease: 'power3.out' });

    stage.addEventListener('pointermove', (event) => {
      const box = stage.getBoundingClientRect();
      rotateY(((event.clientX - box.left) / box.width - 0.5) * 7);
      rotateX(((event.clientY - box.top) / box.height - 0.5) * -6);
    });
    stage.addEventListener('pointerleave', () => {
      rotateX(0);
      rotateY(0);
    });
  });
}
