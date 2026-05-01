import { motion } from 'framer-motion'
import type { Player, GameState, PlacedDisc } from '../types/game'
import { DiscStack } from './DiscStack'

interface Props {
  player: Player
  gameState: GameState | null
  discs: PlacedDisc[]
  isCurrentTurn: boolean
  isMyTurnToFlip: boolean
  challengerId: string | null
  onFlip?: (discId: string) => void
  compact?: boolean
}

const COLOR_RING: Record<string, string> = {
  red:    'ring-red-500 shadow-red-500/30',
  blue:   'ring-blue-500 shadow-blue-500/30',
  green:  'ring-emerald-500 shadow-emerald-500/30',
  yellow: 'ring-yellow-500 shadow-yellow-500/30',
  purple: 'ring-purple-500 shadow-purple-500/30',
  pink:   'ring-pink-500 shadow-pink-500/30',
}

const COLOR_DOT: Record<string, string> = {
  red:    'bg-red-500',
  blue:   'bg-blue-500',
  green:  'bg-emerald-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink:   'bg-pink-500',
}

export function PlayerCard({
  player, gameState, discs, isCurrentTurn, isMyTurnToFlip, challengerId, onFlip, compact = false,
}: Props) {
  const ringClass = COLOR_RING[player.player_color] ?? COLOR_RING.purple
  const dotClass = COLOR_DOT[player.player_color] ?? COLOR_DOT.purple
  const round = gameState?.round_number ?? 1
  const playerDiscs = discs.filter(d => d.player_id === player.id && d.round_number === round)
  const isChallenger = player.id === challengerId
  const isFlipPhase = gameState?.phase === 'flip'
  const myOwnStack = isChallenger && player.id === challengerId

  return (
    <motion.div
      className={`relative bg-gray-900/80 backdrop-blur rounded-xl p-3 border border-white/10
        ${isCurrentTurn ? `ring-2 ${ringClass} shadow-lg` : ''}
        ${player.is_eliminated ? 'opacity-40' : ''}
      `}
      animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 1.5, repeat: isCurrentTurn ? Infinity : 0 }}
    >
      {/* Current turn indicator */}
      {isCurrentTurn && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-xs px-2 py-0.5 rounded-full font-bold">
          ▼ 手番
        </div>
      )}

      <div className="flex items-start gap-2">
        {/* Color dot + name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
            <span className="text-white text-sm font-medium truncate" style={{ fontFamily: 'Crimson Text, serif' }}>
              {player.player_name}
              {player.is_cpu && <span className="ml-1 text-white/40 text-xs">CPU</span>}
            </span>
          </div>

          {/* Win count (flowers) */}
          <div className="flex gap-0.5 mb-1">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i} className={`text-sm ${i < player.win_count ? 'opacity-100' : 'opacity-20'}`}>
                🌸
              </span>
            ))}
          </div>

          {/* Hand remaining */}
          {!compact && (
            <div className="flex gap-1 text-xs text-white/50">
              <span>花×{player.flower_count}</span>
              <span>💀×{player.skull_count}</span>
            </div>
          )}
        </div>

        {/* Disc stack */}
        {!player.is_eliminated && (
          <DiscStack
            player={player}
            discs={playerDiscs}
            isFlipPhase={isFlipPhase}
            isMyTurnToFlip={isMyTurnToFlip}
            myOwnStack={myOwnStack}
            onFlip={onFlip}
          />
        )}
      </div>

      {player.is_eliminated && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
          <span className="text-white/60 text-sm">脱落</span>
        </div>
      )}
    </motion.div>
  )
}
