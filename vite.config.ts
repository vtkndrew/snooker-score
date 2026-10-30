import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, isPreview }) => ({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: command === 'build' || isPreview ? '/snooker-score/' : '/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false, // pwa.ts owns registration and explicit update consent.
      scope: '/snooker-score/',
      includeManifestIcons: false,
      manifest: {
        id: '/snooker-score/',
        start_url: '/snooker-score/',
        scope: '/snooker-score/',
        name: 'Счёт снукера',
        short_name: 'Счёт снукера',
        lang: 'ru',
        description:
          'Счёт, серии и история ваших матчей в снукер. Всегда под рукой, даже без интернета.',
        display: 'standalone',
        theme_color: '#101b19',
        background_color: '#101b19',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cacheId: 'snooker-score',
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/snooker-score(?:\/|$)/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
}));
