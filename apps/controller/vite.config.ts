import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    build: {
      outDir: 'app/src/main/assets',
      emptyOutDir: true,
    },
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'html-transform-no-crossorigin',
        transformIndexHtml(html) {
          return html.replace(/\s+crossorigin(="[^"]*")?/g, '');
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
