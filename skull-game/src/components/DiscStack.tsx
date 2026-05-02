import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PlacedDisc, Player } from '../types/game'

interface Props {
  player: Player
  discs: PlacedDisc[]
  isFlipPhase: boolean
  isMyTurnToFlip: boolean
  myOwnStack: boolean       // true if this is the challenger's own stack (must flip first)
  onFlip?: (discId: string) => void
}

const COLOR_MAP: Record<string, string> = {
  red:    'from-red-900 to-red-700 border-red-500',
  blue:   'from-blue-900 to-blue-700 border-blue-500',
  green:  'from-emerald-900 to-emerald-700 border-emerald-500',
  yellow: 'from-yellow-900 to-yellow-700 border-yellow-500',
  purple: 'from-purple-900 to-purple-700 border-purple-500',
  pink:   'from-pink-900 to-pink-700 border-pink-500',
}

export function DiscStack({ player, discs, isFlipPhase, isMyTurnToFlip, myOwnStack, onFlip }: Props) {
  const tappingRef = useRef(false)
  const count = discs.length
  const topDisc = [...discs].sort((a, b) => b.position - a.position)[0]
  const colorClass = COLOR_MAP[player.player_color] ?? COLOR_MAP.purple
  const canTap = isFlipPhase && isMyTurnToFlip && count > 0

  function handleTap() {
    if (!canTap || !topDisc || topDisc.is_flipped) return
    if (tappingRef.current) return
    tappingRef.current = true
    setTimeout(() => { tappingRef.current = false }, 800)
    const unflipped = [...discs]
      .filter(d => !d.is_flipped)
      .sort((a, b) => b.position - a.position)
    if (unflipped[0]) onFlip?.(unflipped[0].id)
  }

  const unflippedCount = discs.filter(d => !d.is_flipped).length
  const flippedDiscs = discs.filter(d => d.is_flipped)

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Stack visual */}
      <div
        className={`relative ${canTap ? 'cursor-pointer' : ''}`}
        onClick={handleTap}
      >
        {/* Shadow layers for depth */}
        {unflippedCount >= 3 && (
          <div className={`absolute top-2 left-2 w-12 h-16 rounded-lg bg-gradient-to-br ${colorClass} border opacity-40`} />
        )}
        {unflippedCount >= 2 && (
          <div className={`absolute top-1 left-1 w-12 h-16 rounded-lg bg-gradient-to-br ${colorClass} border opacity-60`} />
        )}

        {unflippedCount > 0 ? (
          <motion.div
            className={`relative w-12 h-16 rounded-lg bg-gradient-to-br ${colorClass} border-2 flex items-center justify-center shadow-lg`}
            whileTap={canTap ? { scale: 0.95 } : {}}
            animate={canTap && myOwnStack ? { y: [0, -3, 0] } : {}}
            transition={{ repeat: canTap && myOwnStack ? Infinity : 0, duration: 1.2 }}
          >
            {/* Card back pattern */}
            <div className="w-8 h-12 rounded border border-white/20 flex items-center justify-center">
              <span className="text-white/40 text-lg">✦</span>
            </div>
            {canTap && (
              <div className="absolute inset-0 rounded-lg bg-white/10 animate-pulse" />
            )}
          </motion.div>
        ) : (
          <div className="w-12 h-16 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center">
            <span className="text-white/20 text-xs">空</span>
          </div>
        )}

        {/* Unflipped count badge */}
        {unflippedCount > 0 && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-xs font-bold text-black">
            {unflippedCount}
          </div>
        )}
      </div>

      {/* Revealed discs */}
      <AnimatePresence>
        {flippedDiscs.map(disc => (
          <motion.div
            key={disc.id}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            className={`w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-center text-2xl shadow-lg ${
              disc.disc_type === 'skull'
                ? 'bg-red-950 border-red-400 shadow-red-500/50'
                : 'bg-emerald-950 border-emerald-400 shadow-emerald-500/50'
            }`}
          >
            {disc.disc_type === 'skull' ? '💀' : '🌸'}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
