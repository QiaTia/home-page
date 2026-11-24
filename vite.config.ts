import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import * as path from "path";
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/home-page/',
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
    VitePWA({
      registerType: 'autoUpdate',
      // 图标只在安装时读取, 不放入首访预缓存
      includeManifestIcons: false,
      manifest: {
        name: "QiaTia's Home",
        short_name: 'QiaTia',
        description: 'QiaTia 的个人主页与在线小工具集合',
        lang: 'zh-CN',
        theme_color: '#242424',
        background_color: '#242424',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 预缓存应用外壳, 避免把词库/模拟器等按需资源也塞进首访下载
        globPatterns: [
          'index.html',
          'assets/index-*.js',
          'assets/index-*.css',
          'assets/hooks-*.js',
          'assets/notify-*.js',
          'assets/preact-*.js',
          'favicon.ico',
        ],
        globIgnores: ['**/*.gz', '**/*.br', '**/jsnes.min.js', '**/panorama.jpg'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // 其余带 hash 的资源首次访问后缓存, 回访直接命中
            urlPattern: ({ url }) => url.pathname.includes('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'qiatia-assets',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    }
  }
});
