import { useState, useCallback } from 'react'
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
  place: '配置フェーズ',
  bid:   '入札フェーズ',
  flip:  'めくりフェーズ',
}

interface Props {
  onGameEnd?: () => void
}

export function GameBoard({ onGameEnd }: Props) {
  const {
    room, players, gameState, myDiscs, publicDiscs,
    sessionId, isLoading, placeDisc, placeBid, fold, flipDisc,
    resetGame,
  } = useGameStore()

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
    const allDiscs = [...myDiscs, ...publicDiscs]
    const disc = allDiscs.find(d => d.id === discId)
    const owner = players.find(p => disc && p.id === disc.player_id)
    await flipDisc(discId)

    // Check result after state update
    const freshDisc = [...myDiscs, ...publicDiscs].find(d => d.id === discId)
    const realType = freshDisc?.disc_type

    if (realType === 'skull') {
      addLog(`💀 ${myPlayer.player_name} が ${owner?.player_name} のドクロを踏んだ！`, 'result')
      setModal({ show: true, type: 'skull', challenger: myPlayer, skullOwner: owner, lostDisc: freshDisc })
    } else {
      addLog(`🌸 ${myPlayer.player_name} が花をめくった`, 'flip')
      const newFlipCount = (gameState.flip_count ?? 0) + 1
      if (newFlipCount >= highestBid) {
        const updatedPlayer = players.find(p => p.id === myPlayer.id)
        if (updatedPlayer && updatedPlayer.win_count + 1 >= 2) {
          setModal({ show: true, type: 'win', challenger: myPlayer })
        } else {
          setModal({ show: true, type: 'success', challenger: myPlayer })
        }
        addLog(`🎉 チャレンジ成功！`, 'result')
      }
    }
  }, [myPlayer, gameState, flipDisc, myDiscs, publicDiscs, players, highestBid])

  // Check if it's my turn to flip – challenger must flip own discs first
  const myRoundDiscs = publicDiscs.filter(d => d.player_id === myPlayer?.id && d.round_number === round)
  const myUnflipped = myRoundDiscs.filter(d => !d.is_flipped)
  const isMyTurnToFlip = isMyTurn && phase === 'flip' && isChallenger

  // Determine action guide text
  function getGuideText() {
    if (!isMyTurn) {
      const current = players.find(p => p.id === gameState?.current_player_id)
      return `${current?.player_name ?? '...'} の手番`
    }
    if (phase === 'place') return '花かドクロを1枚置いてください'
    if (phase === 'bid') {
      if (highestBid === 0) return '入札を開始するか、カードを追加で置けます'
      return '入札するかパスしてください'
    }
    if (phase === 'flip') {
      if (myUnflipped.length > 0) return '自分のスタックから先にめくってください'
      return '他のプレイヤーのスタックをめくってください'
    }
    return ''
  }

  const canFoldNow = myPlayer && gameState ? canFold(myPlayer, gameState) : false

  if (!gameState || !myPlayer) return null

  return (
    <div
      className="min-h-screen bg-gray-950 text-white flex flex-col"
      style={{ fontFamily: 'Crimson Text, serif' }}
    >
      <ActionLog entries={log} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-gray-900/80 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white/40 text-xs">ROUND</p>
          <p className="text-white font-bold text-lg" style={{ fontFamily: 'Cinzel, serif' }}>{round}</p>
        </div>
        <div className="text-center">
          <p className="text-amber-400 font-semibold text-sm" style={{ fontFamily: 'Cinzel, serif' }}>
            {PHASE_LABEL[phase]}
          </p>
          {room?.room_code && (
            <p className="text-white/30 text-xs tracking-widest">{room.room_code}</p>
          )}
        </div>
        <div className="text-right">
          {highestBid > 0 && (
            <>
              <p className="text-white/40 text-xs">最高入札</p>
              <p className="text-amber-400 font-bold text-lg" style={{ fontFamily: 'Cinzel, serif' }}>
                {highestBid}
              </p>
            </>
          )}
        </div>
      </header>

      {/* ── Opponents ──────────────────────────────────────────────────── */}
      <div className="p-3 grid grid-cols-2 gap-2">
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
          />
        ))}
      </div>

      {/* ── Center guide ───────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={getGuideText()}
            className="text-white/60 text-center text-base italic"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {getGuideText()}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── My area ────────────────────────────────────────────────────── */}
      <div className="bg-gray-900/60 backdrop-blur border-t border-white/10 p-4 space-y-4">
        {/* My disc stack + hand */}
        <div className="flex items-end gap-4">
          <PlayerCard
            player={myPlayer}
            gameState={gameState}
            discs={myDiscs.filter(d => d.round_number === round)}
            isCurrentTurn={isMyTurn}
            isMyTurnToFlip={isMyTurnToFlip}
            challengerId={challengerId}
            onFlip={handleFlip}
          />

          {/* Hand cards */}
          <div className="flex-1 space-y-1">
            <p className="text-white/40 text-xs">手札</p>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: myPlayer.flower_count }).map((_, i) => (
                <motion.span
                  key={`flower-${i}`}
                  className="text-2xl"
                  whileHover={{ scale: 1.2 }}
                >
                  🌸
                </motion.span>
              ))}
              {Array.from({ length: myPlayer.skull_count }).map((_, i) => (
                <motion.span
                  key={`skull-${i}`}
                  className="text-2xl"
                  whileHover={{ scale: 1.2 }}
                >
                  💀
                </motion.span>
              ))}
            </div>
            <p className="text-white/30 text-xs">
              {myPlayer.flower_count + myPlayer.skull_count} 枚残り
            </p>
          </div>
        </div>

        {/* ── Action buttons ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {isMyTurn && (
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="space-y-2"
            >
              {/* PLACE phase */}
              {phase === 'place' && (
                <div className="flex gap-2">
                  <motion.button
                    onClick={handlePlaceFlower}
                    disabled={isLoading || myPlayer.flower_count === 0}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-600 text-white font-bold disabled:opacity-40 shadow-lg"
                    whileTap={{ scale: 0.96 }}
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    🌸 花を置く
                  </motion.button>
                  <motion.button
                    onClick={handlePlaceSkull}
                    disabled={isLoading || myPlayer.skull_count === 0}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-gray-800 to-gray-600 text-white font-bold disabled:opacity-40 shadow-lg"
                    whileTap={{ scale: 0.96 }}
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    💀 ドクロを置く
                  </motion.button>
                </div>
              )}

              {/* BID phase or start bid from place phase */}
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

              {/* FLIP phase – own stack hint */}
              {phase === 'flip' && myUnflipped.length > 0 && (
                <div className="text-center text-amber-400/80 text-sm py-2 border border-amber-500/20 rounded-xl bg-amber-950/30">
                  ⬆ 自分のスタックをタップしてめくる
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Result modal */}
      <ResultModal
        show={modal.show}
        type={modal.type}
        challenger={modal.challenger}
        skullOwner={modal.skullOwner}
        lostDisc={modal.lostDisc}
        onClose={() => {
          if (modal.type === 'win' || modal.type === 'lose') {
            resetGame()
            onGameEnd?.()
          }
          setModal({ show: false, type: null })
        }}
      />
    </div>
  )
}
