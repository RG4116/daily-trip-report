import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import FormPreview from './FormPreview.jsx'

// Register SW only in production. In dev, ensure no stale SW is controlling localhost.
if (import.meta.env.PROD) {
  registerSW({ immediate: true })
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
  if (window.caches?.keys) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
  }
}

const isPreview = window.location.pathname.endsWith('/preview') || new URLSearchParams(window.location.search).has('preview')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPreview ? <FormPreview /> : <App />}
  </React.StrictMode>
)
