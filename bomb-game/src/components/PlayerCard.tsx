import { motion, AnimatePresence } from 'framer-motion'
import type { Player, GameState, PlacedDisc, EmoteType } from '../types/game'
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
  permCards?: { flowers: number; bombs: number }
  emote?: { type: EmoteType; sentAt: string } | null
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

function EmoteBubble({ emote }: { emote: { type: EmoteType; sentAt: string } }) {
  return (
    <AnimatePresence>
      <motion.div
        key={emote.sentAt}
        className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        initial={{ opacity: 0, y: 8, scale: 0.7 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <div className="relative bg-white rounded-2xl px-3 py-1.5 shadow-lg shadow-black/50 flex items-center justify-center">
          <span className="text-2xl leading-none select-none">
            {emote.type === 'BOMB' ? '💣' : '🍎'}
          </span>
          {/* Tail */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0
            border-l-[7px] border-r-[7px] border-t-[9px]
            border-l-transparent border-r-transparent border-t-white" />
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export function PlayerCard({
  player, gameState, discs, isCurrentTurn, isMyTurnToFlip, challengerId, onFlip,
  compact = false, hasFolded = false, permCards, emote,
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
  const permTotal = permCards ? permCards.flowers + permCards.bombs : null
  const liveTotal = (player.flower_count ?? 0) + (player.bomb_count ?? 0) + playerDiscs.length
  const totalCards = player.is_eliminated ? 0
    : (permTotal !== null && permTotal > 0) ? permTotal
    : liveTotal

  if (compact) {
    return (
      <div className="relative">
        {emote && <EmoteBubble emote={emote} />}
        <motion.div
          className={`relative bg-gray-900/80 backdrop-blur rounded-xl border border-white/10 overflow-hidden
            ${isCurrentTurn ? `ring-2 ${ringClass} shadow-lg` : ''}
            ${player.is_eliminated || hasFolded ? 'opacity-50' : ''}
          `}
          animate={isCurrentTurn ? { scale: [1, 1.015, 1] } : { scale: 1 }}
          transition={{ duration: 1.5, repeat: isCurrentTurn ? Infinity : 0 }}
        >
          {isCurrentTurn && (
            <div className="bg-amber-400 text-black text-xs text-center py-0.5 font-bold">
              ▼ 手番
            </div>
          )}

          <div className="flex items-center gap-2 p-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                <span className="text-white text-xs font-medium truncate" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {player.player_name}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mb-1">
                <div className="flex gap-0.5">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < player.win_count ? 'opacity-100' : 'opacity-20'}`}>⭐</span>
                  ))}
                </div>
                <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded-full">
                  残{totalCards}枚
                </span>
              </div>

              {hasFolded ? (
                <span className="text-xs bg-gray-700 text-white/60 px-1.5 py-0.5 rounded-full">パス</span>
              ) : isHighestBidder && (phase === 'bid' || phase === 'flip') ? (
                <span className="text-xs bg-amber-800 text-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                  {highestBid}枚宣言
                </span>
              ) : isChallenger && phase === 'flip' ? (
                <span className="text-xs bg-purple-800 text-purple-200 px-1.5 py-0.5 rounded-full">挑戦中</span>
              ) : null}
            </div>

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
      </div>
    )
  }

  return (
    <div className="relative">
      {emote && <EmoteBubble emote={emote} />}
      <motion.div
        className={`relative bg-gray-900/80 backdrop-blur rounded-xl border border-white/10 overflow-hidden
          ${isCurrentTurn ? `ring-2 ${ringClass} shadow-lg` : ''}
          ${player.is_eliminated ? 'opacity-40' : ''}
        `}
        animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : { scale: 1 }}
        transition={{ duration: 1.5, repeat: isCurrentTurn ? Infinity : 0 }}
      >
        {isCurrentTurn && (
          <div className="bg-amber-400 text-black text-xs text-center py-0.5 font-bold">
            ▼ 手番
          </div>
        )}

        <div className="flex items-start gap-2 p-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
              <span className="text-white text-sm font-medium truncate" style={{ fontFamily: 'Crimson Text, serif' }}>
                {player.player_name}
                {player.is_cpu && <span className="ml-1 text-white/40 text-xs">CPU</span>}
              </span>
            </div>
            <div className="flex gap-0.5 mb-1">
              {Array.from({ length: 2 }).map((_, i) => (
                <span key={i} className={`text-sm ${i < player.win_count ? 'opacity-100' : 'opacity-20'}`}>⭐</span>
              ))}
            </div>
            {isHighestBidder && (phase === 'bid' || phase === 'flip') && (
              <span className="text-xs bg-amber-800 text-amber-200 px-1.5 py-0.5 rounded-full font-bold inline-block mb-1">
                {highestBid}枚宣言
              </span>
            )}
            <div className="flex gap-1 text-xs text-white/50">
              <span>🍎×{player.flower_count}</span>
              <span>💣×{player.bomb_count}</span>
            </div>
          </div>
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
    </div>
  )
}
