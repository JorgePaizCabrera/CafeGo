import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FeedbackHost } from './components/ui/feedback'
import { escucharInstalacion } from './utils/instalarApp'
import './index.css'

escucharInstalacion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <FeedbackHost />
    </BrowserRouter>
  </StrictMode>,
)
