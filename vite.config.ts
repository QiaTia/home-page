import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import * as path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 88
  },
  plugins: [preact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  }
});
