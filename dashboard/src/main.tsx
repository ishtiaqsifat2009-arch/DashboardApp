import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConfirmationProvider } from './ConfirmDialog.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmationProvider>
      <App />
    </ConfirmationProvider>
  </StrictMode>,
)
