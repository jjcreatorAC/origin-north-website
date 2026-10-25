import { gsap, SplitText, reduceMotion } from './core.js';

/** The approach statement lights up word by word as it scrolls through; spheres drift past at their own pace. */
export function initManifesto() {
  const text = document.querySelector('[data-scrub]');
  if (!text) return;

  // Screen readers get the sentence once; the animated copy is hidden from them.
  const sentence = text.textContent.replace(/\s+/g, ' ').trim();
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  visual.append(...text.childNodes);
  const spoken = document.createElement('span');
  spoken.className = 'sr-only';
  spoken.textContent = sentence;
  text.append(spoken, visual);

  if (reduceMotion()) return;

  const words = SplitText.create(visual, { type: 'words', aria: 'none' }).words;
  gsap.fromTo(
    words,
    { opacity: 0.18 },
    {
      opacity: 1,
      ease: 'none',
      stagger: 0.05,
      scrollTrigger: { trigger: text, start: 'top 78%', end: 'bottom 40%', scrub: true },
    },
  );

  gsap.utils.toArray('[data-speed]').forEach((sphere) => {
    const travel = () => Number(sphere.dataset.speed) * window.innerHeight;
    gsap.fromTo(
      sphere,
      { y: () => -travel() },
      {
        y: () => travel(),
        ease: 'none',
        scrollTrigger: { trigger: sphere.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      },
    );
  });
}
