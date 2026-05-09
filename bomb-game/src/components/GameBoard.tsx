import { useState, useCallback, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { PlayerCard } from './PlayerCard'
import { BidController } from './BidController'
import { ActionLog } from './ActionLog'
import { ResultModal } from './ResultModal'
import { canFold, getTotalDiscsInPlay, getWinner } from '../lib/gameEngine'
import { playButtonPress, playFlowerFlip, playBombFlip, playCardPlace, playSuccess, playFailure, playBid, playFold } from '../lib/sounds'
import type { LogEntry } from './ActionLog'
import type { Player, PlacedDisc } from '../types/game'

const PHASE_LABEL: Record<string, string> = {
  place: '配置',
  bid: '入札',
  flip: 'めくり',
}

const MAX_LOG = 12

type ActionLockState = boolean

export function GameBoard() {
  const {
    room, players, gameState, myDiscs, publicDiscs,
    sessionId, isCpuGame, _foldedPlayerIds,
    placeDisc, placeBid, fold, flipDisc, advanceAfterChallenge,
    _cpuLog,
  } = useGameStore()

  const myPlayer = players.find(p => p.session_id === sessionId) ?? null
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isActing, setIsActing] = useState(false)
  const [flipResult, setFlipResult] = useState<{ type: 'flower' | 'bomb'; discId: string } | null>(null)
  const [showResult, setShowResult] = useState<{ outcome: 'win' | 'loss'; bombOwnerId?: string } | null>(null)
  const actionLockRef = useRef<ActionLockState>(false)
  const pendingOnlineTurnRef = useRef<string | null>(null)
  const prevCpuLogRef = useRef<string | null>(null)

  const addLog = useCallback((message: string, type: LogEntry['type']) => {
    const entry: LogEntry = { id: crypto.randomUUID(), message, type }
    setLogs(prev => [entry, ...prev].slice(0, MAX_LOG))
  }, [])

  // ── Listen for CPU action logs ────────────────────────────────────────────
  useEffect(() => {
    if (!_cpuLog) return
    if (_cpuLog.id === prevCpuLogRef.current) return
    prevCpuLogRef.current = _cpuLog.id
    addLog(_cpuLog.message, _cpuLog.type)

    if (!isCpuGame) return
    if (_cpuLog.type === 'place') playCardPlace()
    else if (_cpuLog.type === 'bid') playBid()
    else if (_cpuLog.type === 'fold') playFold()
    else if (_cpuLog.type === 'result') {
      if (_cpuLog.message.includes('爆弾')) { playBombFlip(); playFailure() }
      else playSuccess()
    }
    else if (_cpuLog.type === 'flip') playFlowerFlip()
  }, [_cpuLog, isCpuGame, addLog])

  // ── Unlock action after online realtime confirms turn change ─────────────
  useEffect(() => {
    const pending = pendingOnlineTurnRef.current
    if (!pending || !gameState) return
    const currentKey = `${gameState.current_player_id}:${gameState.phase}`
    if (currentKey !== pending) {
      pendingOnlineTurnRef.current = null
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [gameState])

  const isMyTurn = gameState?.current_player_id === myPlayer?.id
  const round = gameState?.round_number ?? 1

  const myStackCount = publicDiscs.filter(
    d => d.player_id === myPlayer?.id && d.round_number === round,
  ).length

  // ── Place disc ───────────────────────────────────────────────────────────
  const handlePlace = useCallback(async (type: 'flower' | 'bomb') => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    const { isCpuGame: cpuGame, gameState: gs } = useGameStore.getState()
    const turnKey = `${gs?.current_player_id}:${gs?.phase}`
    let succeeded = false
    try {
      flushSync(() => setIsActing(true))
      playCardPlace()
      await placeDisc(type)
      addLog(`${myPlayer?.player_name} がカードを置いた`, 'place')
      succeeded = true
    } finally {
      if (cpuGame || !succeeded) {
        actionLockRef.current = false
        setIsActing(false)
      } else {
        pendingOnlineTurnRef.current = turnKey
      }
    }
  }, [placeDisc, myPlayer])

  const handleBid = useCallback(async (amount: number) => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    const { isCpuGame: cpuGame, gameState: gs } = useGameStore.getState()
    const turnKey = `${gs?.current_player_id}:${gs?.phase}`
    let succeeded = false
    try {
      flushSync(() => setIsActing(true))
      playBid()
      await placeBid(amount)
      addLog(`${myPlayer?.player_name} が ${amount} 枚と宣言`, 'bid')
      succeeded = true
    } finally {
      if (cpuGame || !succeeded) {
        actionLockRef.current = false
        setIsActing(false)
      } else {
        pendingOnlineTurnRef.current = turnKey
      }
    }
  }, [placeBid, myPlayer])

  const handleFold = useCallback(async () => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    const { isCpuGame: cpuGame, gameState: gs } = useGameStore.getState()
    const turnKey = `${gs?.current_player_id}:${gs?.phase}`
    let succeeded = false
    try {
      flushSync(() => setIsActing(true))
      playFold()
      await fold()
      addLog(`${myPlayer?.player_name} がパス`, 'fold')
      succeeded = true
    } finally {
      if (cpuGame || !succeeded) {
        actionLockRef.current = false
        setIsActing(false)
      } else {
        pendingOnlineTurnRef.current = turnKey
      }
    }
  }, [fold, myPlayer])

  // ── Auto-action on timeout ────────────────────────────────────────────────
  const triggerAutoAction = useCallback(async () => {
    // Always read fresh state to guard against stale-closure / Supabase race conditions.
    const { gameState: gs, players: ps, sessionId: sid, publicDiscs: pd } = useGameStore.getState()
    const freshMe = ps.find(p => p.session_id === sid)
    if (!freshMe || !gs) return
    // Abort if it's no longer actually my turn (race condition guard)
    if (gs.current_player_id !== freshMe.id) return
    if (gs.phase === 'flip') return

    if (gs.phase === 'place') {
      const hasFlower = freshMe.flower_count > 0
      await handlePlace(hasFlower ? 'flower' : 'bomb')
    } else if (gs.phase === 'bid') {
      const totalDiscs = pd.filter(d => d.round_number === gs.round_number).length
      const minBid = gs.highest_bid + 1
      const canBidMore = minBid <= totalDiscs
      if (!canBidMore || canFold(gs, ps)) {
        await handleFold()
      } else {
        await handleBid(minBid)
      }
    }
  }, [handlePlace, handleBid, handleFold])

  // ── Flip a disc ──────────────────────────────────────────────────────────
  const handleFlip = useCallback(async (discId: string) => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    try {
      const result = await flipDisc(discId)
      setFlipResult({ type: result, discId })
      if (result === 'bomb') {
        playBombFlip()
      } else {
        playFlowerFlip()
      }
    } finally {
      actionLockRef.current = false
    }
  }, [flipDisc])

  // ── Advance after flip result ─────────────────────────────────────────────
  const handleAdvance = useCallback(async (outcome: 'win' | 'loss', bombOwnerId?: string) => {
    setFlipResult(null)
    actionLockRef.current = true
    try {
      if (outcome === 'win') { playSuccess() }
      else { playFailure() }
      await advanceAfterChallenge(outcome, bombOwnerId)
    } finally {
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [advanceAfterChallenge])

  if (!gameState || !room) return null

  const winner = getWinner(players)

  const activePlayers = players.filter(p => !p.is_eliminated)
  const isFlipPhase = gameState.phase === 'flip'
  const isBidPhase = gameState.phase === 'bid'
  const isPlacePhase = gameState.phase === 'place'
  const challenger = isFlipPhase
    ? players.find(p => p.id === gameState.highest_bidder_id) ?? null
    : null
  const isMyFlip = isFlipPhase && gameState.highest_bidder_id === myPlayer?.id

  const totalInPlay = getTotalDiscsInPlay(publicDiscs, gameState.round_number)
  const flippedCount = publicDiscs.filter(d => d.is_flipped && d.round_number === round).length
  const remaining = gameState.highest_bid - flippedCount

  const myHandCount = (myPlayer?.flower_count ?? 0) + (myPlayer?.bomb_count ?? 0)
  const canPlaceMore = isPlacePhase && isMyTurn && myHandCount > 0 && !isActing

  const foldable = canFold(gameState, players)

  return (
    <div className="h-full flex flex-col select-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #030712 70%)' }}>

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-safe pt-3 pb-2">
        <span className="text-white/40 text-xs" style={{ fontFamily: 'Cinzel, serif' }}>
          Round {round} · {PHASE_LABEL[gameState.phase] ?? gameState.phase}
        </span>
        {isFlipPhase && challenger && (
          <span className="text-amber-400 text-xs font-semibold" style={{ fontFamily: 'Cinzel, serif' }}>
            {challenger.player_name} が {gameState.highest_bid} 枚に挑戦中
          </span>
        )}
        {isFlipPhase && remaining > 0 && (
          <span className="text-white/50 text-xs">
            あと {remaining} 枚
          </span>
        )}
      </div>

      {/* ── Player grid ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-3 pb-2">
        <div className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(activePlayers.length, 3)}, 1fr)` }}
        >
          {players.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrentTurn={gameState.current_player_id === player.id}
              isMe={player.id === myPlayer?.id}
              isFolded={_foldedPlayerIds.includes(player.id)}
              discs={publicDiscs.filter(d => d.player_id === player.id && d.round_number === round)}
              canFlip={
                isMyFlip &&
                !actionLockRef.current &&
                player.id !== myPlayer?.id
                  ? publicDiscs.some(d =>
                      d.player_id === player.id &&
                      d.round_number === round &&
                      !d.is_flipped
                    )
                  : false
              }
              canFlipOwn={
                isMyFlip &&
                !actionLockRef.current &&
                player.id === myPlayer?.id
                  ? publicDiscs.some(d =>
                      d.player_id === player.id &&
                      d.round_number === round &&
                      !d.is_flipped
                    )
                  : false
              }
              flipResult={flipResult?.discId && publicDiscs.find(d => d.id === flipResult.discId)?.player_id === player.id ? flipResult : null}
              onFlip={handleFlip}
              onAdvance={handleAdvance}
              gameState={gameState}
              myPlayer={myPlayer}
              isCpuGame={isCpuGame}
              triggerAutoAction={triggerAutoAction}
            />
          ))}
        </div>
      </div>

      {/* ── My hand & actions ──────────────────────────────────────────── */}
      {myPlayer && !myPlayer.is_eliminated && (
        <div className="px-4 pb-safe pb-4 space-y-3">
          {/* Place phase — show hand */}
          {canPlaceMore && (
            <div className="flex gap-3 justify-center">
              {myPlayer.flower_count > 0 && (
                <motion.button
                  onClick={() => handlePlace('flower')}
                  className="flex-1 max-w-[160px] py-3 rounded-2xl bg-green-800/50 border border-green-500/40 text-white font-semibold text-sm"
                  whileTap={{ scale: 0.96 }}
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  🍎 りんご ({myPlayer.flower_count})
                </motion.button>
              )}
              {myPlayer.bomb_count > 0 && (
                <motion.button
                  onClick={() => handlePlace('bomb')}
                  className="flex-1 max-w-[160px] py-3 rounded-2xl bg-red-900/50 border border-red-500/40 text-white font-semibold text-sm"
                  whileTap={{ scale: 0.96 }}
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  💣 爆弾 ({myPlayer.bomb_count})
                </motion.button>
              )}
            </div>
          )}

          {/* Bid phase */}
          {isBidPhase && isMyTurn && !isActing && (
            <BidController
              gameState={gameState}
              players={players}
              publicDiscs={publicDiscs}
              foldable={foldable}
              onBid={handleBid}
              onFold={handleFold}
            />
          )}

          {/* Waiting indicator */}
          {!isMyTurn && !isFlipPhase && !winner && (
            <div className="text-center text-white/30 text-sm py-2" style={{ fontFamily: 'Crimson Text, serif' }}>
              {players.find(p => p.id === gameState.current_player_id)?.player_name ?? '？'} のターン
            </div>
          )}
        </div>
      )}

      {/* ── Action log ─────────────────────────────────────────────────── */}
      <ActionLog logs={logs} />

      {/* ── Win/loss result modal ───────────────────────────────────────── */}
      <ResultModal
        show={showResult !== null}
        outcome={showResult?.outcome ?? 'win'}
        onClose={() => setShowResult(null)}
      />
    </div>
  )
}
