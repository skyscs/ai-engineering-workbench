import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:4242'
    }
  },
  build: {
    outDir: '../daemon/public',
    emptyOutDir: true
  }
});
