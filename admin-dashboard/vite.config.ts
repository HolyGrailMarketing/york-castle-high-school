import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This file runs in Node, but @types/node isn't a dependency of this package
// and isn't worth adding for one variable.
declare const process: { env: Record<string, string | undefined> }

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
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

