import { useState, useCallback, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { PlayerCard } from './PlayerCard'
import { BidController } from './BidController'
import { ActionLog } from './ActionLog'
import { ResultModal } from './ResultModal'
import { canFold, getWinner } from '../lib/gameEngine'
import { playFlowerFlip, playBombFlip, playCardPlace, playSuccess, playFailure, playBid, playFold } from '../lib/sounds'
import type { LogEntry } from './ActionLog'
import type { Player } from '../types/game'

const PHASE_LABEL: Record<string, string> = {
  place: '配置',
  bid: '入札',
  flip: 'めくり',
}

const MAX_LOG = 12

export function GameBoard(_props: { onGameEnd?: () => void } = {}) {
  const {
    room, players, gameState, publicDiscs,
    sessionId, isCpuGame, _foldedPlayerIds, _permCards,
    placeDisc, placeBid, fold, flipDisc, advanceAfterChallenge,
    _cpuLog, resetGame,
  } = useGameStore()

  const myPlayer = players.find(p => p.session_id === sessionId) ?? null
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isActing, setIsActing] = useState(false)
  const [showResult, setShowResult] = useState<{
    type: 'success' | 'bomb' | 'win' | 'lose'
    challengerPlayer?: Player
    bombOwnerPlayer?: Player
  } | null>(null)
  const actionLockRef = useRef<boolean>(false)
  const pendingOnlineTurnRef = useRef<string | null>(null)
  const prevCpuLogRef = useRef<string | null>(null)

  const addLog = useCallback((message: string, type: LogEntry['type']) => {
    const entry: LogEntry = { id: crypto.randomUUID(), message, type, timestamp: Date.now() }
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

  const myHandCount = (myPlayer?.flower_count ?? 0) + (myPlayer?.bomb_count ?? 0)

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
  }, [placeDisc, myPlayer, addLog])

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
  }, [placeBid, myPlayer, addLog])

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
  }, [fold, myPlayer, addLog])

  // ── Flip a disc ──────────────────────────────────────────────────────────
  const handleFlip = useCallback(async (discId: string) => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    try {
      const result = await flipDisc(discId)
      if (result === 'bomb') {
        playBombFlip()
        const { publicDiscs: pd, players: ps } = useGameStore.getState()
        const bombDisc = pd.find(d => d.id === discId)
        const bombOwner = bombDisc ? ps.find(p => p.id === bombDisc.player_id) : undefined
        addLog(`💣 ${myPlayer?.player_name} が爆弾を踏んだ！`, 'result')
        setShowResult({ type: 'bomb', challengerPlayer: myPlayer ?? undefined, bombOwnerPlayer: bombOwner })
      } else {
        playFlowerFlip()
        addLog(`🍎 ${myPlayer?.player_name} がカードをめくった`, 'flip')
        const { gameState: freshGs } = useGameStore.getState()
        if (freshGs && freshGs.flip_count >= freshGs.highest_bid) {
          setShowResult({ type: 'success', challengerPlayer: myPlayer ?? undefined })
        }
      }
    } finally {
      actionLockRef.current = false
    }
  }, [flipDisc, myPlayer, addLog])

  // ── Advance after challenge result ────────────────────────────────────────
  const handleAdvance = useCallback(async (outcome: 'win' | 'loss') => {
    actionLockRef.current = true
    setIsActing(true)
    try {
      if (outcome === 'win') { playSuccess() }
      else { playFailure() }
      await advanceAfterChallenge(outcome)
      const { players: freshPs } = useGameStore.getState()
      const winner = getWinner(freshPs)
      if (winner) {
        const isMyWin = winner.id === myPlayer?.id
        setShowResult({ type: isMyWin ? 'win' : 'lose', challengerPlayer: winner })
      } else {
        setShowResult(null)
      }
    } finally {
      actionLockRef.current = false
      setIsActing(false)
    }
  }, [advanceAfterChallenge, myPlayer])

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

  const flippedCount = publicDiscs.filter(d => d.is_flipped && d.round_number === round).length
  const remaining = gameState.highest_bid - flippedCount

  const canPlaceMore = isPlacePhase && isMyTurn && myHandCount > 0 && !isActing
  const foldable = myPlayer ? canFold(myPlayer, gameState) : false
  const totalDiscs = publicDiscs.filter(d => d.round_number === round).length

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
              gameState={gameState}
              isCurrentTurn={gameState.current_player_id === player.id}
              isMyTurnToFlip={isMyFlip && !actionLockRef.current}
              challengerId={gameState.highest_bidder_id ?? null}
              hasFolded={_foldedPlayerIds.includes(player.id)}
              discs={publicDiscs.filter(d => d.player_id === player.id && d.round_number === round)}
              permCards={_permCards[player.id]}
              emote={
                gameState.last_emote?.playerId === player.id
                  ? { type: gameState.last_emote.type, sentAt: gameState.last_emote.sentAt }
                  : null
              }
              onFlip={handleFlip}
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
              currentHighest={gameState.highest_bid}
              totalDiscs={totalDiscs}
              canFold={foldable}
              isLoading={false}
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
      <ActionLog entries={logs} />

      {/* ── Result modal ───────────────────────────────────────────────── */}
      <ResultModal
        show={showResult !== null}
        type={showResult?.type ?? null}
        challenger={showResult?.challengerPlayer}
        bombOwner={showResult?.bombOwnerPlayer}
        onClose={() => {
          const type = showResult?.type
          if (type === 'win' || type === 'lose') {
            setShowResult(null)
            resetGame()
          } else if (type === 'success') {
            setShowResult(null)
            handleAdvance('win')
          } else if (type === 'bomb') {
            setShowResult(null)
            handleAdvance('loss')
          } else {
            setShowResult(null)
          }
        }}
      />

      {/* ── Winner overlay (CPU game) ───────────────────────────────────── */}
      <AnimatePresence>
        {winner && !showResult && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-center px-8">
              <div className="text-5xl mb-4">{winner.id === myPlayer?.id ? '👑' : '💔'}</div>
              <p className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                {winner.player_name} の勝利！
              </p>
              <motion.button
                onClick={() => resetGame()}
                className="mt-4 px-8 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                whileTap={{ scale: 0.97 }}
              >
                ホームへ
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
