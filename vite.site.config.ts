import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/** Website build (npm run build:site): site/ → dist-site/, then scripts/build-site.mjs renders the docs. */
export default defineConfig({
  root: resolve(__dirname, 'site'),
  publicDir: resolve(__dirname, 'site/public'),
  build: {
    outDir: resolve(__dirname, 'dist-site'),
    emptyOutDir: true,
    target: 'es2022',
    minify: 'terser',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'site/index.html'),
        playground: resolve(__dirname, 'site/playground/index.html'),
        pro: resolve(__dirname, 'site/pro/index.html'),
        notFound: resolve(__dirname, 'site/404.html'),
      },
    },
  },
});
