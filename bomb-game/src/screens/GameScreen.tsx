import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { GameBoard } from '../components/GameBoard'

const BOARD_GAME_HUB_URL = import.meta.env.VITE_BOARD_GAME_HUB_URL || 'https://bodoge-hub.vercel.app'

export function GameScreen() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const { room, gameState, isCpuGame, subscribeToRoom, unsubscribeFromRoom, isLoading } = useGameStore()

  useEffect(() => {
    // Online game: re-subscribe (or start subscription if coming from refresh)
    if (!isCpuGame && room) {
      subscribeToRoom(roomCode ?? '')
    }
    return () => {
      if (!isCpuGame) unsubscribeFromRoom()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCpuGame, room?.id])

  // Redirect home if no game data (e.g. page refresh mid-game)
  useEffect(() => {
    if (!isLoading && !room && !gameState) {
      navigate('/', { replace: true })
    }
  }, [room, gameState, isLoading, navigate])

  if (!room || !gameState) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: '#0e1023' }}
      >
        <p className="text-white/40" style={{ fontFamily: 'Crimson Text, serif' }}>
          読み込み中...
        </p>
      </div>
    )
  }

  return (
    <GameBoard
      onGameEnd={() => navigate('/', { replace: true })}
      onReturnToHub={() => { window.location.href = BOARD_GAME_HUB_URL }}
    />
  )
}
