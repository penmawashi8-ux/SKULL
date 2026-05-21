import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store/gameStore'
import type { RoomListItem } from '../types/game'
import { playButtonPress } from '../lib/sounds'

const RANDOM_NAMES = ['騎士', '魔法使い', '盗賊', '詩人', '商人', '旅人', '冒険者', '忍者', '吟遊詩人', '錬金術師']

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  return `${Math.floor(diff / 3600)}時間前`
}

export function RoomListScreen() {
  const navigate = useNavigate()
  const { joinRoom, isLoading, error } = useGameStore()

  const [rooms, setRooms] = useState<RoomListItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [selected, setSelected] = useState<RoomListItem | null>(null)
  const [defaultName] = useState(() => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)])
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const joiningRef = useRef(false)

  async function fetchRooms() {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_code, max_players, password, created_at, players(id)')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })

    if (!data) { setFetching(false); return }

    const roomRows = data as Array<{
      id: string
      room_code: string
      max_players: number
      password: string | null
      created_at: string
      players: { id: string }[]
    }>

    setRooms(
      roomRows.map(r => ({
        id: r.id,
        room_code: r.room_code,
        max_players: r.max_players,
        current_players: Array.isArray(r.players) ? r.players.length : 0,
        has_password: r.password != null && r.password !== '',
        created_at: r.created_at,
      }))
    )
    setFetching(false)
  }

  useEffect(() => {
    fetchRooms()

    const ch = supabase
      .channel('room-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchRooms)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchRooms)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  async function handleJoin() {
    if (!selected || joiningRef.current || isSubmitting || isLoading) return
    joiningRef.current = true
    setIsSubmitting(true)
    try {
      await joinRoom(selected.room_code, name.trim() || defaultName, selected.has_password ? password : undefined)
      if (!useGameStore.getState().error) {
        navigate(`/room/${selected.room_code}`)
      }
    } finally {
      joiningRef.current = false
      setIsSubmitting(false)
    }
  }

  function openSheet(room: RoomListItem) {
    playButtonPress()
    setSelected(room)
    setPassword('')
  }

  function closeSheet() {
    setSelected(null)
    setPassword('')
  }

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #030712 70%)' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-6 pb-4">
        <button
          onClick={() => navigate('/menu')}
          className="text-white/50 hover:text-white transition-colors text-sm"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          ← 戻る
        </button>
        <h1 className="text-xl font-bold text-white/90" style={{ fontFamily: 'Cinzel, serif' }}>
          ルームを探す
        </h1>
        <button
          onClick={() => { fetchRooms() }}
          className="ml-auto text-white/40 hover:text-white/70 text-xs transition-colors"
          style={{ fontFamily: 'Crimson Text, serif', touchAction: 'manipulation' }}
        >
          更新
        </button>
      </div>

      {/* Code join shortcut */}
      <div className="flex-shrink-0 px-6 pb-3">
        <button
          onClick={() => { playButtonPress(); navigate('/online/join') }}
          className="w-full py-2.5 rounded-xl border border-white/10 text-white/40 text-sm active:scale-[0.97] transition-transform"
          style={{ fontFamily: 'Crimson Text, serif', touchAction: 'manipulation' }}
        >
          コードで直接参加する →
        </button>
      </div>

      {/* Room list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 flex flex-col gap-3">
        {fetching ? (
          <p className="text-white/30 text-sm text-center pt-12" style={{ fontFamily: 'Crimson Text, serif' }}>
            読み込み中...
          </p>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-4 pt-16">
            <p className="text-white/30 text-sm text-center" style={{ fontFamily: 'Crimson Text, serif' }}>
              待機中のルームがありません
            </p>
            <button
              onClick={() => { playButtonPress(); navigate('/online/create') }}
              className="px-6 py-3 rounded-xl text-white text-sm font-semibold active:scale-[0.97] transition-transform"
              style={{
                fontFamily: 'Cinzel, serif',
                background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
                touchAction: 'manipulation',
              }}
            >
              ＋ ルームを作る
            </button>
          </div>
        ) : (
          rooms.map(room => (
            <button
              key={room.id}
              onClick={() => openSheet(room)}
              className="w-full text-left px-4 py-4 rounded-2xl border border-white/10 bg-white/5 active:scale-[0.98] transition-transform"
              style={{ touchAction: 'manipulation' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-white font-bold text-lg tracking-wider"
                      style={{ fontFamily: 'Cinzel, serif' }}
                    >
                      {room.room_code}
                    </span>
                    {room.has_password && (
                      <span className="text-yellow-400/80 text-sm" title="パスワードあり">🔒</span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs mt-0.5" style={{ fontFamily: 'Crimson Text, serif' }}>
                    {timeAgo(room.created_at)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p
                    className={`text-sm font-bold ${
                      room.current_players >= room.max_players ? 'text-red-400' : 'text-green-400'
                    }`}
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    {room.current_players} / {room.max_players}
                  </p>
                  <p className="text-white/30 text-xs" style={{ fontFamily: 'Crimson Text, serif' }}>人</p>
                </div>
                <span className="text-white/20 text-lg ml-1">›</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Join bottom sheet */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSheet}
          >
            <motion.div
              className="w-full max-w-lg bg-gray-900 border-t border-white/10 rounded-t-3xl p-6 pb-10"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

              <div className="flex items-center gap-2 mb-5">
                <span
                  className="text-2xl font-bold text-white tracking-wider"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  {selected.room_code}
                </span>
                {selected.has_password && <span className="text-yellow-400/80">🔒</span>}
                <span className="ml-auto text-white/40 text-sm" style={{ fontFamily: 'Crimson Text, serif' }}>
                  {selected.current_players} / {selected.max_players} 人
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {/* Name */}
                <div>
                  <label className="block text-white/50 text-xs mb-1.5" style={{ fontFamily: 'Crimson Text, serif' }}>
                    あなたの名前
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={12}
                    placeholder={defaultName}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-500/60"
                    style={{ fontFamily: 'Crimson Text, serif' }}
                  />
                </div>

                {/* Password (only if room is locked) */}
                {selected.has_password && (
                  <div>
                    <label className="block text-white/50 text-xs mb-1.5" style={{ fontFamily: 'Crimson Text, serif' }}>
                      パスワード
                    </label>
                    <input
                      type="text"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      maxLength={20}
                      placeholder="パスワードを入力"
                      autoComplete="off"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-500/60"
                      style={{ fontFamily: 'Crimson Text, serif' }}
                    />
                  </div>
                )}

                {error && (
                  <p
                    className="text-red-400 text-sm text-center bg-red-950/30 border border-red-500/20 rounded-xl py-2 px-3"
                    style={{ fontFamily: 'Crimson Text, serif' }}
                  >
                    {error}
                  </p>
                )}

                <button
                  onClick={handleJoin}
                  disabled={isLoading || isSubmitting || (selected.has_password && !password.trim())}
                  className="w-full py-4 rounded-2xl text-white text-lg font-bold disabled:opacity-40 active:scale-[0.97] transition-transform"
                  style={{
                    fontFamily: 'Cinzel, serif',
                    background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
                    boxShadow: '0 0 20px rgba(109,40,217,0.4)',
                    touchAction: 'manipulation',
                  }}
                >
                  {isLoading || isSubmitting ? '参加中...' : '参加する'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
