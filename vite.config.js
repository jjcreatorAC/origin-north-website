import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Inlines shared markup: <!-- @include partials/header.html -->
function htmlPartials() {
  const pattern = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
  const render = (html, depth = 0) => {
    if (depth > 4) throw new Error('html-partials: includes nested too deeply');
    return html.replace(pattern, (_, file) => render(readFileSync(resolve(root, file), 'utf8'), depth + 1));
  };

  return {
    name: 'html-partials',
    transformIndexHtml: { order: 'pre', handler: (html) => render(html) },
    handleHotUpdate({ file, server }) {
      if (file.includes('/partials/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

// Hostinger passes the environment variables set in hPanel to the build. The mailbox
// password for sending briefs (SMTP_PASSWORD, plus SMTP_USER if another mailbox sends
// them) becomes api/mail-secret.php, which the server never shows: PHP prints nothing
// for it and public/api/.htaccess refuses it. So it stays out of git and the browser.
function mailSecret() {
  const php = (value = '') => `base64_decode('${Buffer.from(value).toString('base64')}')`;
  return {
    name: 'mail-secret',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'api/mail-secret.php',
        source: `<?php\nreturn ['user' => ${php(process.env.SMTP_USER)}, 'password' => ${php(process.env.SMTP_PASSWORD)}];\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [htmlPartials(), mailSecret()],
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        privacy: resolve(root, 'privacy/index.html'),
        brief: resolve(root, 'brief/index.html'),
        notFound: resolve(root, '404.html'),
      },
    },
  },
});
