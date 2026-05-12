import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Player, PlacedDisc } from '../types/game'

interface Props {
  show: boolean
  type: 'success' | 'bomb' | 'win' | 'lose' | null
  challenger?: Player
  bombOwner?: Player
  lostDisc?: PlacedDisc
  onClose: () => void
  onReturnToHub?: () => void
}

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-8px',
            backgroundColor: ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#3b82f6'][i % 5],
          }}
          animate={{
            y: ['0vh', '110vh'],
            rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
            x: [0, (Math.random() - 0.5) * 80],
          }}
          transition={{
            duration: 1.8 + Math.random() * 1.2,
            delay: Math.random() * 0.6,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  )
}

export function ResultModal({ show, type, challenger, bombOwner, lostDisc, onClose, onReturnToHub }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  // One-shot wrapper prevents double-call when timer and tap race each other
  const fireOnce = useRef(() => {
    if (firedRef.current) return
    firedRef.current = true
    onClose()
  })
  fireOnce.current = () => {
    if (firedRef.current) return
    firedRef.current = true
    onClose()
  }

  useEffect(() => {
    if (!show) { firedRef.current = false; return }
    if (type === 'success' || type === 'bomb') {
      timerRef.current = setTimeout(() => fireOnce.current(), 3200)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [show, type])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={type !== 'win' && type !== 'lose' ? () => fireOnce.current() : undefined}
        >
          {(type === 'success' || type === 'win') && <Confetti />}

          {/* Bomb hit – screen shake */}
          {type === 'bomb' && (
            <motion.div
              className="absolute inset-0 bg-red-600/20"
              animate={{ x: [0, -8, 8, -8, 8, 0] }}
              transition={{ duration: 0.4 }}
            />
          )}

          <motion.div
            className="relative bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {/* SUCCESS */}
            {type === 'success' && (
              <>
                <div className="text-6xl mb-3">🍎</div>
                <h2 className="text-2xl font-bold text-emerald-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                  チャレンジ成功！
                </h2>
                <p className="text-white/70" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {challenger?.player_name} が勝利点を獲得
                </p>
              </>
            )}

            {/* BOMB HIT */}
            {type === 'bomb' && (
              <>
                <div className="text-6xl mb-3 animate-bounce">💣</div>
                <h2 className="text-2xl font-bold text-red-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                  爆弾を踏んだ！
                </h2>
                <p className="text-white/70 mb-3" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {bombOwner?.player_name} の爆弾に触れてしまった
                </p>
                {lostDisc && (
                  <p className="text-xs text-red-400/70 mb-4" style={{ fontFamily: 'Crimson Text, serif' }}>
                    {challenger?.player_name} はランダムにカードを1枚失う
                  </p>
                )}
                <button
                  onClick={() => fireOnce.current()}
                  className="w-full py-3 border border-red-500/40 rounded-xl text-red-300 text-sm mt-2"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  続ける
                </button>
              </>
            )}

            {/* GAME WIN */}
            {type === 'win' && (
              <>
                <div className="text-6xl mb-3">👑</div>
                <h2 className="text-2xl font-bold text-amber-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                  ゲーム勝利！
                </h2>
                <p className="text-white/70 mb-4" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {challenger?.player_name} が2回のチャレンジに成功した！
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={onClose}
                    className="py-3 bg-gradient-to-r from-amber-600 to-amber-400 rounded-xl text-black font-bold"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    BOMBへ戻る
                  </button>
                  <button
                    onClick={onReturnToHub}
                    className="py-3 border border-white/20 rounded-xl text-white/80"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    ボドゲ広場へ
                  </button>
                </div>
              </>
            )}

            {/* GAME LOSE */}
            {type === 'lose' && (
              <>
                {(challenger?.win_count ?? 0) >= 2 ? (
                  <>
                    <div className="text-6xl mb-3">💔</div>
                    <h2 className="text-2xl font-bold text-gray-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                      敗北
                    </h2>
                    <p className="text-white/70 mb-4" style={{ fontFamily: 'Crimson Text, serif' }}>
                      {challenger?.player_name} が2回のチャレンジに成功した
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-3">🪦</div>
                    <h2 className="text-2xl font-bold text-gray-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                      ゲームオーバー
                    </h2>
                    <p className="text-white/70 mb-4" style={{ fontFamily: 'Crimson Text, serif' }}>
                      全てのカードを失ってしまった
                    </p>
                  </>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={onClose}
                    className="py-3 border border-white/20 rounded-xl text-white/70"
                  >
                    BOMBへ戻る
                  </button>
                  <button
                    onClick={onReturnToHub}
                    className="py-3 border border-white/20 rounded-xl text-white/80"
                  >
                    ボドゲ広場へ
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
