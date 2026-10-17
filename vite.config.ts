import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.svg', 'app-icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'CaliTracker',
        short_name: 'CaliTracker',
        description: 'Private, on-device calisthenics skill analysis and training log.',
        theme_color: '#101210',
        background_color: '#101210',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /\/(?:models\/pose_landmarker_lite\.task|mediapipe\/wasm\/vision_wasm_(?:internal|module_internal|nosimd_internal)\.(?:js|wasm))$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pose-model-assets',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
