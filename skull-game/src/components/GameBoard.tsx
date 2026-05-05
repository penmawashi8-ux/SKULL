import { useState, useCallback, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { PlayerCard } from './PlayerCard'
import { BidController } from './BidController'
import { ActionLog } from './ActionLog'
import { ResultModal } from './ResultModal'
import { canFold, getTotalDiscsInPlay, getWinner } from '../lib/gameEngine'
import { playButtonPress, playFlowerFlip, playSkullFlip, playCardPlace, playSuccess, playFailure } from '../lib/sounds'
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
    advanceAfterChallenge, resetGame, resumeCpuTurns, _foldedPlayerIds, _permCards, _cpuLog,
  } = useGameStore()

  const actionLockRef = useRef(false)

  const [isActing, setIsActing] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [modal, setModal] = useState<{
    show: boolean
    type: 'success' | 'skull' | 'win' | 'lose' | null
    challenger?: Player
    skullOwner?: Player
    lostDisc?: PlacedDisc
  }>({ show: false, type: null })
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const myPlayer = players.find(p => p.session_id === sessionId)
  const otherPlayers = players.filter(p => p.session_id !== sessionId)
  const isMyTurn = gameState?.current_player_id === myPlayer?.id
  const phase = gameState?.phase ?? 'place'
  const round = gameState?.round_number ?? 1
  const highestBid = gameState?.highest_bid ?? 0
  const challengerId = gameState?.highest_bidder_id ?? null
  const isChallenger = myPlayer?.id === challengerId
  const totalDiscs = getTotalDiscsInPlay(players, publicDiscs, round)
  const allPlaced = players.filter(p => !p.is_eliminated).every(p =>
    publicDiscs.some(d => d.player_id === p.id && d.round_number === round)
  )
  const iHaveFolded = !!myPlayer && _foldedPlayerIds.includes(myPlayer.id)

  function addLog(message: string, type: LogEntry['type']) {
    setLog(prev => [
      { id: crypto.randomUUID(), message, type, timestamp: Date.now() },
      ...prev,
    ].slice(0, 20))
  }

  useEffect(() => {
    if (!_cpuLog) return
    addLog(_cpuLog.message, _cpuLog.type)
    if (_cpuLog.type === 'place') playCardPlace()
    else if (_cpuLog.type === 'flip') playFlowerFlip()
    else if (_cpuLog.type === 'result') {
      if (_cpuLog.message.includes('💀')) playFailure()
      else if (_cpuLog.message.includes('成功')) playSuccess()
    }
  }, [_cpuLog?.id])

  // Re-trigger CPU turns when page comes back from background
  useEffect(() => {
    function handleVisibility() {
      if (!document.hidden) resumeCpuTurns()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [resumeCpuTurns])

  // Detect CPU win (by 2 rounds or last-player-standing) and show modal
  useEffect(() => {
    if (!gameState || modal.show) return
    const winner = getWinner(players)
    if (!winner) return
    if (winner.session_id === sessionId) {
      setModal({ show: true, type: 'win', challenger: winner })
    } else {
      setModal({ show: true, type: 'lose', challenger: winner })
    }
  }, [players, modal.show])

  const handlePlaceFlower = useCallback(async () => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    try {
      flushSync(() => setIsActing(true))
      playCardPlace()
      await placeDisc('flower')
      addLog(`${myPlayer?.player_name} が花を置いた`, 'place')
    } finally {
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [placeDisc, myPlayer])

  const handlePlaceSkull = useCallback(async () => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    try {
      flushSync(() => setIsActing(true))
      playCardPlace()
      await placeDisc('skull')
      addLog(`${myPlayer?.player_name} がカードを置いた`, 'place')
    } finally {
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [placeDisc, myPlayer])

  const handleBid = useCallback(async (amount: number) => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    try {
      flushSync(() => setIsActing(true))
      playButtonPress()
      await placeBid(amount)
      addLog(`${myPlayer?.player_name} が ${amount} 枚と宣言`, 'bid')
    } finally {
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [placeBid, myPlayer])

  const handleFold = useCallback(async () => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    try {
      flushSync(() => setIsActing(true))
      playButtonPress()
      await fold()
      addLog(`${myPlayer?.player_name} がパス`, 'fold')
    } finally {
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [fold, myPlayer])

  const handleFlip = useCallback(async (discId: string) => {
    if (!myPlayer || !gameState) return
    if (actionLockRef.current) return
    actionLockRef.current = true
    setIsActing(true)

    const disc = [...myDiscs, ...publicDiscs].find(d => d.id === discId)
    const owner = players.find(p => disc && p.id === disc.player_id)

    const realType = await flipDisc(discId)
    const freshState = useGameStore.getState()
    const freshFlipCount = freshState.gameState?.flip_count ?? 0
    const freshHighestBid = freshState.gameState?.highest_bid ?? highestBid

    if (realType === 'skull') {
      playSkullFlip()
      playFailure()
      addLog(`💀 ${myPlayer.player_name} が ${owner?.player_name} のドクロを踏んだ！`, 'result')
      const freshDisc = [...freshState.myDiscs, ...freshState.publicDiscs].find(d => d.id === discId)
      await new Promise(r => setTimeout(r, 500))
      setModal({ show: true, type: 'skull', challenger: myPlayer, skullOwner: owner, lostDisc: freshDisc })
      // lock + isActing stay set until onClose
    } else {
      playFlowerFlip()
      addLog(`🌸 ${myPlayer.player_name} が花をめくった`, 'flip')
      if (freshFlipCount >= freshHighestBid) {
        addLog(`🎉 チャレンジ成功！`, 'result')
        playSuccess()
        await new Promise(r => setTimeout(r, 700))
        const freshPlayer = freshState.players.find(p => p.id === myPlayer.id)
        if (freshPlayer && freshPlayer.win_count + 1 >= 2) {
          setModal({ show: true, type: 'win', challenger: myPlayer })
        } else {
          setModal({ show: true, type: 'success', challenger: myPlayer })
        }
        // lock + isActing stay set until onClose
      } else {
        actionLockRef.current = false
        setIsActing(false)  // normal flower, next tap allowed
      }
    }
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
      className="h-full flex flex-col overflow-hidden bg-gray-950 text-white"
      style={{ fontFamily: 'Crimson Text, serif' }}
    >
      <ActionLog entries={log} />

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-gray-900/90 backdrop-blur border-b border-white/10 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="text-white/40 hover:text-white/70 transition-colors text-xs px-1.5 py-1 rounded"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            ✕
          </button>
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
                    disabled={isLoading || isActing || myPlayer.flower_count === 0}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-600 text-white font-bold disabled:opacity-40 text-sm"
                    whileTap={!isActing ? { scale: 0.96 } : {}}
                    style={{ fontFamily: 'Cinzel, serif', touchAction: 'manipulation', pointerEvents: (isLoading || isActing) ? 'none' : 'auto' }}
                  >
                    🌸 花を置く
                  </motion.button>
                  <motion.button
                    onClick={handlePlaceSkull}
                    disabled={isLoading || isActing || myPlayer.skull_count === 0}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gray-700 to-gray-600 text-white font-bold disabled:opacity-40 text-sm"
                    whileTap={!isActing ? { scale: 0.96 } : {}}
                    style={{ fontFamily: 'Cinzel, serif', touchAction: 'manipulation', pointerEvents: (isLoading || isActing) ? 'none' : 'auto' }}
                  >
                    💀 ドクロ
                  </motion.button>
                </div>
              )}

              {(phase === 'bid' || (phase === 'place' && myRoundDiscs.length > 0 && allPlaced))
                && !iHaveFolded && (
                <BidController
                  currentHighest={highestBid}
                  totalDiscs={totalDiscs}
                  onBid={handleBid}
                  onFold={handleFold}
                  canFold={canFoldNow}
                  isLoading={isLoading || isActing}
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

      {/* ── Exit confirmation dialog ── */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-xs text-center shadow-2xl"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <div className="text-4xl mb-3">🚪</div>
              <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                ゲームを終了しますか？
              </h2>
              <p className="text-white/50 text-sm mb-5" style={{ fontFamily: 'Crimson Text, serif' }}>
                進行中のゲームが終了します
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 text-sm"
                  style={{ fontFamily: 'Crimson Text, serif' }}
                >
                  キャンセル
                </button>
                <button
                  onClick={() => { resetGame(); onGameEnd?.() }}
                  className="flex-1 py-3 rounded-xl bg-red-900/60 border border-red-500/40 text-red-300 text-sm font-bold"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  終了する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ResultModal
        show={modal.show}
        type={modal.type}
        challenger={modal.challenger}
        skullOwner={modal.skullOwner}
        lostDisc={modal.lostDisc}
        onClose={async () => {
          const type = modal.type
          const skullOwnerId = modal.skullOwner?.id
          actionLockRef.current = false
          setIsActing(false)
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
