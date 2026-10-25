import { gsap, SplitText, reduceMotion } from './core.js';

/** The footer rises like a sheet: the page behind it eases back, and the wordmark lifts into place. */
export function initFooter() {
  const footer = document.querySelector('[data-footer]');
  if (!footer || reduceMotion()) return;

  const wordmark = footer.querySelector('[data-wordmark]');
  if (wordmark) {
    const chars = SplitText.create(wordmark, { type: 'chars', mask: 'chars', charsClass: 'wm-char', aria: 'none' }).chars;
    gsap.from(chars, {
      yPercent: 110,
      duration: 1.3,
      ease: 'expo.out',
      stagger: 0.035,
      scrollTrigger: { trigger: wordmark, start: 'top 96%', once: true },
    });
  }

  const behind = document.querySelector('main > section:last-of-type > .wrap');
  if (behind) {
    gsap.to(behind, {
      scale: 0.965,
      opacity: 0.55,
      transformOrigin: '50% 100%',
      ease: 'none',
      scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top 30%', scrub: true },
    });
  }
}
