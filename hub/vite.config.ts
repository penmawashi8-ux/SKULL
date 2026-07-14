import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    tailwindcss(),
    react(),
    // PWA（Service Worker生成）はクライアントビルドのみ。
    // プリレンダリング用のSSRビルドでは不要。
    ...(isSsrBuild
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            manifest: {
              name: 'ボドゲ広場',
              short_name: 'ボドゲ広場',
              description: 'みんなで遊べるオンラインボードゲームが集まった広場',
              theme_color: '#0f0c29',
              background_color: '#0f0c29',
              display: 'standalone',
              icons: [],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            },
          }),
        ]),
  ],
}))
