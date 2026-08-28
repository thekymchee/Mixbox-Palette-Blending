import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://<owner>.github.io/Mixbox-Palette-Blending/ on GitHub Pages.
  base: '/Mixbox-Palette-Blending/',
})
