import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/jsonrpc': {
        target: 'http://10.102.7.237:8069',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})