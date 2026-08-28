import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// Workspace packages ship TypeScript source, so they are bundled rather than
// treated as installed dependencies.
const workspace = ['@mp/core', '@mp/port-node', '@mp/ui']

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspace })],
    build: {
      rollupOptions: {
        // The scan runs in a utility process, so it needs its own entry.
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'scan-worker': resolve(__dirname, 'src/main/scan-worker.ts'),
        },
      },
    },
  },
  preload: { plugins: [externalizeDepsPlugin({ exclude: workspace })] },
  renderer: { plugins: [react()] },
})
