import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: 'Daily Trip Report',
        short_name: 'TripReport',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#344767',
        icons: [
          { src: '/manifest-icon-192.maskable.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/manifest-icon-192.maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/manifest-icon-512.maskable.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/manifest-icon-512.maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  server: { host: true },
  preview: { host: true }
})
