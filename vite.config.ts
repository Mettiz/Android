// Vite Build Configuration - Final ShiftFlow v4.1.0 (Android & Vercel Ready)
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false,
    ws: false,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/firestore'],
          'xlsx-vendor': ['xlsx'],
          'recharts-vendor': ['recharts'],
          'icons': ['lucide-react'],
        }
      }
    }
  }
});
