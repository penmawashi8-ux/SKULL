import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      className="fixed bottom-6 left-4 right-4 z-[100] flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-2xl"
      style={{
        background: 'linear-gradient(135deg, #1e1040, #0f0720)',
        border: '1px solid rgba(139,92,246,0.5)',
        boxShadow: '0 0 24px rgba(109,40,217,0.3)',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <p className="text-white/80 text-sm">
        新しいバージョンが利用可能です
      </p>
      <button
        onClick={() => updateServiceWorker(true)}
        className="flex-shrink-0 px-3 py-1.5 rounded-xl text-white text-sm font-bold"
        style={{ background: 'linear-gradient(135deg, #6d28d9, #4c1d95)' }}
      >
        更新
      </button>
    </div>
  )
}
