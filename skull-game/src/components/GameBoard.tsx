import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { PlayerCard } from './PlayerCard'
import { BidController } from './BidController'
import { ActionLog } from './ActionLog'
import { ResultModal } from './ResultModal'
import { canFold, getTotalDiscsInPlay } from '../lib/gameEngine'
import type { LogEntry } from './ActionLog'
import type { Player, PlacedDisc } from '../types/game'

const PHASE_LABEL: Record<string, string> = {
  place: '配置',
  bid:   '入札',
  flip:  'めくり',
}

interface Props {
  onGameEnd?: () => void
}

export function GameBoard({ onGameEnd }: Props) {
  const {
    room, players, gameState, myDiscs, publicDiscs,
    sessionId, isLoading, placeDisc, placeBid, fold, flipDisc,
    advanceAfterChallenge, resetGame, _foldedPlayerIds, _permCards,
  } = useGameStore()

  const isFlippingRef = useRef(false)

  const [log, setLog] = useState<LogEntry[]>([])
  const [modal, setModal] = useState<{
    show: boolean
    type: 'success' | 'skull' | 'win' | 'lose' | null
    challenger?: Player
    skullOwner?: Player
    lostDisc?: PlacedDisc
  }>({ show: false, type: null })

  const myPlayer = players.find(p => p.session_id === sessionId)
  const otherPlayers = players.filter(p => p.session_id !== sessionId)
  const isMyTurn = gameState?.current_player_id === myPlayer?.id
  const phase = gameState?.phase ?? 'place'
  const round = gameState?.round_number ?? 1
  const highestBid = gameState?.highest_bid ?? 0
  const challengerId = gameState?.highest_bidder_id ?? null
  const isChallenger = myPlayer?.id === challengerId
  const totalDiscs = getTotalDiscsInPlay(players, publicDiscs, round)

  function addLog(message: string, type: LogEntry['type']) {
    setLog(prev => [
      { id: crypto.randomUUID(), message, type, timestamp: Date.now() },
      ...prev,
    ].slice(0, 20))
  }

  const handlePlaceFlower = useCallback(async () => {
    await placeDisc('flower')
    addLog(`${myPlayer?.player_name} が花を置いた`, 'place')
  }, [placeDisc, myPlayer])

  const handlePlaceSkull = useCallback(async () => {
    await placeDisc('skull')
    addLog(`${myPlayer?.player_name} がカードを置いた`, 'place')
  }, [placeDisc, myPlayer])

  const handleBid = useCallback(async (amount: number) => {
    await placeBid(amount)
    addLog(`${myPlayer?.player_name} が ${amount} 枚と宣言`, 'bid')
  }, [placeBid, myPlayer])

  const handleFold = useCallback(async () => {
    await fold()
    addLog(`${myPlayer?.player_name} がパス`, 'fold')
  }, [fold, myPlayer])

  const handleFlip = useCallback(async (discId: string) => {
    if (!myPlayer || !gameState) return
    if (isFlippingRef.current) return  // prevent double-tap
    isFlippingRef.current = true

    const allDiscs = [...myDiscs, ...publicDiscs]
    const disc = allDiscs.find(d => d.id === discId)
    const owner = players.find(p => disc && p.id === disc.player_id)
    await flipDisc(discId)

    // Use fresh store state to get updated disc type
    const { publicDiscs: freshPublic, myDiscs: freshMy } = useGameStore.getState()
    const freshDisc = [...freshMy, ...freshPublic].find(d => d.id === discId)
    const realType = freshDisc?.disc_type
    const freshFlipCount = useGameStore.getState().gameState?.flip_count ?? 0

    if (realType === 'skull') {
      addLog(`💀 ${myPlayer.player_name} が ${owner?.player_name} のドクロを踏んだ！`, 'result')
      setModal({ show: true, type: 'skull', challenger: myPlayer, skullOwner: owner, lostDisc: freshDisc })
    } else {
      addLog(`🌸 ${myPlayer.player_name} が花をめくった`, 'flip')
      if (freshFlipCount >= highestBid) {
        const freshPlayer = useGameStore.getState().players.find(p => p.id === myPlayer.id)
        if (freshPlayer && freshPlayer.win_count + 1 >= 2) {
          setModal({ show: true, type: 'win', challenger: myPlayer })
        } else {
          setModal({ show: true, type: 'success', challenger: myPlayer })
        }
        addLog(`🎉 チャレンジ成功！`, 'result')
      }
    }

    isFlippingRef.current = false
  }, [myPlayer, gameState, flipDisc, myDiscs, publicDiscs, players, highestBid])

  const myRoundDiscs = publicDiscs.filter(d => d.player_id === myPlayer?.id && d.round_number === round)
  const myUnflipped = myRoundDiscs.filter(d => !d.is_flipped)
  const isMyTurnToFlip = isMyTurn && phase === 'flip' && isChallenger

  function getGuideText() {
    if (!isMyTurn) {
      const current = players.find(p => p.id === gameState?.current_player_id)
      return `${current?.player_name ?? '...'} の手番`
    }
    if (phase === 'place') return '花かドクロを置いてください'
    if (phase === 'bid') return highestBid === 0 ? '入札を開始' : '入札かパス'
    if (phase === 'flip') return myUnflipped.length > 0 ? '自分のスタックから先にめくる' : 'スタックをめくる'
    return ''
  }

  const canFoldNow = myPlayer && gameState ? canFold(myPlayer, gameState) : false

  if (!gameState || !myPlayer) return null

  return (
    <div
      className="h-svh flex flex-col overflow-hidden bg-gray-950 text-white"
      style={{ fontFamily: 'Crimson Text, serif' }}
    >
      <ActionLog entries={log} />

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-gray-900/90 backdrop-blur border-b border-white/10 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">R{round}</span>
          <span className="text-amber-400 text-sm font-semibold" style={{ fontFamily: 'Cinzel, serif' }}>
            {PHASE_LABEL[phase]}
          </span>
        </div>
        <div className="text-xs text-white/30 tracking-widest" style={{ fontFamily: 'Cinzel, serif' }}>
          {room?.room_code}
        </div>
        <div>
          {highestBid > 0 && (
            <span className="text-amber-400 font-bold text-sm" style={{ fontFamily: 'Cinzel, serif' }}>
              最高 {highestBid}枚
            </span>
          )}
        </div>
      </header>

      {/* ── Center: guide text + opponents ── */}
      <div className="flex-1 flex flex-col justify-center px-2 gap-3 min-h-0">
        {/* Guide text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={getGuideText()}
            className="text-white/50 text-center text-sm italic"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
          >
            {getGuideText()}
          </motion.p>
        </AnimatePresence>

        {/* Opponents */}
        <div className="grid grid-cols-2 gap-1.5">
          {otherPlayers.map(p => (
            <PlayerCard
              key={p.id}
              player={p}
              gameState={gameState}
              discs={publicDiscs.filter(d => d.player_id === p.id && d.round_number === round)}
              isCurrentTurn={gameState.current_player_id === p.id}
              isMyTurnToFlip={isMyTurnToFlip && myUnflipped.length === 0}
              challengerId={challengerId}
              onFlip={handleFlip}
              compact
              hasFolded={_foldedPlayerIds.includes(p.id)}
              permCards={_permCards[p.id]}
            />
          ))}
        </div>
      </div>

      {/* ── My area ── */}
      <div
        className="flex-shrink-0 bg-gray-900/70 backdrop-blur border-t border-white/10 px-3 pt-2 space-y-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {/* My card + hand */}
        <div className="flex items-center gap-3">
          <PlayerCard
            player={myPlayer}
            gameState={gameState}
            discs={myDiscs.filter(d => d.round_number === round)}
            isCurrentTurn={isMyTurn}
            isMyTurnToFlip={isMyTurnToFlip}
            challengerId={challengerId}
            onFlip={handleFlip}
          />
          <div className="flex-1">
            <p className="text-white/40 text-xs mb-1">手札</p>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: myPlayer.flower_count }).map((_, i) => (
                <span key={`f-${i}`} className="text-xl leading-none">🌸</span>
              ))}
              {Array.from({ length: myPlayer.skull_count }).map((_, i) => (
                <span key={`s-${i}`} className="text-xl leading-none">💀</span>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-0.5">
              {myPlayer.flower_count + myPlayer.skull_count}枚残り
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <AnimatePresence mode="wait">
          {isMyTurn && (
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-1.5"
            >
              {phase === 'place' && (
                <div className="flex gap-2">
                  <motion.button
                    onClick={handlePlaceFlower}
                    disabled={isLoading || myPlayer.flower_count === 0}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-600 text-white font-bold disabled:opacity-40 text-sm"
                    whileTap={{ scale: 0.96 }}
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    🌸 花を置く
                  </motion.button>
                  <motion.button
                    onClick={handlePlaceSkull}
                    disabled={isLoading || myPlayer.skull_count === 0}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gray-700 to-gray-600 text-white font-bold disabled:opacity-40 text-sm"
                    whileTap={{ scale: 0.96 }}
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    💀 ドクロ
                  </motion.button>
                </div>
              )}

              {(phase === 'bid' || (phase === 'place' && totalDiscs > 0)) && (
                <BidController
                  currentHighest={highestBid}
                  totalDiscs={totalDiscs}
                  onBid={handleBid}
                  onFold={handleFold}
                  canFold={canFoldNow}
                  isLoading={isLoading}
                />
              )}

              {phase === 'flip' && myUnflipped.length > 0 && (
                <div className="text-center text-amber-400/80 text-xs py-1.5 border border-amber-500/20 rounded-xl bg-amber-950/30">
                  ⬆ 自分のスタックをタップしてめくる
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ResultModal
        show={modal.show}
        type={modal.type}
        challenger={modal.challenger}
        skullOwner={modal.skullOwner}
        lostDisc={modal.lostDisc}
        onClose={async () => {
          const type = modal.type
          const skullOwnerId = modal.skullOwner?.id
          setModal({ show: false, type: null })
          if (type === 'win' || type === 'lose') {
            resetGame()
            onGameEnd?.()
          } else if (type === 'success') {
            await advanceAfterChallenge('win')
          } else if (type === 'skull') {
            await advanceAfterChallenge('loss', skullOwnerId)
          }
        }}
      />
    </div>
  )
}
