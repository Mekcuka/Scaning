import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** GitHub Pages project site: https://<user>.github.io/<repo>/ */
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/ol')) return 'map2d'
          if (id.includes('node_modules/three') || id.includes('node_modules/maplibre-gl')) return 'map3d'
          if (id.includes('node_modules/@xyflow') || id.includes('node_modules/dagre')) return 'flow'
          if (id.includes('node_modules/recharts')) return 'charts'
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
    },
  },
})
