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

The site is hosted on GitHub Pages. `.github/workflows/deploy.yml` builds it and publishes `dist/` every time `main` changes, so publishing an update is just pushing to `main`. The repository's Pages settings use GitHub Actions as the source and `originnorth.dk` as the custom domain.

### Pointing originnorth.dk at the site

In the DNS settings for originnorth.dk at your domain provider (Hostinger: hPanel, Domains, DNS / Nameservers):

1. Remove the existing `A` and `AAAA` records for `@`, and any existing `www` record.
2. Add four `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. Add a `CNAME` record for `www` pointing to `jjcreatorac.github.io`.
4. Leave the `MX` and `TXT` records alone: they deliver your email.

DNS changes can take from a few minutes to a few hours. Once GitHub has issued the certificate, tick **Enforce HTTPS** in the repository's Settings, Pages.

`dist/` is still a plain static site, so it can move to any other static host if needed. GitHub Pages serves `404.html` for missing pages automatically.

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

The project brief asks four short questions one at a time, then shows a review before sending. It is sent from the page to info@originnorth.dk through [FormSubmit](https://formsubmit.co), so there is no server to run. The endpoint is the `data-endpoint` attribute on the form in `index.html`.

- **First use:** FormSubmit holds the first submission and emails info@originnorth.dk an "Activate Form" link. Send a test brief from the live site and click that link once; every brief after that arrives directly.
- The message box supports bold, italics and bullet lists. The email shows them as `**bold**`, `_italics_` and `•` bullets.
- If sending fails, the visitor is offered the brief in their own email app instead. Without JavaScript, the form shows every question at once and opens the email app.

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
