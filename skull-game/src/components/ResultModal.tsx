import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Player, PlacedDisc } from '../types/game'

interface Props {
  show: boolean
  type: 'success' | 'skull' | 'win' | 'lose' | null
  challenger?: Player
  skullOwner?: Player
  lostDisc?: PlacedDisc
  onClose: () => void
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

export function ResultModal({ show, type, challenger, skullOwner, lostDisc, onClose }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!show) return
    if (type === 'success' || type === 'skull') {
      timerRef.current = setTimeout(onClose, 3200)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [show, type, onClose])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={type !== 'win' && type !== 'lose' ? onClose : undefined}
        >
          {(type === 'success' || type === 'win') && <Confetti />}

          {/* Skull hit – screen shake */}
          {type === 'skull' && (
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
                <div className="text-6xl mb-3">🌸</div>
                <h2 className="text-2xl font-bold text-emerald-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                  チャレンジ成功！
                </h2>
                <p className="text-white/70" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {challenger?.player_name} が勝利点を獲得
                </p>
              </>
            )}

            {/* SKULL HIT */}
            {type === 'skull' && (
              <>
                <div className="text-6xl mb-3 animate-bounce">💀</div>
                <h2 className="text-2xl font-bold text-red-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                  ドクロを踏んだ！
                </h2>
                <p className="text-white/70 mb-3" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {skullOwner?.player_name} のドクロに触れてしまった
                </p>
                {lostDisc && (
                  <div className="bg-red-950/50 border border-red-500/30 rounded-xl p-3 text-sm text-red-300">
                    {challenger?.player_name} はランダムにカードを1枚失う
                  </div>
                )}
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
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-400 rounded-xl text-black font-bold"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  ホームへ
                </button>
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
                <button
                  onClick={onClose}
                  className="w-full py-3 border border-white/20 rounded-xl text-white/70"
                >
                  ホームへ
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
