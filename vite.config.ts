import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    host: true,
    hmr: {
      clientPort: 3000,
      protocol: 'ws',
    },
    proxy: {
      '/api/images': {
        target: process.env.IMAGE_PROCESSOR_URL || 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/images/, '/api/images'),
      },
    },
  },
  preview: {
    port: 3000,
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
