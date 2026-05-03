import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

const RANDOM_NAMES = ['騎士', '魔法使い', '盗賊', '詩人', '商人', '旅人', '冒険者', '忍者', '吟遊詩人', '錬金術師']

export function CreateRoomScreen() {
  const navigate = useNavigate()
  const { createRoom, isLoading, error } = useGameStore()

  const [defaultName]              = useState(() => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)])
  const [name, setName]           = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [roomCode, setRoomCode]   = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)

  async function handleCreate() {
    const code = await createRoom(name.trim() || defaultName, maxPlayers)
    setRoomCode(code)
  }

  function handleCopy() {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="h-svh flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #030712 70%)' }}
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
          ルームを作成
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col px-6 pt-4 pb-8 gap-6">
        <AnimatePresence mode="wait">
          {!roomCode ? (
            /* ── Form ──────────────────────────────────────────────── */
            <motion.div
              key="form"
              className="flex flex-col gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -30 }}
            >
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

              {/* Max players */}
              <div>
                <label
                  className="block text-white/60 text-sm mb-3"
                  style={{ fontFamily: 'Crimson Text, serif' }}
                >
                  最大人数　<span className="text-white font-bold text-base">{maxPlayers} 人</span>
                </label>
                <div className="flex gap-2">
                  {[3, 4, 5, 6].map(n => (
                    <motion.button
                      key={n}
                      onClick={() => setMaxPlayers(n)}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${
                        maxPlayers === n
                          ? 'border-purple-500 text-purple-300 bg-purple-900/40'
                          : 'border-white/10 text-white/40 bg-transparent'
                      }`}
                      whileTap={{ scale: 0.95 }}
                      style={{ fontFamily: 'Cinzel, serif' }}
                    >
                      {n}
                    </motion.button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {error}
                </p>
              )}

              <motion.button
                onClick={handleCreate}
                disabled={isLoading}
                className="w-full py-4 rounded-2xl text-white text-xl font-bold disabled:opacity-40 mt-4"
                style={{
                  fontFamily: 'Cinzel, serif',
                  background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
                  boxShadow: '0 0 24px rgba(109,40,217,0.4)',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                {isLoading ? '作成中...' : 'ルームを作成'}
              </motion.button>
            </motion.div>
          ) : (
            /* ── Room created ───────────────────────────────────────── */
            <motion.div
              key="created"
              className="flex flex-col items-center gap-6 pt-8"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <p className="text-white/60 text-sm" style={{ fontFamily: 'Crimson Text, serif' }}>
                ルームが作成されました
              </p>

              {/* Room code display */}
              <div
                className="relative w-full py-8 rounded-2xl flex flex-col items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(109,40,217,0.2), rgba(76,29,149,0.2))',
                  border: '1px solid rgba(139,92,246,0.4)',
                }}
              >
                <p className="text-white/40 text-xs tracking-widest" style={{ fontFamily: 'Crimson Text, serif' }}>
                  ROOM CODE
                </p>
                <p
                  className="text-5xl font-bold text-white tracking-[0.2em]"
                  style={{
                    fontFamily: 'Cinzel, serif',
                    textShadow: '0 0 30px rgba(139,92,246,0.8)',
                  }}
                >
                  {roomCode}
                </p>
                <p className="text-white/30 text-xs" style={{ fontFamily: 'Crimson Text, serif' }}>
                  友達にこのコードを教えてください
                </p>
              </div>

              {/* Copy button */}
              <motion.button
                onClick={handleCopy}
                className="w-full py-3 rounded-xl border border-white/20 text-white/70 text-sm flex items-center justify-center gap-2"
                whileTap={{ scale: 0.97 }}
                style={{ fontFamily: 'Crimson Text, serif' }}
              >
                {copied ? '✓ コピーしました' : '📋 コードをコピー'}
              </motion.button>

              {/* Go to lobby */}
              <motion.button
                onClick={() => navigate(`/room/${roomCode}`)}
                className="w-full py-4 rounded-2xl text-white text-xl font-bold"
                style={{
                  fontFamily: 'Cinzel, serif',
                  background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
                  boxShadow: '0 0 24px rgba(109,40,217,0.4)',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                ロビーへ進む →
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
