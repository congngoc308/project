import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const apiTarget = process.env.API_TARGET ?? "http://localhost:8010"

export default defineConfig({
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    host: true,
    port: 5190,
    strictPort: true,
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  preview: { host: true, port: 5190, proxy: { "/api": { target: apiTarget, changeOrigin: true } } },
})
