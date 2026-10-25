import { gsap, ScrollTrigger, MEDIA, reduceMotion, scrollToY } from './core.js';
import { addPaletteStops } from './palette.js';

/**
 * Examples of what can be built. On large screens the showcase pins and the
 * scroll steps through the examples; the whole page takes on each example's
 * colour. On small screens the stage sticks while the examples scroll past.
 */
export function initShowcase() {
  const root = document.querySelector('[data-showcase]');
  if (!root) return;

  const section = root.closest('section');
  const slides = gsap.utils.toArray('[data-slide]', root);
  const items = gsap.utils.toArray('[data-item]', root);
  const details = items.map((item) => item.querySelector('.showcase__detail'));
  const triggers = gsap.utils.toArray('[data-trigger]', root);
  const progress = root.querySelector('[data-showcase-progress]');
  const palettes = (section.dataset.palettes || '').split(',').map((name) => name.trim());
  const count = slides.length;

  let active = 0;
  let pin = null;
  let itemTriggers = [];

  // Screens that are out of sight skip styling and layout entirely, so a colour
  // change or a resize only touches the example you can see.
  const rest = (slide) => slides[active] !== slide && (slide.style.contentVisibility = 'hidden');
  const wake = (slide) => (slide.style.contentVisibility = '');

  gsap.set(slides, { autoAlpha: 0 });
  gsap.set(slides[0], { autoAlpha: 1 });
  slides.slice(1).forEach(rest);

  const show = (index) => {
    if (index === active) return;
    const direction = index > active ? 1 : -1;
    const previous = slides[active];
    const next = slides[index];
    active = index;
    items.forEach((item, i) => item.classList.toggle('is-active', i === index));

    wake(next);
    if (reduceMotion()) {
      gsap.set(slides, { autoAlpha: 0 });
      gsap.set(next, { autoAlpha: 1 });
      rest(previous);
      return;
    }

    gsap.to(previous, { autoAlpha: 0, y: -40 * direction, scale: 0.97, duration: 0.5, ease: 'power2.in', overwrite: true, onComplete: () => rest(previous) });
    gsap.fromTo(
      next,
      { autoAlpha: 0, y: 64 * direction, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: 'expo.out', delay: 0.18, overwrite: true },
    );

    if (pin) {
      details.forEach((detail, i) => gsap.to(detail, { height: i === index ? 'auto' : 0, duration: 0.8, ease: 'expo.out', overwrite: true }));
    }
  };

  const mm = gsap.matchMedia();

  mm.add(MEDIA.desktop, () => {
    gsap.set(details, { height: 0 });
    gsap.set(details[active], { height: 'auto' });

    pin = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * 0.7 * count)}`,
      pin: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        show(Math.min(count - 1, Math.floor(self.progress * count)));
        gsap.set(progress, { scaleY: self.progress });
      },
    });

    const jump = triggers.map((trigger, i) => {
      const handler = () => scrollToY(pin.start + (pin.end - pin.start) * ((i + 0.5) / count));
      trigger.addEventListener('click', handler);
      return () => trigger.removeEventListener('click', handler);
    });

    return () => {
      jump.forEach((off) => off());
      gsap.set(details, { clearProps: 'height' });
      pin = null;
    };
  });

  mm.add(`${MEDIA.mobile}, ${MEDIA.reduce}`, () => {
    itemTriggers = items.map((item, i) =>
      ScrollTrigger.create({
        trigger: item,
        start: 'top 62%',
        end: 'bottom 62%',
        onToggle: (self) => self.isActive && show(i),
      }),
    );
    return () => (itemTriggers = []);
  });

  // Colour changes inside the section, one per example.
  addPaletteStops(section, () => {
    if (pin) {
      const step = (pin.end - pin.start) / count;
      const width = Math.min(step * 0.4, window.innerHeight * 0.35);
      return palettes.slice(1).map((to, k) => {
        const at = pin.start + step * (k + 1);
        return { start: at - width / 2, end: at + width / 2, to };
      });
    }
    return itemTriggers.slice(1).map((trigger, k) => ({
      start: trigger.start - window.innerHeight * 0.12,
      end: trigger.start + window.innerHeight * 0.12,
      to: palettes[k + 1],
    }));
  });
}
