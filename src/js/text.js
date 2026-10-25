import { gsap, ScrollTrigger, SplitText, reduceMotion } from './core.js';

/** Headlines rise line by line from behind a mask; blocks fade up as they arrive. */
export function initText() {
  const headings = gsap.utils.toArray('[data-split]');
  const blocks = gsap.utils.toArray('[data-reveal]');

  if (reduceMotion()) {
    gsap.set(headings, { visibility: 'visible' });
    gsap.set(blocks, { opacity: 1 });
    return;
  }

  headings.forEach((heading) => {
    let played = false;
    SplitText.create(heading, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit(self) {
        gsap.set(heading, { visibility: 'visible' });
        // Re-splits after a resize keep the finished state instead of replaying.
        if (played) return undefined;
        return gsap.from(self.lines, {
          yPercent: 112,
          duration: 1.3,
          ease: 'expo.out',
          stagger: 0.1,
          scrollTrigger: { trigger: heading, start: 'top 88%', once: true, onEnter: () => (played = true) },
        });
      },
    });
  });

  // Plain paragraphs also sharpen from a soft blur. Blocks holding glass, forms or
  // SVG filters only fade and rise: blurring a blur is expensive and gains nothing.
  const soft = (el) => el.matches('p') && !el.querySelector('svg, .glass, button');
  gsap.set(blocks, { opacity: 0, y: 26 });
  gsap.set(blocks.filter(soft), { filter: 'blur(6px)' });
  ScrollTrigger.batch(blocks, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => {
      // After a jump, the batch also holds every block that was skipped over. Those are
      // already above the screen: show them at once, so the blocks you land on don't
      // wait their turn behind them.
      const passed = batch.filter((el) => el.getBoundingClientRect().bottom < 0);
      gsap.set(passed, { opacity: 1, clearProps: 'filter,transform' });
      gsap.to(
        batch.filter((el) => !passed.includes(el)),
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.15,
          ease: 'expo.out',
          stagger: 0.08,
          overwrite: true,
          clearProps: 'filter,transform',
        },
      );
    },
  });
}
