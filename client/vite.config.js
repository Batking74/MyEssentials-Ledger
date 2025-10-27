// Importing Modules/Packages
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    createHtmlPlugin({ minify: true }),
    VitePWA({
      strategies: 'generateSW',
      srcDir: 'public',
      injectRegister: 'script',
      devOptions: { enabled: true, type: 'module' },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tailwind-cdn-cache',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },

      manifest: {
        id: "/",
        name: "MyEssentials Ledger",
        short_name: "MyEssentials Ledger",
        start_url: "/",
        display: "standalone",
        description: "Welcome to Nazir's essentials Ledger app!",
        background_color: "#000",
        theme_color: "red",
        orientation: "portrait-primary",
        icons: [
          {
            src: "https://placehold.co/192x192/1f2937/dc2626?text=MyEssentials Ledger",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "https://placehold.co/512x512/1f2937/dc2626?text=MyEssentials Ledger",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  server: {
    open: true,
    port: 20000
  }
})