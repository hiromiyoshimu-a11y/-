import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pages などの相対パスデプロイに対応
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
