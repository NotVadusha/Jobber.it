import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Same-origin /api as in prod: no API base URL, no CORS.
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
})
