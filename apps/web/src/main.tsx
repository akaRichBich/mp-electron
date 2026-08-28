import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { keepFresh } from './service-worker'
import '@mp/ui/styles.css'

keepFresh()

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
