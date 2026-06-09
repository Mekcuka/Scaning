import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import http from 'node:http'
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

/**
 * Vite 8 resolves server.proxy.target once at startup; the legacy `router` option
 * is ignored. Proxy /api ourselves so each request reads backend/.dev-port.
 */
function dynamicBackendApiProxy(): Plugin {
  return {
    name: 'dynamic-backend-api-proxy',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api')) {
          next()
          return
        }

        const target = resolveBackendProxyTarget()
        const parsed = new URL(target)
        const port =
          parsed.port ||
          (parsed.protocol === 'https:' ? 443 : 80)

        const proxyReq = http.request(
          {
            hostname: parsed.hostname,
            port,
            path: url,
            method: req.method,
            headers: {
              ...req.headers,
              host: parsed.host,
            },
          },
          (proxyRes) => {
            const headers = { ...proxyRes.headers }
            const setCookie = headers['set-cookie']
            if (setCookie) {
              const rewritten = (Array.isArray(setCookie) ? setCookie : [setCookie]).map(
                (cookie) =>
                  cookie
                    .replace(/;\s*Domain=[^;]*/gi, '; Domain=localhost')
                    .replace(/;\s*Path=[^;]*/gi, '; Path=/'),
              )
              headers['set-cookie'] = rewritten
            }
            res.writeHead(proxyRes.statusCode ?? 502, headers)
            proxyRes.pipe(res)
          },
        )

        proxyReq.on('error', (err) => {
          server.config.logger.error(
            `api proxy ${req.method} ${url} -> ${target}: ${err.message}`,
          )
          if (!res.headersSent) {
            res.writeHead(502)
            res.end('Bad Gateway')
          }
        })

        req.pipe(proxyReq)
      })

      try {
        fs.watch(devPortFile, () => {
          server.config.logger.info(
            `backend proxy target -> ${resolveBackendProxyTarget()}`,
          )
        })
      } catch {
        // run_local.py not started yet
      }
    },
  }
}

export default defineConfig({
  base,
  plugins: [dynamicBackendApiProxy(), react(), tailwindcss()],
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
  },
})
