import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mp/ui/styles.css'
import './desktop.css'
import { App } from './app'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
