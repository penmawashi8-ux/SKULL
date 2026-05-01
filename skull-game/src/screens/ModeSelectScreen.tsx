import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const RULES = [
  {
    title: '🎯 ゲームの目的',
    body: '2回のチャレンジ成功で勝利。最後の1人になっても勝利。',
  },
  {
    title: '🃏 手札',
    body: '各プレイヤーは花3枚・ドクロ1枚の計4枚でスタート。',
  },
  {
    title: '1️⃣ 配置フェーズ',
    body: '手番順にカードを1枚伏せて場に置く。好きなカードを選べる（相手には見えない）。',
  },
  {
    title: '2️⃣ 入札フェーズ',
    body: '「○枚の花をめくれる」と宣言してチャレンジ開始。他のプレイヤーはより高く宣言するかパス（フォールド）。',
  },
  {
    title: '3️⃣ めくりフェーズ',
    body: '最高入札者が自分の山を全部めくった後、他の山を自由な順でめくる。宣言枚数の花をめくれたら勝利点！',
  },
  {
    title: '💀 ドクロを踏んだら',
    body: '自分の手札からランダムに1枚を失う（相手に捨て先を決められる場合も）。手札が0になると脱落。',
  },
]

const MODES = [
  {
    icon: '🤖',
    label: 'CPU対戦',
    sub: '1人でCPUと対戦',
    path: '/cpu',
    gradient: 'from-blue-900 to-blue-700',
    border: 'border-blue-500/40',
    glow: 'shadow-blue-500/20',
  },
  {
    icon: '👥',
    label: 'オンライン対戦',
    sub: 'ルームコードで友達と',
    path: null,
    gradient: 'from-purple-900 to-purple-700',
    border: 'border-purple-500/40',
    glow: 'shadow-purple-500/20',
  },
  {
    icon: '📖',
    label: 'ルール確認',
    sub: 'Skullの遊び方',
    path: null,
    gradient: 'from-amber-900 to-amber-700',
    border: 'border-amber-500/40',
    glow: 'shadow-amber-500/20',
  },
]

export function ModeSelectScreen() {
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)
  const [showOnline, setShowOnline] = useState(false)

  function handleMode(idx: number) {
    if (idx === 0) navigate('/cpu')
    else if (idx === 1) setShowOnline(v => !v)
    else setShowRules(true)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #030712 70%)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-6 pb-4">
        <button
          onClick={() => navigate('/')}
          className="text-white/50 hover:text-white transition-colors text-sm"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          ← 戻る
        </button>
        <h1
          className="text-xl font-bold text-white/90"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          モード選択
        </h1>
      </div>

      {/* Mode buttons */}
      <div className="flex-1 flex flex-col justify-center px-6 gap-4 pb-12">
        {MODES.map((mode, idx) => (
          <motion.button
            key={mode.label}
            onClick={() => handleMode(idx)}
            className={`w-full p-5 rounded-2xl border ${mode.border} bg-gradient-to-br ${mode.gradient} shadow-xl ${mode.glow} text-left relative overflow-hidden`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.4 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{mode.icon}</span>
              <div>
                <p
                  className="text-white text-xl font-bold"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  {mode.label}
                </p>
                <p
                  className="text-white/60 text-sm"
                  style={{ fontFamily: 'Crimson Text, serif' }}
                >
                  {mode.sub}
                </p>
              </div>
              <span className="ml-auto text-white/30 text-xl">›</span>
            </div>
          </motion.button>
        ))}

        {/* Online submenu */}
        <AnimatePresence>
          {showOnline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-3 pt-1">
                <motion.button
                  onClick={() => navigate('/online/create')}
                  className="flex-1 py-3 rounded-xl bg-purple-800/60 border border-purple-500/30 text-white text-sm font-semibold"
                  whileTap={{ scale: 0.97 }}
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  ＋ ルームを作る
                </motion.button>
                <motion.button
                  onClick={() => navigate('/online/join')}
                  className="flex-1 py-3 rounded-xl bg-purple-800/60 border border-purple-500/30 text-white text-sm font-semibold"
                  whileTap={{ scale: 0.97 }}
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  → ルームに入る
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rules modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRules(false)}
          >
            <motion.div
              className="w-full max-w-lg bg-gray-900 border-t border-white/10 rounded-t-3xl p-6 pb-10 max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
              <h2
                className="text-2xl font-bold text-white mb-6 text-center"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                📖 ゲームルール
              </h2>
              <div className="space-y-4">
                {RULES.map(rule => (
                  <div key={rule.title} className="bg-white/5 rounded-xl p-4">
                    <p
                      className="text-amber-400 font-semibold mb-1"
                      style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem' }}
                    >
                      {rule.title}
                    </p>
                    <p
                      className="text-white/80 text-sm leading-relaxed"
                      style={{ fontFamily: 'Crimson Text, serif', fontSize: '1rem' }}
                    >
                      {rule.body}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowRules(false)}
                className="mt-6 w-full py-3 rounded-xl border border-white/20 text-white/70 text-sm"
              >
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
