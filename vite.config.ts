import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import * as path from "path";
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 8008
  },
  plugins: [
    preact(),
    viteCompression({
      ext: '.gz',
      deleteOriginFile: false,
    }),
    viteCompression({
      ext: '.br',
      algorithm: 'brotliCompress',
      deleteOriginFile: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  }
});
