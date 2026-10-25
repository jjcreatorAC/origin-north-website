import { gsap, ScrollTrigger, reduceMotion } from './core.js';

/** Answers open and close smoothly in every browser while keeping native <details> semantics. */
export function initFaq() {
  gsap.utils.toArray('[data-faq] details').forEach((item) => {
    const summary = item.querySelector('summary');
    const answer = item.querySelector('.qa__answer');
    if (!summary || !answer) return;

    summary.addEventListener('click', (event) => {
      if (reduceMotion()) return;
      event.preventDefault();

      if (item.open && !item.classList.contains('is-closing')) {
        item.classList.add('is-closing');
        item.classList.remove('is-open');
        gsap.to(answer, {
          height: 0,
          duration: 0.5,
          ease: 'power3.inOut',
          overwrite: true,
          onComplete: () => {
            item.open = false;
            item.classList.remove('is-closing');
            gsap.set(answer, { clearProps: 'height' });
            ScrollTrigger.refresh();
          },
        });
      } else {
        item.classList.remove('is-closing');
        item.classList.add('is-open');
        item.open = true;
        gsap.fromTo(
          answer,
          { height: 0 },
          {
            height: 'auto',
            duration: 0.7,
            ease: 'expo.out',
            overwrite: true,
            onComplete: () => {
              gsap.set(answer, { clearProps: 'height' });
              ScrollTrigger.refresh();
            },
          },
        );
      }
    });
  });
}
