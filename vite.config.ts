import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APP_BASE = process.env.VITE_APP_BASE || '/'

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
