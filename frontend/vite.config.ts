import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ['unchivalric-tamia-praedial.ngrok-free.dev'],
    proxy: {
      "/api": {
        target: "https://upgraded-giggle-5g97467pv75gh4xw7-8000.app.github.dev",
        changeOrigin: true,
      },
      "/health": {
        target: "https://upgraded-giggle-5g97467pv75gh4xw7-8000.app.github.dev",
        changeOrigin: true,
      },
      "/ready": {
        target: "https://upgraded-giggle-5g97467pv75gh4xw7-8000.app.github.dev",
        changeOrigin: true,
      },
    },
  },
})