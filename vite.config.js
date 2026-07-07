import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { tmpdir } from 'os';

export default defineConfig({
  plugins: [react()],
  cacheDir: resolve(tmpdir(), 'vite-fabricateiq'),
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          exceljs: ['exceljs']
        }
      }
    }
  }
});
