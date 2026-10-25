import { gsap, ScrollTrigger, getLenis, reduceMotion } from './core.js';

export function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  // Scrolled state softens content passing under the bar; over the dark footer sheet the bar turns light.
  // Both states come from measured scroll positions, so scrolling never forces a layout.
  const footer = document.querySelector('[data-footer]');
  const sheet = footer && ScrollTrigger.create({ trigger: footer, start: 'top 38px', refreshPriority: -1 });
  const sync = (self) => {
    const y = self.scroll();
    header.classList.toggle('is-scrolled', y > 24);
    if (sheet) header.classList.toggle('is-on-dark', y >= sheet.start);
  };
  sync(ScrollTrigger.create({ start: 0, end: 'max', onUpdate: sync, onRefresh: sync }));

  // Hovering the logo knocks the compass rose off north; it swings back and settles.
  const rose = header.querySelector('[data-rose]');
  const brand = header.querySelector('.brand');
  if (rose && brand && !reduceMotion()) {
    gsap.set(rose, { svgOrigin: '24 24' });
    brand.addEventListener('pointerenter', () => {
      if (gsap.isTweening(rose)) return;
      gsap
        .timeline()
        .to(rose, { rotation: 34, duration: 0.45, ease: 'power2.out' })
        .to(rose, { rotation: -13, duration: 0.65, ease: 'power2.inOut' })
        .to(rose, { rotation: 0, duration: 1.3, ease: 'expo.out' });
    });
  }

  initLens(header);
}

/** A lens slides behind the link of the section you're reading, and previews on hover. */
function initLens(header) {
  const nav = header.querySelector('[data-nav-bar]');
  const lens = header.querySelector('[data-lens]');
  const links = [...header.querySelectorAll('[data-nav]')];
  if (!nav || !lens || !links.length) return;

  let active = null;
  let hovered = null;

  const place = (link, instant = false) => {
    if (!link) {
      gsap.to(lens, { opacity: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const box = link.getBoundingClientRect();
    const geometry = { x: box.left - navBox.left, width: box.width };
    // Appear in place when hidden; glide between links once visible.
    if (instant || Number(gsap.getProperty(lens, 'opacity')) < 0.05) {
      gsap.set(lens, geometry);
      gsap.to(lens, { opacity: 1, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    } else {
      gsap.to(lens, { ...geometry, opacity: 1, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
    }
  };

  const refresh = () => {
    links.forEach((link) => (link === active ? link.setAttribute('aria-current', 'true') : link.removeAttribute('aria-current')));
    place(hovered || active);
  };

  links.forEach((link) => {
    const section = document.getElementById(link.dataset.nav);
    if (section) {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 50%',
        end: 'bottom 50%',
        // Measured after the pinned scenes, whose extra scroll length these ranges include.
        refreshPriority: -1,
        onToggle: (self) => {
          if (self.isActive) active = link;
          else if (active === link) active = null;
          refresh();
        },
      });
    }
    link.addEventListener('pointerenter', () => {
      hovered = link;
      refresh();
    });
  });

  nav.addEventListener('pointerleave', () => {
    hovered = null;
    refresh();
  });
  window.addEventListener('resize', () => place(hovered || active, true));
}

/** Full-screen menu for small screens. */
export function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (!toggle || !menu) return;

  const label = toggle.querySelector('[data-menu-label]');
  const links = [...menu.querySelectorAll('.menu__list a')];
  const foot = menu.querySelector('.menu__foot');
  const background = [document.querySelector('main'), document.querySelector('.site-footer')].filter(Boolean);
  let open = false;

  const timeline = gsap
    .timeline({ paused: true, defaults: { ease: 'expo.out' } })
    .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8 })
    .fromTo(links, { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.05 }, 0.1)
    .fromTo(foot, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.3);

  timeline.eventCallback('onReverseComplete', () => {
    if (!open) menu.hidden = true;
  });

  const setOpen = (next) => {
    open = next;
    toggle.setAttribute('aria-expanded', String(next));
    label.textContent = next ? 'Close' : 'Menu';
    background.forEach((el) => (el.inert = next));
    document.documentElement.classList.toggle('menu-open', next);

    if (next) {
      menu.hidden = false;
      getLenis()?.stop();
      if (reduceMotion()) timeline.progress(1);
      else timeline.timeScale(1).play();
      links[0]?.focus({ preventScroll: true });
    } else {
      getLenis()?.start();
      if (reduceMotion()) {
        timeline.progress(0);
        menu.hidden = true;
      } else {
        timeline.timeScale(1.8).reverse();
      }
    }
  };

  toggle.addEventListener('click', () => setOpen(!open));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (!open) return;
    if (event.key === 'Escape') {
      setOpen(false);
      toggle.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    // Keep focus inside the menu and its toggle while open.
    const focusable = [toggle, ...menu.querySelectorAll('a')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.matchMedia('(min-width: 64rem)').addEventListener('change', (event) => {
    if (event.matches && open) setOpen(false);
  });
}
