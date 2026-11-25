import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Library builds (npm run build:lib):
 *   dist-lib/pixiformui.js             ESM for bundlers (React/Angular/Vue apps); no dependencies
 *   dist-lib/pixiformui.standalone.js  ESM, minified, registers <pixi-form> (plain HTML)
 *   dist-lib/pixiformui-ssr.js         pixiformui/ssr: server-rendered placeholder (no DOM needed)
 */
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  const ssr = mode === 'ssr';
  return {
    publicDir: false,
    build: {
      outDir: 'dist-lib',
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: true,
      minify: standalone ? 'terser' : false,
      lib: {
        entry: resolve(__dirname, ssr ? 'src/lib/ssr.ts' : standalone ? 'src/lib/standalone.ts' : 'src/lib/index.ts'),
        formats: ['es'],
        fileName: () => (ssr ? 'pixiformui-ssr.js' : standalone ? 'pixiformui.standalone.js' : 'pixiformui.js'),
      },
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
    },
  };
});
