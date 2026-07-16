import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA is for POS terminals only: the public storefront (/tienda) is
    // excluded from the offline navigation fallback so customers always see
    // live prices and availability.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Los Pollos Primos POS',
        short_name: 'Primos POS',
        description: 'POS Ahumado Tropical — Los Pollos Primos',
        theme_color: '#c54908',
        background_color: '#fff8ed',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/tienda/],
        runtimeCaching: [
          {
            // catalog reads keep working offline; everything else stays network-first
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(products|combo_components|inventory_items).*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'catalog',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
