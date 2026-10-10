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
              // 先読みするのはアプリの殻（SPAのindex.htmlとバンドル）だけにする。
              // 以前は **/*.{js,css,html,ico,png,svg} で、記事・ゲームページの
              // HTML 46枚とOGP画像まで含む73ファイル・2.4MBを初回訪問時に
              // 全部取りにいっていた。訪問者はたいてい1ページしか見ないので、
              // これがCDNリクエストの大半を占めていた（月1万人で73万リクエスト）。
              // 記事やアイコンはCDNから都度配信すれば足りる。
              globPatterns: [
                'index.html',
                'manifest.webmanifest',
                'favicon.ico',
                'assets/**/*.{js,css}',
              ],
              // ナビゲーションは既定で index.html（SPA）にフォールバックする。
              // SPAのルートに無いパスは App.tsx が <NotFound /> を返すため、
              // 実ファイルがあるのに404画面が出てしまう。
              // SPAが扱わないURLはここで除外し、常にネットワークの応答を使う。
              navigateFallbackDenylist: [
                // ゲーム本体（静的HTML）
                /^\/play\//,
                // ブログ記事。SPAのルートではなく実体のある静的HTML。
                // 先読み対象から外したので、除外しないとSPAの404になる。
                /^\/blog\//,
                // クローラー向けのファイル。globPatterns が拾わないため
                // precache にも入らず、除外しないと必ずSPAの404になる。
                /^\/sitemap\.xml$/,
                /^\/robots\.txt$/,
              ],
            },
          }),
        ]),
  ],
}))
