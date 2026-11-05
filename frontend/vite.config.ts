import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 本地开发时把 /api 转发给 Docker 里跑的 Django
      '/api': {
        target: 'http://127.0.0.1:889',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 直接产出到 nginx 的站点根目录, 替换掉旧的 Vue 产物
    outDir: '../web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:889',
        changeOrigin: true,
      },
    },
  },
})
