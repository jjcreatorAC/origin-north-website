import { gsap, ScrollTrigger } from './core.js';

/*
  The page colour. Each section names a palette; as a section scrolls in, the
  whole page blends into it. Blending happens in OKLab so the midpoints between
  two pastels stay clean instead of turning grey.

  Palettes are OKLCH [lightness, chroma, hue] and named after the Danish
  landscape. All of them are cool: fjord blue is home, and the page opens,
  centres and closes on it. Every ink and soft colour keeps at least 4.5:1
  contrast on its background, so text stays readable at every point of a blend.
*/
const PALETTES = {
  fjord: { bg: [0.905, 0.028, 238], ink: [0.38, 0.085, 254], soft: [0.445, 0.07, 252] },
  dusk: { bg: [0.9, 0.038, 262], ink: [0.38, 0.105, 264], soft: [0.44, 0.09, 264] },
  sea: { bg: [0.905, 0.036, 192], ink: [0.38, 0.064, 208], soft: [0.44, 0.058, 205] },
  lichen: { bg: [0.9, 0.036, 125], ink: [0.39, 0.075, 135], soft: [0.445, 0.065, 132] },
  heather: { bg: [0.89, 0.036, 318], ink: [0.39, 0.105, 320], soft: [0.44, 0.09, 320] },
  fog: { bg: [0.938, 0.008, 235], ink: [0.27, 0.02, 260], soft: [0.43, 0.02, 260] },
};

const toLab = ([l, c, h]) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];

const LAB = Object.fromEntries(
  Object.entries(PALETTES).map(([name, p]) => [name, { bg: toLab(p.bg), ink: toLab(p.ink), soft: toLab(p.soft) }]),
);

// OKLab to 8-bit sRGB (Björn Ottosson's reference matrices).
function toRgb([l, a, b]) {
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ].map((c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))));
}

const mix = (x, y, t) => x.map((v, i) => v + (y[i] - v) * t);
const smooth = (t) => t * t * (3 - 2 * t);

const listeners = new Set();
const extraStops = new Map();
// The colour is written onto what can be seen, never onto :root: a change there would
// restyle every element on the page, a few milliseconds each time. Fixed chrome always
// gets it; page sections get it while they are on screen and catch up as they arrive.
const chrome = [];
const onScreen = new Set();
let vars = null;
let latest = null;
let appliedKey = '';
let themeName = '';
const themeMeta = document.querySelector('[data-theme-color]');

/** Subscribe to colour changes: fn({ bg, ink, soft, dot, accent }) with [r, g, b] arrays. */
export function onPaletteChange(fn) {
  listeners.add(fn);
  if (latest) fn(latest);
}

/**
 * Lets a section add colour changes inside itself (the examples showcase
 * changes colour per example). fn returns [{ start, end, to }] in scroll px.
 */
export function addPaletteStops(section, fn) {
  extraStops.set(section, fn);
}

const paint = (el) => vars?.forEach(([name, value]) => el.style.setProperty(name, value));

function write(p) {
  const bg = toRgb(p.bg);
  const ink = toRgb(p.ink);
  const soft = toRgb(p.soft);
  const key = `${bg}|${ink}|${soft}`;
  if (key === appliedKey) return;
  appliedKey = key;

  vars = [
    ['--bg-rgb', bg.join(' ')],
    ['--ink-rgb', ink.join(' ')],
    ['--soft-rgb', soft.join(' ')],
  ];
  document.documentElement.style.backgroundColor = `rgb(${bg.join(' ')})`;
  chrome.forEach(paint);
  onScreen.forEach(paint);

  // Field dots are a faint tint of the ink; the pointer's glow and ripples use a deeper one.
  latest = { bg, ink, soft, dot: toRgb(mix(p.bg, p.ink, 0.11)), accent: toRgb(mix(p.bg, p.ink, 0.38)) };
  listeners.forEach((fn) => fn(latest));
}

// The colour on screen eases towards the colour the scroll position asks for, so
// fast scrolling and jumps from the navigation fade between palettes, never snap.
// It is written at most every WRITE_MS, which still reads as a continuous fade.
const WRITE_MS = 16;
let target = null;
let shown = null;
let sinceWrite = 0;

function apply(from, to, t) {
  const a = LAB[from] || LAB.fog;
  const b = LAB[to] || a;
  target = t <= 0 ? a : t >= 1 ? b : { bg: mix(a.bg, b.bg, t), ink: mix(a.ink, b.ink, t), soft: mix(a.soft, b.soft, t) };
  if (!shown) write((shown = target));

  const settled = t < 0.5 ? from : to;
  if (themeMeta && settled !== themeName) {
    themeName = settled;
    themeMeta.setAttribute('content', `rgb(${toRgb((LAB[settled] || a).bg).join(',')})`);
  }
}

const KEYS = ['bg', 'ink', 'soft'];

function ease(time, deltaTime) {
  if (!target || shown === target) return;
  const dt = Math.min(deltaTime, 50);
  const k = 1 - Math.exp(-dt / 140);
  if (!shown.easing) shown = { bg: [...shown.bg], ink: [...shown.ink], soft: [...shown.soft], easing: true };
  let gap = 0;
  for (const key of KEYS) {
    for (let i = 0; i < 3; i++) {
      shown[key][i] += (target[key][i] - shown[key][i]) * k;
      gap = Math.max(gap, Math.abs(target[key][i] - shown[key][i]));
    }
  }
  if (gap < 0.0008) shown = target;
  sinceWrite += dt;
  if (shown === target || sinceWrite >= WRITE_MS) {
    sinceWrite = 0;
    write(shown);
  }
}

export function initPalette() {
  const sections = [...document.querySelectorAll('main > [data-palette]')];
  if (!sections.length) return;

  chrome.push(...document.querySelectorAll('.site-header, .menu, .travel-veil'));
  const watchers = sections.map((section) =>
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      // Measured after the pinned scenes, which add to the sections' length.
      refreshPriority: -1,
      onToggle: (self) => {
        if (!self.isActive) return onScreen.delete(section);
        onScreen.add(section);
        paint(section);
      },
    }),
  );

  const first = sections[0].dataset.palette;
  const entries = sections.slice(1).map((section) => ({
    section,
    trigger: ScrollTrigger.create({ trigger: section, start: 'top 95%', end: 'top 20%' }),
  }));
  const segments = [];
  let lastY = -1;
  let tracker = null;

  // y comes from ScrollTrigger, which has already read the scroll position for this update.
  const update = (y, force = false) => {
    if (!force && y === lastY) return;
    lastY = y;
    let segment = null;
    for (const s of segments) {
      if (s.start > y) break;
      segment = s;
    }
    if (!segment) apply(first, first, 0);
    else apply(segment.from, segment.to, y >= segment.end ? 1 : smooth((y - segment.start) / (segment.end - segment.start)));
  };

  const build = () => {
    segments.length = 0;
    let current = first;
    for (const { section, trigger } of entries) {
      const entry = (section.dataset.palettes || section.dataset.palette).split(',')[0].trim();
      segments.push({ start: trigger.start, end: trigger.end, from: current, to: entry });
      current = entry;
      for (const stop of extraStops.get(section)?.() || []) {
        segments.push({ start: stop.start, end: stop.end, from: current, to: stop.to });
        current = stop.to;
      }
    }
    segments.sort((a, b) => a.start - b.start);
    onScreen.clear();
    watchers.forEach((watcher, i) => watcher.isActive && onScreen.add(sections[i]));
    update(tracker ? tracker.scroll() : window.scrollY, true);
    onScreen.forEach(paint);
  };

  if (import.meta.env.DEV) window.__palette = { segments, onScreen };
  ScrollTrigger.addEventListener('refresh', build);
  tracker = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => update(self.scroll()) });
  build();
  gsap.ticker.add(ease);
}
