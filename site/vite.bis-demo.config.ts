import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'demos/bis-continual-process-automation-demo',
  base: '/bis-continual-process-automation-demo/',
  plugins: [react()],
  build: {
    outDir: '../../public/bis-continual-process-automation-demo',
    emptyOutDir: true,
  },
})
