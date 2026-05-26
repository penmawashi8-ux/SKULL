import { useRegisterSW } from 'virtual:pwa-register/react'

const SW_UPDATE_INTERVAL_MS = 60 * 1000

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
