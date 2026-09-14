import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// This file runs in Node, but @types/node isn't a dependency of this package
// and isn't worth adding for one variable.
declare const process: { env: Record<string, string | undefined> }

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    /*
     * The library counter has to keep working when the internet does not, so
     * the admin bundle is installable and precached.
     *
     * generateSW rather than injectManifest: the precache manifest has to be
     * re-hashed on every deploy, and a hand-written worker needs someone to
     * remember to bump a version. The first time that is forgotten a librarian
     * is stranded on a stale build, offline, at a counter, during registration
     * week.
     *
     * registerType 'prompt', never 'autoUpdate': reloading a page that is
     * holding scans nobody has sent yet is how you lose them. The prompt is
     * disabled while the queue is non-empty.
     *
     * runtimeCaching is deliberately empty. The scope below limits which
     * DOCUMENTS this worker controls, not which requests pass through it - a
     * controlled page's fetch('/api/...') still goes through the worker. With
     * no runtime rules those go straight to the network, which is what we want:
     * the station's own IndexedDB cache is the offline story, and a
     * stale-while-revalidate on the API would hand the desk data of unknown age
     * with no way to tell the librarian how old it is.
     */
    VitePWA({
      registerType: 'prompt',
      base: '/admin/',
      scope: '/admin/',
      filename: 'sw.js',
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'York Castle Library Desk',
        short_name: 'YCHS Desk',
        description: 'Issue and return school textbooks at the library counter.',
        start_url: '/admin/library/desk',
        scope: '/admin/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1a1a2e',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/admin/index.html',
        // Anything outside the admin app must never be answered from the
        // precached shell - especially the API and the public site's pages.
        navigateFallbackDenylist: [/^\/api\//, /^\/health/, /^\/[^/]+\.html$/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      // Test the worker against a real build. A worker in the dev server caches
      // stale modules and costs hours.
      devOptions: { enabled: false },
    }),
  ],
  // Always use /admin/ base path when building (for single server setup)
  base: '/admin/',
  server: {
    port: 5173,
    proxy: {
      // The backend defaults to 3000, but the launch configs use autoPort, so
      // it can land elsewhere when that port is taken. Point this at wherever
      // it actually started: API_PROXY=http://localhost:3100 npm run dev
      '/api': {
        target: process.env.API_PROXY || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
          'chart-vendor': ['recharts'],
          'util-vendor': ['axios', 'moment', 'date-fns'],
        },
      },
    },
  },
}))

