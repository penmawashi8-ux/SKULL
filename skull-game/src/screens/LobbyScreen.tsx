import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { playButtonPress } from '../lib/sounds'

const COLOR_DOT: Record<string, string> = {
  red:    'bg-red-500',
  blue:   'bg-blue-500',
  green:  'bg-emerald-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink:   'bg-pink-500',
}

export function LobbyScreen() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const {
    room, players, sessionId, isLoading, error,
    subscribeToRoom, unsubscribeFromRoom, startGame, addCpuPlayer,
  } = useGameStore()

  const [copied, setCopied] = useState(false)
  const [isAddingCpu, setIsAddingCpu] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const addingCpuRef = useRef(false)
  const startingRef = useRef(false)

  const isHost   = room?.host_id === sessionId
  const canStart = players.filter(p => !p.is_eliminated).length >= 3

  // Subscribe for realtime updates
  useEffect(() => {
    if (!room) {
      navigate('/')
      return
    }
    subscribeToRoom(roomCode ?? '')
    return () => { /* keep subscription alive when navigating to game */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id])

  async function handleAddCpu() {
    if (addingCpuRef.current) return
    addingCpuRef.current = true
    flushSync(() => setIsAddingCpu(true))  // immediate DOM disable before any await
    playButtonPress()
    try {
      await addCpuPlayer()
    } finally {
      addingCpuRef.current = false
      setIsAddingCpu(false)
    }
  }

  async function handleStart() {
    if (startingRef.current) return
    startingRef.current = true
    flushSync(() => setIsStarting(true))  // immediate DOM disable before any await
    playButtonPress()
    try {
      await startGame()
      if (!useGameStore.getState().error) {
        navigate(`/game/${roomCode}`)
      }
    } finally {
      startingRef.current = false
      setIsStarting(false)
    }
  }

  function handleCopy() {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!room) return null

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #030712 70%)' }}
    >
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <button
          onClick={() => { unsubscribeFromRoom(); navigate('/menu') }}
          className="text-white/50 hover:text-white transition-colors text-sm mb-3"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          ← 退出
        </button>
        <h1 className="text-xl font-bold text-white/90" style={{ fontFamily: 'Cinzel, serif' }}>
          待機ロビー
        </h1>
      </div>

      {/* Room code card */}
      <div className="px-6 mb-4">
        <motion.div
          className="rounded-2xl p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(109,40,217,0.2), rgba(76,29,149,0.15))',
            border: '1px solid rgba(139,92,246,0.3)',
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-white/40 text-xs tracking-widest mb-1" style={{ fontFamily: 'Crimson Text, serif' }}>
            ROOM CODE
          </p>
          <p
            className="text-5xl font-bold text-white tracking-[0.25em] mb-3"
            style={{
              fontFamily: 'Cinzel, serif',
              textShadow: '0 0 24px rgba(139,92,246,0.7)',
            }}
          >
            {roomCode}
          </p>
          <motion.button
            onClick={handleCopy}
            className="text-purple-300/70 text-sm flex items-center gap-1.5 mx-auto"
            whileTap={{ scale: 0.95 }}
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            {copied ? '✓ コピーしました' : '📋 コードをコピー'}
          </motion.button>
        </motion.div>
      </div>

      {/* Players list */}
      <div className="flex-1 overflow-y-auto px-6 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/50 text-sm" style={{ fontFamily: 'Crimson Text, serif' }}>
            参加者
          </p>
          <p className="text-white/40 text-xs" style={{ fontFamily: 'Cinzel, serif' }}>
            {players.length} / {room.max_players}
          </p>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {players.map((player, idx) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: idx * 0.05 }}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
              >
                <span
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_DOT[player.player_color] ?? 'bg-gray-500'}`}
                />
                <span
                  className="text-white font-medium flex-1"
                  style={{ fontFamily: 'Crimson Text, serif' }}
                >
                  {player.player_name}
                </span>
                {player.session_id === sessionId && (
                  <span className="text-purple-400/60 text-xs" style={{ fontFamily: 'Crimson Text, serif' }}>
                    あなた
                  </span>
                )}
                {room.host_id === sessionId && player.session_id === sessionId && (
                  <span className="text-amber-400/70 text-xs ml-1" style={{ fontFamily: 'Cinzel, serif' }}>
                    HOST
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, room.max_players - players.length) }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 border border-dashed border-white/10 rounded-xl px-4 py-3"
            >
              <span className="w-3 h-3 rounded-full border border-white/20" />
              <span className="text-white/20 text-sm flex-1" style={{ fontFamily: 'Crimson Text, serif' }}>
                参加待ち...
              </span>
              {isHost && i === 0 && (
                <motion.button
                  onClick={handleAddCpu}
                  disabled={isLoading || isAddingCpu}
                  className="text-xs px-2.5 py-1 rounded-lg bg-purple-900/50 border border-purple-500/40 text-purple-300 disabled:opacity-40"
                  whileTap={{ scale: 0.95 }}
                  style={{ fontFamily: 'Crimson Text, serif' }}
                >
                  CPU追加
                </motion.button>
              )}
            </div>
          ))}
        </div>

        {/* Status text */}
        <p
          className="text-center text-white/30 text-sm mt-6"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          {canStart
            ? isHost
              ? '「ゲーム開始」ボタンを押してください'
              : 'ホストがゲームを開始するまでお待ちください'
            : `ゲーム開始には最低3人必要です（あと ${3 - players.length} 人）`}
        </p>
      </div>

      {/* Footer: start button (host only) */}
      <div
        className="flex-shrink-0 px-6 pt-3 pb-6"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {error && (
          <p className="text-red-400 text-sm text-center mb-3" style={{ fontFamily: 'Crimson Text, serif' }}>
            {error}
          </p>
        )}

        {isHost ? (
          <motion.button
            onClick={handleStart}
            disabled={isStarting || !canStart}
            className="w-full py-4 rounded-2xl text-white text-xl font-bold disabled:opacity-40"
            style={{
              fontFamily: 'Cinzel, serif',
              background: canStart
                ? 'linear-gradient(135deg, #6d28d9, #4c1d95)'
                : 'rgba(255,255,255,0.05)',
              boxShadow: canStart ? '0 0 28px rgba(109,40,217,0.45)' : 'none',
            }}
            whileHover={canStart ? { scale: 1.02 } : {}}
            whileTap={canStart ? { scale: 0.97 } : {}}
            animate={canStart ? { scale: [1, 1.01, 1] } : {}}
            transition={{ duration: 2, repeat: canStart ? Infinity : 0 }}
          >
            {isLoading ? '開始中...' : 'ゲーム開始'}
          </motion.button>
        ) : (
          <div
            className="w-full py-4 rounded-2xl text-center text-white/30 text-sm border border-white/5"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            ホストによる開始を待機中...
          </div>
        )}
      </div>
    </div>
  )
}
