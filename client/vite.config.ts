import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          qrcode: ['qrcode'],
          state: ['zustand'],
        },
      },
    },
  },
  plugins: [
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/uploads': 'http://localhost:3000',
    },
  },
});
