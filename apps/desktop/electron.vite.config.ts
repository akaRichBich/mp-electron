import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// Workspace packages ship TypeScript source, so they are bundled rather than
// treated as installed dependencies.
const workspace = ['@mp/core', '@mp/port-node', '@mp/ui']

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin({ exclude: workspace })] },
  preload: { plugins: [externalizeDepsPlugin({ exclude: workspace })] },
  renderer: { plugins: [react()] },
})
