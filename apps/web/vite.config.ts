import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Reclaim - disk report',
        short_name: 'Reclaim',
        description:
          'Read-only disk report for macOS. Pick a folder, see what can be reclaimed. Deleting lives in the desktop app.',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  // Workspace packages ship TypeScript source, so Vite must compile them
  // rather than treat them as pre-built dependencies.
  optimizeDeps: { exclude: ['@mp/core', '@mp/port-fsaa'] },
})
