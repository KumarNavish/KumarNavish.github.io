import { defineConfig } from 'vite'

export default defineConfig({
  root: 'demos/safepatch',
  base: '/safepatch/',
  build: {
    outDir: '../../public/safepatch',
    emptyOutDir: true,
  },
})
