import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Exclude SSE and auth endpoints from service worker interception
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // ── Static uploads / media: CacheFirst (aggressive, long TTL) ──────
          {
            urlPattern: /\/uploads\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          },

          // ── Never cache: SSE stream, login, ping, write ops ───────────────
          {
            urlPattern: /\/api\/(stream|ping|auth\/login)/,
            handler: 'NetworkOnly'
          },

          // ── Always fetch fresh from server: campaigns, lists, locales ─────────
          {
            urlPattern: /\/api\/(locales|campaigns|lists|admin\/lists)/,
            handler: 'NetworkOnly'
          },

          // ── Stats & KPI data: StaleWhileRevalidate with short TTL ─────────
          {
            urlPattern: /\/api\/stats\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'stats-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },

          // ── Mutable user/elector data: NetworkFirst (fresh when online) ───
          {
            urlPattern: /\/api\/(users|electors|coordinator|captures|admin\/conflicts|admin\/requests|structure)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mutable-data-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },

          // ── Reports (PDF/CSV) – always fresh from server ──────────────────
          {
            urlPattern: /\/api\/reports\//,
            handler: 'NetworkOnly'
          },

          // ── WhatsApp endpoints: NetworkFirst (real-time comms) ────────────
          {
            urlPattern: /\/api\/whatsapp\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'whatsapp-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 50, maxAgeSeconds: 2 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },

          // ── Roadmap state: NetworkFirst ───────────────────────────────────
          {
            urlPattern: /\/api\/roadmap-state/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'roadmap-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 5, maxAgeSeconds: 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: 'Intelecciones - Comando Electoral',
        short_name: 'Intelecciones',
        description: 'Sistema Táctico de Gestión Electoral y Veeduria',
        theme_color: '#0056b3',
        background_color: '#0a0a0c',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/favicon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild'
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'leaflet', 'framer-motion']
  }
})