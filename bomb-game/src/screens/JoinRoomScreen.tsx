import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'

const RANDOM_NAMES = ['騎士', '魔法使い', '盗賊', '詩人', '商人', '旅人', '冒険者', '忍者', '吟遊詩人', '錬金術師']

export function JoinRoomScreen() {
  const navigate  = useNavigate()
  const { joinRoom, isLoading, error } = useGameStore()

  const [defaultName]       = useState(() => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)])
  const [name, setName]     = useState('')
  const [code, setCode]     = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const joiningRef = useRef(false)

  function handleCodeChange(raw: string) {
    const filtered = raw.replace(/[^a-zA-Z0-9]/g, '')
    const base = code.length > 0 ? code : filtered
    if (base.length === 0) { setCode(''); return }
    const isDigits = /^\d/.test(base)
    const cleaned = isDigits
      ? filtered.replace(/[^0-9]/g, '')
      : filtered.replace(/[^a-zA-Z]/g, '')
    setCode(cleaned.slice(0, 6))
  }

  async function handleJoin() {
    if (code.length !== 6 || joiningRef.current || isSubmitting || isLoading) return
    joiningRef.current = true
    setIsSubmitting(true)
    try {
      await joinRoom(code.toUpperCase(), name.trim() || defaultName)
      if (!useGameStore.getState().error) {
        navigate(`/room/${code.toUpperCase()}`)
      }
    } finally {
      joiningRef.current = false
      setIsSubmitting(false)
    }
  }

  const isReady = code.length === 6

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #261545 0%, #0e1023 70%)' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-6 pb-4">
        <button
          onClick={() => navigate('/menu')}
          className="text-white/50 hover:text-white transition-colors text-sm"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          ← 戻る
        </button>
        <h1 className="text-xl font-bold text-white/90" style={{ fontFamily: 'Cinzel, serif' }}>
          ルームに参加
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6 pb-4 flex flex-col gap-6">
        {/* Name */}
        <div>
          <label
            className="block text-white/60 text-sm mb-2"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            あなたの名前
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={12}
            placeholder={defaultName}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-500/60 text-lg"
            style={{ fontFamily: 'Crimson Text, serif' }}
          />
        </div>

        {/* Room code */}
        <div>
          <label
            className="block text-white/60 text-sm mb-2"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            ルームコード（英字6文字 または 数字6桁）
          </label>
          <input
            type="text"
            value={code}
            onChange={e => handleCodeChange(e.target.value)}
            placeholder="ABCDEF / 123456"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-500/60 text-center text-3xl tracking-[0.3em] font-bold"
            style={{ fontFamily: 'Cinzel, serif', textTransform: 'uppercase' }}
          />
          <div className="flex justify-center gap-2 mt-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i < code.length ? 'bg-purple-400 scale-125' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <p
            className="text-red-400 text-sm text-center bg-red-950/30 border border-red-500/20 rounded-xl py-3 px-4"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Join button */}
      <div
        className="flex-shrink-0 px-6 pt-3 pb-6"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleJoin}
          disabled={isLoading || isSubmitting || !isReady}
          className="w-full py-4 rounded-2xl text-white text-xl font-bold disabled:opacity-40 active:scale-[0.97] transition-transform"
          style={{
            fontFamily: 'Cinzel, serif',
            background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
            boxShadow: isReady ? '0 0 24px rgba(109,40,217,0.4)' : 'none',
            touchAction: 'manipulation',
            pointerEvents: (isLoading || isSubmitting) ? 'none' : 'auto',
          }}
        >
          {isLoading || isSubmitting ? '参加中...' : '参加する'}
        </button>
      </div>
    </div>
  )
}
