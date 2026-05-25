import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // In production the backend serves /api directly — no proxy needed.
  // In development Vite forwards /api calls to the Express server.
  server: {
    port: 5173,
    proxy: mode === 'development'
      ? {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        '/health': { target: 'http://localhost:3001', changeOrigin: true },
      }
      : {},
  },

  // Ensure assets use relative paths so the app works when served from any
  // sub-path or directly from the Express static middleware.
  base: '/',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Produce source maps so errors are readable in production if needed
    sourcemap: false,
  },
}));