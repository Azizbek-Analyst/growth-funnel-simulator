import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        feature: resolve(__dirname, 'feature.html'),
        compare: resolve(__dirname, 'compare.html'),
        settings: resolve(__dirname, 'settings.html'),
        funnel: resolve(__dirname, 'funnel.html'),
        docs: resolve(__dirname, 'docs.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
