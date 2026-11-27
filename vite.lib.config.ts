import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Library builds (npm run build:lib):
 *   dist-lib/pixiformui.js             ESM for bundlers (React/Angular/Vue apps); no dependencies
 *   dist-lib/pixiformui.standalone.js  ESM, minified, registers <pixi-form> (plain HTML)
 *   dist-lib/pixiformui-ssr.js         pixiformui/ssr: server-rendered placeholder (no DOM needed)
 *   dist-lib/pixiformui-file.js        pixiformui/file: encrypted file uploads; imports the core from 'pixiformui'
 */
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  const ssr = mode === 'ssr';
  const file = mode === 'file';
  // pixiformui/file shares the app's copy of the core (one Control class, one renderer).
  const isCore = (id: string) => id === '../index' || /[\\/]src[\\/]lib[\\/]index(\.ts)?$/.test(id);
  return {
    publicDir: false,
    plugins: file ? [{ name: 'pixiformui-core-external', enforce: 'pre' as const, resolveId: (id: string) => (isCore(id) ? { id: 'pixiformui', external: true } : null) }] : [],
    build: {
      outDir: 'dist-lib',
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: true,
      minify: standalone ? 'terser' : false,
      lib: {
        entry: resolve(__dirname, file ? 'src/lib/file/index.ts' : ssr ? 'src/lib/ssr.ts' : standalone ? 'src/lib/standalone.ts' : 'src/lib/index.ts'),
        formats: ['es'],
        fileName: () => (file ? 'pixiformui-file.js' : ssr ? 'pixiformui-ssr.js' : standalone ? 'pixiformui.standalone.js' : 'pixiformui.js'),
      },
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
    },
  };
});
