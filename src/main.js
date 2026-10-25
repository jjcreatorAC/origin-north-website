import './styles/main.css';

import { initCore, settleLayout } from './js/core.js';
import { initPalette } from './js/palette.js';
import { initField } from './js/field.js';
import { initHeader, initMenu } from './js/header.js';
import { initHero } from './js/hero.js';
import { initManifesto } from './js/manifesto.js';
import { initText } from './js/text.js';
import { initShowcase } from './js/showcase.js';
import { initOrbit } from './js/orbit.js';
import { initWays } from './js/ways.js';
import { initProcess } from './js/process.js';
import { initFaq } from './js/faq.js';
import { initContact } from './js/contact.js';
import { initFooter } from './js/footer.js';
import { initClock, initTilt, initYear } from './js/misc.js';

// Tells the inline fallback in <head> that scripts are running.
window.__originNorth = true;

initCore();
initField();

// Scroll scenes are created in page order so pinned sections measure correctly.
initHeader();
initMenu();
initHero();
initManifesto();
initShowcase();
initOrbit();
initWays();
initProcess();
initText();
initFaq();
initContact();
initFooter();
initPalette();

initClock();
initYear();
initTilt();

settleLayout();
