import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // three.js 单独一个按需加载的 chunk（~560 kB，gzip ~140 kB）
  build: { chunkSizeWarningLimit: 600 },
})
