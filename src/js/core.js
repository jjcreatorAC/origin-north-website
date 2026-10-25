import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reduceMotion = () => motionQuery.matches;

/** Breakpoints shared by every module's gsap.matchMedia() setup. */
export const MEDIA = {
  desktop: '(min-width: 64rem) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 63.99rem) and (prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
};

let lenis = null;
export const getLenis = () => lenis;

/** The scroll position, read from Lenis so per-frame code never makes the browser lay out early. */
export const scrollTop = () => (lenis ? lenis.scroll : window.scrollY);

/** Resolves once the display faces are ready, or after a short timeout. */
export const fontsReady = Promise.race([
  document.fonts
    ? Promise.all([
        document.fonts.load('320 1em "Funnel Display Variable"'),
        document.fonts.load('italic 330 1em "Funnel Sans Variable"'),
        document.fonts.load('400 1em "Funnel Sans Variable"'),
      ])
    : Promise.resolve(),
  new Promise((resolve) => setTimeout(resolve, 1400)),
]);

const targetFor = (hash) => (hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null);

// A #section is honoured only when arriving from another page (e.g. the privacy page's
// "Contact" link). Reloads and back/forward visits always open at the top.
const navigationType = performance.getEntriesByType?.('navigation')[0]?.type;
const deepLink = navigationType === 'navigate' ? targetFor(window.location.hash) : null;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutQuint = (t) => 1 - (1 - t) ** 5;

/** A short glide with a gentle start and finish; longer distances take a little longer. */
function glide(y, { base = 0.8, perScreen = 0.5, max = 1.6, easing = easeInOutCubic } = {}) {
  const screens = Math.abs(y - window.scrollY) / window.innerHeight;
  lenis.scrollTo(y, { duration: Math.min(max, base + screens * perScreen), easing, force: true });
}

let trip = null;

/**
 * Long trips would race through every scene in between, so the page dips into
 * its own colour instead, jumps to just short of the target and surfaces again
 * while it glides the last stretch. Short trips simply glide.
 */
function travel(y) {
  trip?.kill();
  const from = window.scrollY;
  if (Math.abs(y - from) <= window.innerHeight * 1.5) {
    glide(y);
    return;
  }
  const veil = document.querySelector('[data-veil]');
  if (!veil) {
    glide(y, { max: 2.4 });
    return;
  }
  const approach = Math.max(0, y - Math.sign(y - from) * window.innerHeight * 0.4);
  trip = gsap
    .timeline()
    .to(veil, { autoAlpha: 1, duration: 0.45, ease: 'power2.inOut' })
    .add(() => lenis.scrollTo(approach, { immediate: true, force: true }))
    .add(() => glide(y, { base: 1.3, perScreen: 0, easing: easeOutQuint }), '+=0.06')
    .to(veil, { autoAlpha: 0, duration: 0.9, ease: 'power2.out' }, '<');
}

export function scrollToTarget(target, { immediate = false, focus = true } = {}) {
  // Work out the position from the page itself: during load, Lenis's own idea of the
  // scroll position can briefly lag behind, which would send element targets astray.
  const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const y = Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - padding));
  if (lenis && immediate) lenis.scrollTo(y, { immediate: true, force: true });
  else if (lenis) travel(y);
  else window.scrollTo({ top: y, behavior: immediate || reduceMotion() ? 'auto' : 'smooth' });

  if (focus) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}

/** Glides within a scene, e.g. between the pinned examples. */
export function scrollToY(y) {
  if (lenis) glide(y, { base: 0.9, perScreen: 0.3, max: 1.8 });
  else window.scrollTo({ top: y, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

function onAnchorClick(event) {
  const link = event.target.closest('a[href*="#"]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const url = new URL(link.href, window.location.href);
  if (url.pathname !== window.location.pathname) return;
  const target = targetFor(url.hash);
  if (!target) return;
  // The address stays clean, so a reload never lands mid-page.
  event.preventDefault();
  scrollToTarget(target);
}

export function initCore() {
  gsap.defaults({ ease: 'expo.out', duration: 1 });
  ScrollTrigger.config({ ignoreMobileResize: true });
  ScrollTrigger.clearScrollMemory('manual');

  if (!deepLink) {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
  }

  if (!reduceMotion()) {
    // A calm glide: each wheel step travels a little less than the browser's and eases out longer.
    lenis = new Lenis({
      lerp: 0.075,
      wheelMultiplier: 0.8,
      smoothWheel: true,
      // Boxes that scroll on their own, like the brief's message, keep the wheel while they have room to.
      prevent: (node) => node.hasAttribute('data-scroll-inner') && node.scrollHeight > node.clientHeight,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    // Pins change the page length; keep Lenis's scroll limit in step so it never stops short.
    ScrollTrigger.addEventListener('refresh', () => lenis.resize());
  }

  document.addEventListener('click', onAnchorClick);

  // Handy when debugging scroll scenes from the console during development.
  if (import.meta.env.DEV) window.__scroll = { gsap, ScrollTrigger, getLenis };
}

/** Call after every module has created its ScrollTriggers. */
export function settleLayout() {
  ScrollTrigger.sort();
  // Pinned scenes add scroll length every time GSAP re-measures (after fonts, after load),
  // so a deep link follows those refreshes until the visitor starts scrolling themselves.
  if (deepLink) {
    const jump = () => requestAnimationFrame(() => scrollToTarget(deepLink, { immediate: true, focus: false }));
    const release = () => ScrollTrigger.removeEventListener('refresh', jump);
    ScrollTrigger.addEventListener('refresh', jump);
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((type) => window.addEventListener(type, release, { once: true, passive: true }));
    setTimeout(release, 4000);
  }
  fontsReady.then(() => ScrollTrigger.refresh());
}
