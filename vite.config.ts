import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// scripts/build.mjs sets APP_VERSION; the dev server falls back to "dev".
const appVersion = process.env['APP_VERSION'] ?? 'dev';

export default defineConfig({
  // Relative base: the same build works at /chw-timesheet/ on Pages and at a future subdomain root.
  base: './',
  plugins: [preact(), viteSingleFile({ removeViteModuleLoader: true })],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
