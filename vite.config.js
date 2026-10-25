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

export default defineConfig({
  plugins: [htmlPartials()],
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        privacy: resolve(root, 'privacy/index.html'),
        notFound: resolve(root, '404.html'),
      },
    },
  },
});
