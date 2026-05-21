import { useState, useCallback, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { PlayerCard } from './PlayerCard'
import { BidController } from './BidController'
import { ActionLog } from './ActionLog'
import { ResultModal } from './ResultModal'
import { canFold, getTotalDiscsInPlay, getWinner } from '../lib/gameEngine'
import { playFlowerFlip, playBombFlip, playCardPlace, playSuccess, playFailure, playBid, playFold } from '../lib/sounds'
import type { LogEntry } from './ActionLog'
import type { Player, PlacedDisc } from '../types/game'

const PHASE_LABEL: Record<string, string> = {
  place: '配置',
  bid:   '入札',
  flip:  'めくり',
}

const TURN_TIME_LIMIT_SEC = 30

interface Props {
  onGameEnd?: () => void
  onReturnToHub?: () => void
}

// ── TurnTimer ────────────────────────────────────────────────────────────────
function TurnTimer({ timeLeft }: { timeLeft: number }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const progress = timeLeft / TURN_TIME_LIMIT_SEC
  const dashOffset = circumference * (1 - progress)
  const isUrgent = timeLeft <= 10

  return (
    <div className={`relative w-12 h-12 flex items-center justify-center ${isUrgent ? 'animate-pulse' : ''}`}>
      <svg className="absolute inset-0 -rotate-90" width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke={isUrgent ? '#ef4444' : '#a78bfa'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
        />
      </svg>
      <span
        className={`text-sm font-bold z-10 ${isUrgent ? 'text-red-400' : 'text-white/70'}`}
        style={{ fontFamily: 'Cinzel, serif' }}
      >
        {timeLeft}
      </span>
    </div>
  )
}

// ── TimeoutToast ─────────────────────────────────────────────────────────────
function TimeoutToast({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500/50 backdrop-blur-sm px-4 py-2 rounded-xl text-sm text-red-200 shadow-xl"
          style={{ top: 'calc(env(safe-area-inset-top) + 56px)', fontFamily: 'Crimson Text, serif' }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          ⏰ 時間切れ！ランダム行動が実行されました
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function GameBoard({ onGameEnd, onReturnToHub }: Props) {
  const {
    room, players, gameState, myDiscs, publicDiscs,
    sessionId, isLoading, placeDisc, placeBid, fold, flipDisc,
    advanceAfterChallenge, resetGame, resumeCpuTurns, _foldedPlayerIds, _permCards, _cpuLog,
    sendEmote,
  } = useGameStore()

  const actionLockRef = useRef(false)
  const placedRef = useRef(false)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoActedRef = useRef(false)

  const [isActing, setIsActing] = useState(false)
  const [hasPlacedThisTurn, setHasPlacedThisTurn] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [modal, setModal] = useState<{
    show: boolean
    type: 'success' | 'bomb' | 'win' | 'lose' | null
    challenger?: Player
    bombOwner?: Player
    lostDisc?: PlacedDisc
  }>({ show: false, type: null })
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TURN_TIME_LIMIT_SEC)
  const [showTimeoutToast, setShowTimeoutToast] = useState(false)
  const [showEmoteButtons, setShowEmoteButtons] = useState(false)
  const emoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [displayedEmote, setDisplayedEmote] = useState<{ playerId: string; type: string; sentAt: string } | null>(null)
  const emoteDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const myPlayer = players.find(p => p.session_id === sessionId)
  const otherPlayers = players
    .filter(p => p.session_id !== sessionId)
    .sort((a, b) => a.seat_order - b.seat_order)
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
    setHasPlacedThisTurn(false)
  }, [gameState?.current_player_id, gameState?.round_number, gameState?.phase])

  useEffect(() => {
    if (!_cpuLog) return
    addLog(_cpuLog.message, _cpuLog.type)
    if (_cpuLog.type === 'place') playCardPlace()
    else if (_cpuLog.type === 'bid') playBid()
    else if (_cpuLog.type === 'fold') playFold()
    else if (_cpuLog.type === 'flip') playFlowerFlip()
    else if (_cpuLog.type === 'result') {
      if (_cpuLog.message.includes('💣')) playFailure()
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

  // Release place-action lock once the turn or phase moves away from place
  useEffect(() => {
    if (placedRef.current && (!isMyTurn || phase !== 'place')) {
      placedRef.current = false
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [isMyTurn, phase])

  // Detect win/loss and show modal
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

  // ── Turn timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMyTurn || (phase === 'flip' && !isChallenger) || modal.show) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      setTimeLeft(TURN_TIME_LIMIT_SEC)
      autoActedRef.current = false
      return
    }

    autoActedRef.current = false

    const startTime = gameState?.turn_started_at
      ? new Date(gameState.turn_started_at).getTime()
      : Date.now()

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const remaining = Math.max(0, TURN_TIME_LIMIT_SEC - elapsed)
      setTimeLeft(remaining)
      if (remaining === 0 && !autoActedRef.current) {
        autoActedRef.current = true
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = null
        }
        triggerAutoAction()
      }
    }

    tick()
    timerIntervalRef.current = setInterval(tick, 1000)

    // ページ復帰時にタイマーが止まっていたら再評価
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        autoActedRef.current = false
        tick()
        if (!timerIntervalRef.current) {
          timerIntervalRef.current = setInterval(tick, 1000)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.current_player_id, gameState?.turn_started_at, isMyTurn, phase, modal.show])

  const handlePlaceFlower = useCallback(async () => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    placedRef.current = true
    try {
      flushSync(() => { setIsActing(true); setHasPlacedThisTurn(true) })
      playCardPlace()
      await placeDisc('flower')
      addLog(`${myPlayer?.player_name} が🍎を置いた`, 'place')
      setShowEmoteButtons(true)
      if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current)
      emoteTimerRef.current = setTimeout(() => setShowEmoteButtons(false), 3000)
    } finally {
      placedRef.current = false
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [placeDisc, myPlayer])

  const handlePlaceBomb = useCallback(async () => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    placedRef.current = true
    try {
      flushSync(() => { setIsActing(true); setHasPlacedThisTurn(true) })
      playCardPlace()
      await placeDisc('bomb')
      addLog(`${myPlayer?.player_name} がカードを置いた`, 'place')
      setShowEmoteButtons(true)
      if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current)
      emoteTimerRef.current = setTimeout(() => setShowEmoteButtons(false), 3000)
    } finally {
      placedRef.current = false
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [placeDisc, myPlayer])

  const handleBid = useCallback(async (amount: number) => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    try {
      flushSync(() => { setIsActing(true); setHasPlacedThisTurn(true) })
      playBid()
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
      flushSync(() => { setIsActing(true); setHasPlacedThisTurn(true) })
      playFold()
      await fold()
      addLog(`${myPlayer?.player_name} がパス`, 'fold')
    } finally {
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [fold, myPlayer])

  // ── Auto-action on timeout ────────────────────────────────────────────────
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

    if (realType === 'bomb') {
      playBombFlip()
      playFailure()
      addLog(`💣 ${myPlayer.player_name} が ${owner?.player_name} の爆弾を踏んだ！`, 'result')
      const freshDisc = [...freshState.myDiscs, ...freshState.publicDiscs].find(d => d.id === discId)
      await new Promise(r => setTimeout(r, 500))
      setModal({ show: true, type: 'bomb', challenger: myPlayer, bombOwner: owner, lostDisc: freshDisc })
    } else {
      playFlowerFlip()
      addLog(`🍎 ${myPlayer.player_name} が🍎をめくった`, 'flip')
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
      } else {
        actionLockRef.current = false
        setIsActing(false)
      }
    }
  }, [myPlayer, gameState, flipDisc, myDiscs, publicDiscs, players, highestBid])

  const triggerAutoAction = useCallback(async () => {
    if (!myPlayer || !gameState || actionLockRef.current) return
    setShowTimeoutToast(true)
    setTimeout(() => setShowTimeoutToast(false), 3000)

    if (phase === 'place') {
      const canFlower = myPlayer.flower_count > 0
      const canBomb = myPlayer.bomb_count > 0
      if (!canFlower && !canBomb) return
      if (!canFlower) { await handlePlaceBomb(); return }
      if (!canBomb) { await handlePlaceFlower(); return }
      if (Math.random() < 0.5) await handlePlaceFlower()
      else await handlePlaceBomb()
    } else if (phase === 'bid') {
      const canBidMore = highestBid < totalDiscs
      const canFoldNow = myPlayer && gameState ? canFold(myPlayer, gameState) : false
      if (!canBidMore && !canFoldNow) return
      if (!canBidMore) { await handleFold(); return }
      if (canFoldNow && Math.random() < 0.5) await handleFold()
      else await handleBid(highestBid + 1)
    } else if (phase === 'flip' && isChallenger) {
      const ownUnflipped = myDiscs
        .filter(d => d.round_number === round && !d.is_flipped)
        .sort((a, b) => b.position - a.position)
      if (ownUnflipped.length > 0) { await handleFlip(ownUnflipped[0].id); return }
      const othersUnflipped = publicDiscs
        .filter(d => d.player_id !== myPlayer.id && d.round_number === round && !d.is_flipped)
      if (othersUnflipped.length > 0) {
        const target = othersUnflipped[Math.floor(Math.random() * othersUnflipped.length)]
        await handleFlip(target.id)
      }
    }
  }, [myPlayer, gameState, phase, highestBid, totalDiscs, isChallenger, round, myDiscs, publicDiscs, handlePlaceFlower, handlePlaceBomb, handleBid, handleFold, handleFlip])

  useEffect(() => {
    return () => {
      if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current)
      if (emoteDisplayTimerRef.current) clearTimeout(emoteDisplayTimerRef.current)
    }
  }, [])

  const lastEmoteFromState = gameState?.last_emote ?? null
  useEffect(() => {
    if (!lastEmoteFromState) { setDisplayedEmote(null); return }
    setDisplayedEmote(lastEmoteFromState)
    if (emoteDisplayTimerRef.current) clearTimeout(emoteDisplayTimerRef.current)
    emoteDisplayTimerRef.current = setTimeout(() => setDisplayedEmote(null), 3000)
  }, [lastEmoteFromState?.sentAt])

  const myRoundDiscs = publicDiscs.filter(d => d.player_id === myPlayer?.id && d.round_number === round)
  const isMyTurnToFlip = isMyTurn && phase === 'flip' && isChallenger
  const myUnflipped = myRoundDiscs.filter(d => !d.is_flipped)

  function getGuideText() {
    if (!isMyTurn) {
      const current = players.find(p => p.id === gameState?.current_player_id)
      return `${current?.player_name ?? '...'} の手番`
    }
    if (phase === 'place') return 'りんごか爆弾を置いてください'
    if (phase === 'bid') return highestBid === 0 ? '入札を開始' : '入札かパス'
    if (phase === 'flip') return myUnflipped.length > 0 ? '自分のスタックから先にめくる' : 'スタックをめくる'
    return ''
  }

  const canFoldNow = myPlayer && gameState ? canFold(myPlayer, gameState) : false

  if (!gameState || !myPlayer) return null

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gray-950 text-white"
      style={{ fontFamily: 'Crimson Text, serif' }}
    >
      <ActionLog entries={log} />
      <TimeoutToast show={showTimeoutToast} />

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
              emote={displayedEmote?.playerId === p.id ? { type: displayedEmote.type as import('../types/game').EmoteType, sentAt: displayedEmote.sentAt } : null}
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
            emote={displayedEmote?.playerId === myPlayer.id ? { type: displayedEmote.type as import('../types/game').EmoteType, sentAt: displayedEmote.sentAt } : null}
          />
          <div className="flex-1">
            <p className="text-white/40 text-xs mb-1">手札</p>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: myPlayer.flower_count }).map((_, i) => (
                <img key={`f-${i}`} src="/apple.svg" alt="りんご" className="w-6 h-6" />
              ))}
              {Array.from({ length: myPlayer.bomb_count }).map((_, i) => (
                <img key={`b-${i}`} src="/bomb.svg" alt="爆弾" className="w-6 h-6" />
              ))}
            </div>
            <p className="text-white/30 text-xs mt-0.5">
              {myPlayer.flower_count + myPlayer.bomb_count}枚残り
            </p>
          </div>
          {isMyTurn && phase !== 'flip' && (
            <TurnTimer timeLeft={timeLeft} />
          )}
        </div>

        {/* Emote buttons */}
        <AnimatePresence>
          {showEmoteButtons && phase === 'place' && !isMyTurn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="text-white/40 text-xs text-center mb-1.5" style={{ fontFamily: 'Crimson Text, serif' }}>
                💬 エモートを送る
              </p>
              <div className="flex gap-2">
                <motion.button
                  onClick={async () => { setShowEmoteButtons(false); await sendEmote('BOMB') }}
                  className="flex-1 py-2 rounded-xl bg-red-900/50 border border-red-500/30 flex items-center justify-center gap-1.5"
                  whileTap={{ scale: 0.95 }}
                >
                  <img src="/bomb.svg" alt="爆弾" className="w-6 h-6" />
                  <span className="text-red-300 text-xs" style={{ fontFamily: 'Crimson Text, serif' }}>爆弾だ！</span>
                </motion.button>
                <motion.button
                  onClick={async () => { setShowEmoteButtons(false); await sendEmote('FLOWER') }}
                  className="flex-1 py-2 rounded-xl bg-emerald-900/50 border border-emerald-500/30 flex items-center justify-center gap-1.5"
                  whileTap={{ scale: 0.95 }}
                >
                  <img src="/apple.svg" alt="りんご" className="w-6 h-6" />
                  <span className="text-emerald-300 text-xs" style={{ fontFamily: 'Crimson Text, serif' }}>りんごだ！</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    disabled={isLoading || isActing || hasPlacedThisTurn || myPlayer.flower_count === 0}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-600 text-white font-bold disabled:opacity-40 text-sm flex items-center justify-center gap-1.5"
                    whileTap={!isActing && !hasPlacedThisTurn ? { scale: 0.96 } : {}}
                    style={{ fontFamily: 'Cinzel, serif', touchAction: 'manipulation', pointerEvents: (isLoading || isActing || hasPlacedThisTurn) ? 'none' : 'auto' }}
                  >
                    <img src="/apple.svg" alt="" className="w-5 h-5" />を置く
                  </motion.button>
                  <motion.button
                    onClick={handlePlaceBomb}
                    disabled={isLoading || isActing || hasPlacedThisTurn || myPlayer.bomb_count === 0}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gray-700 to-gray-600 text-white font-bold disabled:opacity-40 text-sm flex items-center justify-center gap-1.5"
                    whileTap={!isActing && !hasPlacedThisTurn ? { scale: 0.96 } : {}}
                    style={{ fontFamily: 'Cinzel, serif', touchAction: 'manipulation', pointerEvents: (isLoading || isActing || hasPlacedThisTurn) ? 'none' : 'auto' }}
                  >
                    <img src="/bomb.svg" alt="" className="w-5 h-5" />爆弾
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
                  isLoading={isLoading || isActing || hasPlacedThisTurn}
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
        bombOwner={modal.bombOwner}
        lostDisc={modal.lostDisc}
        onReturnToHub={() => {
          resetGame()
          onReturnToHub?.()
        }}
        onClose={async () => {
          const type = modal.type
          const bombOwnerId = modal.bombOwner?.id
          actionLockRef.current = false
          setIsActing(false)
          setModal({ show: false, type: null })
          if (type === 'win' || type === 'lose') {
            resetGame()
            onGameEnd?.()
          } else if (type === 'success') {
            await advanceAfterChallenge('win')
          } else if (type === 'bomb') {
            await advanceAfterChallenge('loss', bombOwnerId)
          }
        }}
      />
    </div>
  )
}
