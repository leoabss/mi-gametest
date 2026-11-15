import { defineConfig } from 'vite';

// base relativa: funciona en GitHub Pages bajo /<repo>/ sin configurar nada.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000, // Phaser pesa ~1.5 MB; es esperado.
  },
});
