import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: {
    include: ['pptxgenjs'],
  },
  build: {
    commonjsOptions: {
      include: [/pptxgenjs/, /node_modules/],
    },
  },
})
