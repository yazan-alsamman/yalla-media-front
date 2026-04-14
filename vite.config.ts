import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deploy / dev under folder "Yalla media" → URL segment Yalla%20media
const APP_BASE = '/Yalla%20media/'

// https://vite.dev/config/
export default defineConfig({
  base: APP_BASE,
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
