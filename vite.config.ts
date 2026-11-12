import { defineConfig } from 'vitest/config';

// Les planches (AVIF) sont sur le R2 de Diablofus, qui n'autorise en CORS que diablofus.com et mathiss29.github.io.
// En dév, Vite les relaie sous /r2 (même origine, donc pas de CORS). En ligne, le build lit VITE_ASSETS_URL.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  server: {
    proxy: {
      '/r2': {
        target: 'https://assets.diablofus.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/r2/, ''),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
