import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd() + '/..', '')
  const backendPort = env.BACKEND_PORT || '8000'
  const frontendPort = env.FRONTEND_PORT || '5173'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(frontendPort),
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://localhost:${backendPort}`,
          ws: true,
        },
      },
    },
  }
})
