import { gsap, ScrollTrigger, SplitText, fontsReady, reduceMotion } from './core.js';

const NS = 'http://www.w3.org/2000/svg';
const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent?.append(node);
  return node;
}

/** A fine instrument dial: rings, 2° ticks and bearings, plus a fixed needle. */
function buildCompass(svg) {
  const turn = el('g', { class: 'compass__turn' }, svg);
  const dial = el('g', { class: 'compass__dial' }, turn);
  el('circle', { r: 482, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }, dial);
  el('circle', { r: 330, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.8, 'stroke-dasharray': '2 7', opacity: 0.7 }, dial);
  el('circle', { r: 176, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.7, opacity: 0.6 }, dial);

  let minor = '';
  let major = '';
  for (let deg = 0; deg < 360; deg += 2) {
    const rad = (deg * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = -Math.cos(rad);
    const len = deg % 30 === 0 ? 36 : deg % 10 === 0 ? 22 : 11;
    const seg = `M${(sin * 482).toFixed(1)} ${(cos * 482).toFixed(1)}L${(sin * (482 - len)).toFixed(1)} ${(cos * (482 - len)).toFixed(1)}`;
    if (deg % 10 === 0) major += seg;
    else minor += seg;
  }
  el('path', { d: minor, stroke: 'currentColor', 'stroke-width': 0.9, opacity: 0.55 }, dial);
  el('path', { d: major, stroke: 'currentColor', 'stroke-width': 1.5 }, dial);

  for (let deg = 0; deg < 360; deg += 30) {
    const text = el('text', { x: 0, y: -412, 'text-anchor': 'middle', 'dominant-baseline': 'middle', transform: `rotate(${deg})` }, dial);
    if (deg === 0) text.setAttribute('font-size', '30');
    text.textContent = deg % 90 === 0 ? CARDINALS[deg / 45] : String(deg).padStart(3, '0');
  }

  const fixed = el('g', { class: 'compass__fixed' }, svg);
  el('path', { d: 'M-482 0H482M0 -482V482', stroke: 'currentColor', 'stroke-width': 0.7, 'stroke-dasharray': '3 9', opacity: 0.45 }, fixed);
  // Faceted like the logo's rose: each half of the needle has a lit and a shaded side.
  el('path', { class: 'rose__nlit', d: 'M0 -318L-12 0H0Z' }, fixed);
  el('path', { class: 'rose__nshade', d: 'M0 -318V0H12Z' }, fixed);
  el('path', { class: 'rose__lit', d: 'M0 318L12 0H0Z' }, fixed);
  el('path', { class: 'rose__shade', d: 'M0 318V0H-12Z' }, fixed);
  el('circle', { r: 17, style: 'fill: var(--bg)', stroke: 'currentColor', 'stroke-width': 1.4 }, fixed);
  el('circle', { r: 4.5, fill: 'currentColor' }, fixed);

  return { turn, dial };
}

const heading = (angle) => {
  const deg = Math.round((((-angle % 360) + 360) % 360)) % 360;
  return `${String(deg).padStart(3, '0')}° ${CARDINALS[Math.round(deg / 45) % 8].padEnd(2)}`;
};

export function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const title = hero.querySelector('[data-hero-title]');
  const fades = hero.querySelectorAll('[data-hero-fade]');
  const wrap = hero.querySelector('[data-compass-wrap]');
  const readout = hero.querySelector('[data-heading]');
  const header = document.querySelector('[data-header]');
  const { turn, dial } = buildCompass(hero.querySelector('[data-compass]'));

  if (reduceMotion()) {
    gsap.set([title, ...fades], { visibility: 'visible' });
    return;
  }

  const words = SplitText.create(title, { type: 'words', mask: 'words', wordsClass: 'hero-word' }).words;
  gsap.set(title, { visibility: 'visible' });
  gsap.set(words, { yPercent: 120 });
  gsap.set(fades, { autoAlpha: 0, y: 24, filter: 'blur(8px)' });
  gsap.set([dial, turn], { svgOrigin: '0 0' });
  gsap.set(dial, { rotation: -70 });
  gsap.set(wrap, { opacity: 0, scale: 0.94 });

  // Opening: the headline rises, the dial swings round and settles on north.
  const intro = gsap
    .timeline({ paused: true, defaults: { ease: 'expo.out' } })
    .to(words, { yPercent: 0, duration: 1.5, stagger: 0.075 }, 0)
    .to(wrap, { opacity: 0.55, scale: 1, duration: 2.2, ease: 'power3.out' }, 0.1)
    .to(dial, { rotation: 0, duration: 3.2 }, 0.15)
    .to(fades, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.09, clearProps: 'filter,transform' }, 0.55);
  if (header) intro.from(header, { y: -18, autoAlpha: 0, duration: 1.1 }, 0.3);
  fontsReady.then(() => intro.play());

  // The bezel follows the pointer a little, like turning an instrument in your hand.
  const turnTo = gsap.quickTo(turn, 'rotation', { duration: 1.4, ease: 'power3.out' });
  window.addEventListener(
    'pointermove',
    (event) => event.pointerType === 'mouse' && turnTo((event.clientX / window.innerWidth - 0.5) * 14),
    { passive: true },
  );

  // Scrolling away turns the compass further and lets the hero drift up.
  gsap
    .timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
    .to(wrap, { rotation: 20, yPercent: 10, ease: 'none' }, 0)
    .to(hero.querySelector('.hero__inner'), { yPercent: -8, autoAlpha: 0.15, ease: 'none' }, 0);

  // Live heading readout while the hero is on screen.
  let shown = '';
  let onScreen = true;
  ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (self) => (onScreen = self.isActive) });
  gsap.ticker.add(() => {
    if (!onScreen || !readout) return;
    const angle = Number(gsap.getProperty(dial, 'rotation')) + Number(gsap.getProperty(turn, 'rotation')) + Number(gsap.getProperty(wrap, 'rotation'));
    const next = heading(angle);
    if (next !== shown) readout.textContent = shown = next;
  });
}
