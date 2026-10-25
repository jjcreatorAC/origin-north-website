# Origin North website

Marketing site for Origin North ApS (originnorth.dk). A static site built with Vite: plain HTML, CSS and JavaScript, no framework. Motion runs on GSAP (ScrollTrigger and SplitText) with Lenis smooth scrolling.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production files in dist/
npm run preview   # serve the built site locally
```

## Deploy

The site is hosted on Hostinger, imported from this GitHub repository (hPanel: connect the repository with GitHub). Hostinger recognises a Vite project from `package.json` and builds it itself:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node.js:** 22 (see `.nvmrc`; Vite needs 20.19 or newer)

Every push to `main` redeploys the site automatically. `public/.htaccess` gives Hostinger the custom 404 page, and `public/assets/.htaccess` lets browsers cache the fingerprinted build files for a year.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | The homepage and all its copy |
| `privacy/index.html` | Privacy policy |
| `404.html` | Not-found page |
| `partials/` | Shared header, footer and SVG icons, inlined at build time with `<!-- @include partials/header.html -->` |
| `src/js/palette.js` | The page colours. Each section names a palette (`data-palette` in the HTML) and the page blends between them as you scroll |
| `src/styles/tokens.css` | Type scale, spacing, radii, easing and the fixed colours |
| `src/styles/` | Base, components (buttons, glass navigation, form controls, footer), sections, interface mockups, motion start states |
| `src/js/` | One module per behaviour: `core` (GSAP, Lenis, anchor links), `field` (halftone background), `header` (nav lens, menu), `hero`, `manifesto`, `text` (headline reveals), `showcase`, `orbit`, `ways`, `process`, `faq`, `contact`, `footer` |
| `public/` | Favicon, app icons, share image, `robots.txt`, `sitemap.xml` |
| `PRODUCT.md` | Brand brief the design decisions are based on |

## Contact form

The project brief has a page of its own, `/brief/` (`brief/index.html`): four short questions one at a time, then a review before sending. Every "Start a project" button and the card in the homepage's contact section open it, and Close returns to where the visitor was. In browsers with page transitions, the card grows into the brief page.

Briefs are emailed by the site itself: the page posts to `public/api/brief.php`, which Hostinger runs as PHP, and that script emails info@originnorth.dk. The email reads like one the visitor wrote: it arrives from "Name via Origin North", with their message first and their details as a signature, and Reply goes straight to them. (It can't be sent from the visitor's own address: mail providers reject messages that claim to come from someone else.) No outside form service is involved.

- The message box supports bold, italics and bullet lists, and the email shows them as written.
- Spam protection: a hidden field bots fill in, a minimum time to answer, and at most 10 briefs an hour from one address. Messages are checked on the server too.
- Open `/api/brief.php` in a browser to check that PHP runs: it answers `{"ok":true,"mail":true}`.
- If sending fails, the visitor is offered the brief in their own email app. Without JavaScript, the form shows every question at once and opens the email app.
- The local dev server doesn't run PHP, so sending only works on the live site. To try it locally, build and run `php -S 127.0.0.1:8099 -t dist`.

## Review before launch

- **Process claims** in the copy, such as "a website can often go live within a few weeks", "you see a clear plan before any code is written" and "a short, no-obligation conversation". Keep them only if they match how you work.
- **Privacy policy**: the 12-month retention period, hosting provider and processors. It is a starting point, not legal advice.
- **Examples** are illustrative interfaces, not client work. Add real case studies when you have them.
- Canonical and share tags point to `https://originnorth.dk/`.

## Accessibility and performance

- WCAG AA text contrast on every palette, including midway through a colour blend; keyboard navigation, skip link, visible focus states.
- `prefers-reduced-motion` turns off smooth scrolling, pinned scenes, parallax and reveals; `prefers-reduced-transparency` and `prefers-contrast` swap the glass navigation for solid, higher-contrast versions.
- Fonts are self-hosted (no requests to Google), and there are no cookies or trackers.
- About 61 KB JavaScript (mostly GSAP) and 11 KB CSS gzipped, plus about 100 KB of fonts.
