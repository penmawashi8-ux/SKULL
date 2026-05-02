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
  hasFolded?: boolean
  permCards?: { flowers: number; skulls: number }
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
  player, gameState, discs, isCurrentTurn, isMyTurnToFlip, challengerId, onFlip,
  compact = false, hasFolded = false, permCards,
}: Props) {
  const ringClass = COLOR_RING[player.player_color] ?? COLOR_RING.purple
  const dotClass = COLOR_DOT[player.player_color] ?? COLOR_DOT.purple
  const round = gameState?.round_number ?? 1
  const playerDiscs = discs.filter(d => d.player_id === player.id && d.round_number === round)
  const isChallenger = player.id === challengerId
  const isFlipPhase = gameState?.phase === 'flip'
  const myOwnStack = isChallenger && player.id === challengerId
  const highestBid = gameState?.highest_bid ?? 0
  const isHighestBidder = gameState?.highest_bidder_id === player.id
  const phase = gameState?.phase ?? 'place'

  // Total cards this player owns permanently
  const totalCards = permCards
    ? permCards.flowers + permCards.skulls
    : player.flower_count + player.skull_count + playerDiscs.length

  return (
    <motion.div
      className={`relative bg-gray-900/80 backdrop-blur rounded-xl border border-white/10
        ${compact ? 'p-2' : 'p-3'}
        ${isCurrentTurn ? `ring-2 ${ringClass} shadow-lg` : ''}
        ${player.is_eliminated || hasFolded ? 'opacity-50' : ''}
      `}
      animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 1.5, repeat: isCurrentTurn ? Infinity : 0 }}
    >
      {/* Turn indicator */}
      {isCurrentTurn && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
          ▼ 手番
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
            <span
              className="text-white text-xs font-medium truncate"
              style={{ fontFamily: 'Crimson Text, serif' }}
            >
              {player.player_name}
            </span>
          </div>

          {/* Win tokens */}
          <div className="flex gap-0.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i} className={`text-xs ${i < player.win_count ? 'opacity-100' : 'opacity-20'}`}>
                🌸
              </span>
            ))}
          </div>

          {compact && (
            <div className="mt-1 flex flex-wrap gap-1 items-center">
              {/* Card count */}
              <span className="text-white/50 text-xs">
                🃏{totalCards}
              </span>

              {/* Fold badge */}
              {hasFolded && (
                <span className="bg-gray-700/80 text-white/50 text-xs px-1.5 py-0.5 rounded-full">
                  パス
                </span>
              )}

              {/* Bid badge */}
              {isHighestBidder && (phase === 'bid' || phase === 'flip') && (
                <span className="bg-amber-700/80 text-amber-200 text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {highestBid}枚宣言
                </span>
              )}

              {/* Challenger badge */}
              {isChallenger && phase === 'flip' && (
                <span className="bg-purple-700/80 text-purple-200 text-xs px-1.5 py-0.5 rounded-full">
                  挑戦中
                </span>
              )}
            </div>
          )}

          {!compact && (
            <div className="flex gap-1 text-xs text-white/50 mt-1">
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
          <span className="text-white/60 text-xs">脱落</span>
        </div>
      )}
    </motion.div>
  )
}
