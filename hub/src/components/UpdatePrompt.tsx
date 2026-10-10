import { useRegisterSW } from 'virtual:pwa-register/react'

// Service Worker の更新チェック間隔。
//
// registration.update() は毎回ネットワークへ出る（sw.js と workbox-*.js は
// vercel.json で no-store にしてあるため、HTTPキャッシュが効かない）。
// 60秒にしていたときは、タブを開いているだけで1時間あたり約144リクエスト
// 発生していた。ゲームを30分遊ぶ人で72リクエストの上乗せになる。
//
// registerType: 'autoUpdate' なのでページを開いた時点でも更新は確認される。
// 開きっぱなしのタブ向けの保険として1時間に1回あれば足りる。
const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000

export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      setInterval(() => {
        registration.update()
      }, SW_UPDATE_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed bottom-6 left-4 right-4 z-[100] flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-2xl"
      style={{
        background: 'linear-gradient(135deg, #1e2248, #181b38)',
        border: '1.5px solid rgba(255,212,59,0.35)',
        boxShadow: '0 0 24px rgba(255,212,59,0.15)',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <p className="text-white/80 text-sm font-sans-jp">✨ 新しいバージョンが利用可能です</p>
      <button
        onClick={() => updateServiceWorker(true)}
        className="flex-shrink-0 px-4 py-1.5 rounded-full text-white text-sm font-bold font-sans-jp"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #ffd43b)', color: '#1a1c30' }}
      >
        更新
      </button>
    </div>
  )
}
