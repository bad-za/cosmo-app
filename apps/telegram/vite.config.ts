import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути в сборке: мини-апп можно хостить из любого подкаталога
  base: './',
  server: {
    port: 5186,
    strictPort: true,
  },
});
