import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { playButtonPress } from '../lib/sounds'

const RULES = [
  {
    title: 'ゲームの目的',
    body: '2回のチャレンジ成功で勝利。最後の1人になっても勝利。',
  },
  {
    title: '手札',
    body: '各プレイヤーはりんご3枚・爆弾1枚の計4枚でスタート。',
  },
  {
    title: '配置フェーズ',
    body: '手番順にカードを1枚伏せて場に置く。好きなカードを選べる（相手には見えない）。',
  },
  {
    title: '入札フェーズ',
    body: '「○枚のりんごをめくれる」と宣言してチャレンジ開始。他のプレイヤーはより高く宣言するかパス（フォールド）。',
  },
  {
    title: 'めくりフェーズ',
    body: '最高入札者が自分の山を全部めくった後、他の山を自由な順でめくる。宣言枚数のりんごをめくれたら勝利点！',
  },
  {
    title: '爆弾を踏んだら',
    body: '自分の手札からランダムに1枚を失う。手札が0になると脱落。',
  },
  {
    title: 'タイムリミット',
    body: '各ターン30秒の制限時間あり。時間切れになると自動でランダムな行動が実行される。',
  },
  {
    title: 'エモート',
    body: 'カードを置いた直後に爆弾かりんごのエモートを送れる。相手をブラフで惑わせよう！',
  },
]

const MODES = [
  {
    label: 'CPU対戦',
    sub: '1人でCPUと対戦',
    path: '/cpu',
    gradient: 'from-blue-900 to-blue-700',
    border: 'border-blue-500/40',
    glow: 'shadow-blue-500/20',
  },
  {
    label: 'オンライン対戦',
    sub: 'ルームコードで友達と',
    path: null,
    gradient: 'from-purple-900 to-purple-700',
    border: 'border-purple-500/40',
    glow: 'shadow-purple-500/20',
  },
  {
    label: 'ルール確認',
    sub: 'BOMBの遊び方',
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
    playButtonPress()
    if (idx === 0) navigate('/cpu')
    else if (idx === 1) setShowOnline(v => !v)
    else setShowRules(true)
  }

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #030712 70%)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-6 pb-4">
        <button
          onClick={() => { playButtonPress(); navigate('/') }}
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
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {MODES.map((mode, idx) => (
          <button
            key={mode.label}
            onClick={() => handleMode(idx)}
            className={`w-full p-5 rounded-2xl border ${mode.border} bg-gradient-to-br ${mode.gradient} shadow-xl ${mode.glow} text-left relative overflow-hidden active:scale-[0.98] transition-transform`}
          >
            <div className="flex items-center gap-4">
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
          </button>
        ))}

        {/* Online submenu */}
        {showOnline && (
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { playButtonPress(); navigate('/online/create') }}
              className="flex-1 py-3 rounded-xl bg-purple-800/60 border border-purple-500/30 text-white text-sm font-semibold active:scale-[0.97] transition-transform"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              ＋ ルームを作る
            </button>
            <button
              onClick={() => { playButtonPress(); navigate('/online/join') }}
              className="flex-1 py-3 rounded-xl bg-purple-800/60 border border-purple-500/30 text-white text-sm font-semibold active:scale-[0.97] transition-transform"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              → ルームに入る
            </button>
          </div>
        )}
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
                ゲームルール
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
                onClick={() => { playButtonPress(); setShowRules(false) }}
                className="mt-6 w-full py-3 rounded-xl border border-white/20 text-white/70 text-sm active:scale-[0.97] transition-transform"
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
