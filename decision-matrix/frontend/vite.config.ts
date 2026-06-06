import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** GitHub Pages project site: https://<user>.github.io/<repo>/ */
const base = process.env.VITE_BASE_PATH || '/'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devPortFile = path.resolve(__dirname, '../backend/.dev-port')

function resolveBackendProxyTarget(): string {
  if (process.env.VITE_BACKEND_PROXY) {
    return process.env.VITE_BACKEND_PROXY
  }
  try {
    const port = Number(fs.readFileSync(devPortFile, 'utf8').trim())
    if (Number.isFinite(port) && port > 0) {
      return `http://127.0.0.1:${port}`
    }
  } catch {
    // run_local.py not started yet — default port
  }
  return 'http://127.0.0.1:8000'
}

const backendProxyTarget = resolveBackendProxyTarget()

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
        target: backendProxyTarget,
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
    },
  },
})
