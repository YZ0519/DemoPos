import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: { port: 3000, https: true },
  build: {
    outDir: '../demopos-api/DemoPos.Api/wwwroot',
    emptyOutDir: true,
  },
})
