import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

const RANDOM_NAMES = ['騎士', '魔法使い', '盗賊', '詩人', '商人', '旅人', '冒険者', '忍者', '吟遊詩人', '錬金術師']

const DIFFICULTIES = [
  { value: 'easy',   label: 'かんたん', sub: '初心者向け',   color: 'border-emerald-500 text-emerald-400' },
  { value: 'normal', label: 'ふつう',   sub: 'バランス良い', color: 'border-blue-500 text-blue-400'    },
  { value: 'hard',   label: 'むずかしい', sub: '上級者向け', color: 'border-red-500 text-red-400'      },
]

export function CpuSetupScreen() {
  const navigate = useNavigate()
  const { startCpuGame, isLoading, error } = useGameStore()

  const [defaultName]              = useState(() => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)])
  const [name, setName]           = useState('')
  const [cpuCount, setCpuCount]   = useState(2)
  const [difficulty, setDifficulty] = useState('normal')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleStart() {
    if (isSubmitting || isLoading) return
    setIsSubmitting(true)
    try {
      await startCpuGame(name.trim() || defaultName, cpuCount, difficulty)
      const room = useGameStore.getState().room
      if (room) navigate(`/game/${room.room_code}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0a1a2e 0%, #030712 70%)' }}
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
          🤖 CPU対戦設定
        </h1>
      </div>

      {/* Scrollable settings */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-2 pb-4 flex flex-col gap-6">
        {/* Player name */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
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
        </motion.div>

        {/* CPU count */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <label
            className="block text-white/60 text-sm mb-3"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            CPU人数　<span className="text-white font-bold text-base">{cpuCount} 人</span>
          </label>
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => setCpuCount(v => Math.max(1, v - 1))}
              disabled={cpuCount <= 1}
              className="w-10 h-10 rounded-full border border-white/20 text-white text-xl disabled:opacity-30 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              −
            </motion.button>
            <div className="flex-1 flex justify-center gap-2">
              {Array.from({ length: 5 }, (_, i) => i + 1).map(n => (
                <motion.button
                  key={n}
                  onClick={() => setCpuCount(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold border transition-all ${
                    cpuCount === n
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  {n}
                </motion.button>
              ))}
            </div>
            <motion.button
              onClick={() => setCpuCount(v => Math.min(5, v + 1))}
              disabled={cpuCount >= 5}
              className="w-10 h-10 rounded-full border border-white/20 text-white text-xl disabled:opacity-30 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              ＋
            </motion.button>
          </div>
          <p className="text-white/30 text-xs text-center mt-2" style={{ fontFamily: 'Crimson Text, serif' }}>
            合計 {cpuCount + 1} 人でプレイ
          </p>
        </motion.div>

        {/* Difficulty */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <label
            className="block text-white/60 text-sm mb-3"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            難易度
          </label>
          <div className="flex flex-col gap-2">
            {DIFFICULTIES.map(d => (
              <motion.button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  difficulty === d.value
                    ? `${d.color} bg-white/5`
                    : 'border-white/10 text-white/40 bg-transparent'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <span
                  className="font-bold text-base block"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  {d.label}
                </span>
                <span
                  className="text-xs opacity-70"
                  style={{ fontFamily: 'Crimson Text, serif' }}
                >
                  {d.sub}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {error && (
          <p className="text-red-400 text-sm text-center" style={{ fontFamily: 'Crimson Text, serif' }}>
            {error}
          </p>
        )}
      </div>

      {/* Start button — always visible at bottom */}
      <div
        className="flex-shrink-0 px-6 pt-3 pb-6"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <motion.button
          onClick={handleStart}
          disabled={isLoading || isSubmitting}
          className="w-full py-4 rounded-2xl text-white text-xl font-bold disabled:opacity-40"
          style={{
            fontFamily: 'Cinzel, serif',
            background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
            boxShadow: '0 0 24px rgba(109,40,217,0.4)',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isLoading || isSubmitting ? '起動中...' : 'ゲーム開始'}
        </motion.button>
      </div>
    </div>
  )
}
