import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, getSessionId } from '../lib/supabase'
import { generateRoomCode, getInitialPlayerState } from '../lib/gameEngine'
import { cpuDecidePlace, cpuDecideBidOrFold, cpuDecideFlipTarget } from '../lib/cpuAI'
import type { Room, Player, GameState, PlacedDisc, DiscType, PlayerColor } from '../types/game'

const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'pink']

function getNextActivePlayer(players: Player[], currentPlayerId: string): Player | null {
  const active = [...players]
    .filter(p => !p.is_eliminated)
    .sort((a, b) => a.seat_order - b.seat_order)
  if (active.length === 0) return null
  const idx = active.findIndex(p => p.id === currentPlayerId)
  return active[(idx + 1) % active.length]
}

function ts(): string {
  return new Date().toISOString()
}

export interface StoreState {
  // ── Public state ───────────────────────────────────────────────────────────
  room: Room | null
  players: Player[]
  gameState: GameState | null
  myDiscs: PlacedDisc[]       // own discs with real disc_type
  publicDiscs: PlacedDisc[]   // all discs; unflipped others have masked disc_type
  sessionId: string
  isLoading: boolean
  error: string | null
  isCpuGame: boolean
  cpuDifficulty: 'easy' | 'normal' | 'hard'
  // ── Internal ───────────────────────────────────────────────────────────────
  _subscription: RealtimeChannel | null
  _myPlayerId: string | null
  _cpuDiscs: PlacedDisc[]     // CPU discs with real disc_type (never shown to human)
  // ── Actions ────────────────────────────────────────────────────────────────
  createRoom: (playerName: string, maxPlayers: number) => Promise<string>
  joinRoom: (roomCode: string, playerName: string) => Promise<void>
  startGame: () => Promise<void>
  placeDisc: (discType: DiscType) => Promise<void>
  placeBid: (amount: number) => Promise<void>
  fold: () => Promise<void>
  flipDisc: (discId: string) => Promise<void>
  startCpuGame: (playerName: string, cpuCount: number, difficulty: string) => Promise<void>
  subscribeToRoom: (roomCode: string) => void
  unsubscribeFromRoom: () => void
  resetGame: () => void
}

export const useGameStore = create<StoreState>()((set, get) => {

  // ── CPU turn processor ─────────────────────────────────────────────────────
  // Recursively runs CPU turns until it's the human's turn (or game pauses).
  async function processCpuTurns(): Promise<void> {
    const s = get()
    if (!s.isCpuGame || !s.gameState) return

    const currentPlayer = s.players.find(p => p.id === s.gameState!.current_player_id)
    if (!currentPlayer?.is_cpu) return

    const { cpuDifficulty, players, gameState, myDiscs, publicDiscs, _cpuDiscs, room } = s
    const round = gameState.round_number
    const allReal = [...myDiscs, ..._cpuDiscs]

    // ── place phase ──────────────────────────────────────────────────────────
    if (gameState.phase === 'place') {
      const canPlace = currentPlayer.flower_count + currentPlayer.skull_count > 0
      if (!canPlace) {
        const next = getNextActivePlayer(players, currentPlayer.id)
        set(prev => ({
          gameState: { ...prev.gameState!, current_player_id: next?.id ?? null, updated_at: ts() },
        }))
        await processCpuTurns()
        return
      }

      const discType = await cpuDecidePlace(currentPlayer, gameState, cpuDifficulty)
      const position = publicDiscs.filter(
        d => d.player_id === currentPlayer.id && d.round_number === round
      ).length + 1

      const realDisc: PlacedDisc = {
        id: crypto.randomUUID(),
        room_id: room!.id,
        player_id: currentPlayer.id,
        round_number: round,
        disc_type: discType,
        position,
        is_flipped: false,
        flipped_by: null,
        created_at: ts(),
      }
      // Mask disc_type in the public view
      const maskedDisc: PlacedDisc = { ...realDisc, disc_type: 'flower' }

      const updatedPlayers = players.map(p =>
        p.id !== currentPlayer.id ? p : {
          ...p,
          flower_count: discType === 'flower' ? p.flower_count - 1 : p.flower_count,
          skull_count:  discType === 'skull'  ? p.skull_count  - 1 : p.skull_count,
        }
      )
      const next = getNextActivePlayer(updatedPlayers, currentPlayer.id)

      set(prev => ({
        players: updatedPlayers,
        publicDiscs: [...prev.publicDiscs, maskedDisc],
        _cpuDiscs: [...prev._cpuDiscs, realDisc],
        gameState: { ...prev.gameState!, current_player_id: next?.id ?? null, updated_at: ts() },
      }))
      await processCpuTurns()
      return
    }

    // ── bid phase ────────────────────────────────────────────────────────────
    if (gameState.phase === 'bid') {
      const result = await cpuDecideBidOrFold(
        currentPlayer, gameState, players, allReal, cpuDifficulty
      )
      const activePlayers = players.filter(p => !p.is_eliminated)

      if (result.action === 'fold') {
        const newPassCount = gameState.pass_count + 1
        const isChallenge = newPassCount >= activePlayers.length - 1
        const next = isChallenge
          ? players.find(p => p.id === gameState.highest_bidder_id) ?? null
          : getNextActivePlayer(players, currentPlayer.id)

        set(prev => ({
          gameState: {
            ...prev.gameState!,
            pass_count: newPassCount,
            phase: isChallenge ? 'flip' : 'bid',
            current_player_id: next?.id ?? null,
            updated_at: ts(),
          },
        }))
        await processCpuTurns()
      } else {
        const next = getNextActivePlayer(players, currentPlayer.id)
        set(prev => ({
          gameState: {
            ...prev.gameState!,
            highest_bid: result.amount!,
            highest_bidder_id: currentPlayer.id,
            current_player_id: next?.id ?? null,
            updated_at: ts(),
          },
        }))
        await processCpuTurns()
      }
      return
    }

    // ── flip phase ───────────────────────────────────────────────────────────
    if (gameState.phase === 'flip') {
      if (gameState.highest_bidder_id !== currentPlayer.id) return

      const alreadyFlipped = publicDiscs
        .filter(d => d.is_flipped && d.round_number === round)
        .map(d => d.id)

      const targetId = await cpuDecideFlipTarget(
        currentPlayer,
        players,
        allReal.filter(d => d.round_number === round),
        alreadyFlipped,
        cpuDifficulty
      )
      if (!targetId) return

      const realDisc = allReal.find(d => d.id === targetId)
      if (!realDisc) return

      const newFlipCount = gameState.flip_count + 1
      set(prev => ({
        publicDiscs: prev.publicDiscs.map(d =>
          d.id === targetId
            ? { ...d, disc_type: realDisc.disc_type, is_flipped: true, flipped_by: currentPlayer.id }
            : d
        ),
        _cpuDiscs: prev._cpuDiscs.map(d =>
          d.id === targetId ? { ...d, is_flipped: true, flipped_by: currentPlayer.id } : d
        ),
        myDiscs: prev.myDiscs.map(d =>
          d.id === targetId ? { ...d, is_flipped: true, flipped_by: currentPlayer.id } : d
        ),
        gameState: { ...prev.gameState!, flip_count: newFlipCount, updated_at: ts() },
      }))

      // Stop if skull hit or bid fulfilled – UI handles the result display
      if (realDisc.disc_type === 'skull' || newFlipCount >= gameState.highest_bid) return
      await processCpuTurns()
    }
  }

  return {
    // ── Initial state ──────────────────────────────────────────────────────
    room: null,
    players: [],
    gameState: null,
    myDiscs: [],
    publicDiscs: [],
    sessionId: getSessionId(),
    isLoading: false,
    error: null,
    isCpuGame: false,
    cpuDifficulty: 'normal',
    _subscription: null,
    _myPlayerId: null,
    _cpuDiscs: [],

    // ── createRoom ─────────────────────────────────────────────────────────
    createRoom: async (playerName, maxPlayers) => {
      set({ isLoading: true, error: null })
      try {
        const sessionId = get().sessionId
        const roomCode = generateRoomCode()

        const { data: room, error: roomErr } = await supabase
          .from('rooms')
          .insert({ room_code: roomCode, host_id: sessionId, max_players: maxPlayers })
          .select()
          .single()
        if (roomErr) throw roomErr

        const playerInit = getInitialPlayerState(playerName, PLAYER_COLORS[0], 1, false)
        const { data: player, error: playerErr } = await supabase
          .from('players')
          .insert({ room_id: room.id, session_id: sessionId, ...playerInit })
          .select()
          .single()
        if (playerErr) throw playerErr

        set({ room, players: [player], _myPlayerId: player.id, isLoading: false })
        return roomCode
      } catch (e) {
        set({ error: String(e), isLoading: false })
        throw e
      }
    },

    // ── joinRoom ───────────────────────────────────────────────────────────
    joinRoom: async (roomCode, playerName) => {
      set({ isLoading: true, error: null })
      try {
        const sessionId = get().sessionId

        const { data: room, error: roomErr } = await supabase
          .from('rooms').select().eq('room_code', roomCode).single()
        if (roomErr) throw new Error('ルームが見つかりません')
        if (room.status !== 'waiting') throw new Error('ゲームは既に開始されています')

        const { data: existing, error: existErr } = await supabase
          .from('players').select().eq('room_id', room.id)
        if (existErr) throw existErr
        if (existing.length >= room.max_players) throw new Error('ルームが満員です')

        const seatOrder = existing.length + 1
        const color = PLAYER_COLORS[(seatOrder - 1) % PLAYER_COLORS.length]
        const playerInit = getInitialPlayerState(playerName, color, seatOrder, false)

        const { data: player, error: playerErr } = await supabase
          .from('players')
          .insert({ room_id: room.id, session_id: sessionId, ...playerInit })
          .select()
          .single()
        if (playerErr) throw playerErr

        set({ room, players: [...existing, player], _myPlayerId: player.id, isLoading: false })
      } catch (e) {
        set({ error: String(e), isLoading: false })
        throw e
      }
    },

    // ── startGame ──────────────────────────────────────────────────────────
    startGame: async () => {
      set({ isLoading: true, error: null })
      try {
        const { room, players } = get()
        if (!room) throw new Error('ルームが存在しません')

        const firstPlayer = [...players]
          .filter(p => !p.is_eliminated)
          .sort((a, b) => a.seat_order - b.seat_order)[0]

        const { data: gs, error: gsErr } = await supabase
          .from('game_states')
          .insert({
            room_id: room.id,
            round_number: 1,
            phase: 'place',
            current_player_id: firstPlayer.id,
          })
          .select().single()
        if (gsErr) throw gsErr

        await supabase.from('rooms').update({ status: 'playing' }).eq('id', room.id)
        set({ gameState: gs, room: { ...room, status: 'playing' }, isLoading: false })
      } catch (e) {
        set({ error: String(e), isLoading: false })
        throw e
      }
    },

    // ── placeDisc ──────────────────────────────────────────────────────────
    placeDisc: async (discType) => {
      const { room, gameState, players, sessionId, isCpuGame, myDiscs, publicDiscs } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      const round = gameState.round_number
      const position = publicDiscs.filter(
        d => d.player_id === myPlayer.id && d.round_number === round
      ).length + 1

      if (isCpuGame) {
        const newDisc: PlacedDisc = {
          id: crypto.randomUUID(),
          room_id: room.id,
          player_id: myPlayer.id,
          round_number: round,
          disc_type: discType,
          position,
          is_flipped: false,
          flipped_by: null,
          created_at: ts(),
        }
        const updatedPlayers = players.map(p =>
          p.id !== myPlayer.id ? p : {
            ...p,
            flower_count: discType === 'flower' ? p.flower_count - 1 : p.flower_count,
            skull_count:  discType === 'skull'  ? p.skull_count  - 1 : p.skull_count,
          }
        )
        const next = getNextActivePlayer(updatedPlayers, myPlayer.id)
        set({
          myDiscs: [...myDiscs, newDisc],
          publicDiscs: [...publicDiscs, newDisc], // own disc: real type visible
          players: updatedPlayers,
          gameState: { ...gameState, current_player_id: next?.id ?? null, updated_at: ts() },
        })
        await processCpuTurns()
        return
      }

      set({ isLoading: true })
      try {
        await supabase.from('placed_discs').insert({
          room_id: room.id, player_id: myPlayer.id,
          round_number: round, disc_type: discType, position,
        })
        await supabase.from('players').update({
          flower_count: discType === 'flower' ? myPlayer.flower_count - 1 : myPlayer.flower_count,
          skull_count:  discType === 'skull'  ? myPlayer.skull_count  - 1 : myPlayer.skull_count,
        }).eq('id', myPlayer.id)

        const next = getNextActivePlayer(players, myPlayer.id)
        await supabase.from('game_states').update({
          current_player_id: next?.id ?? null, updated_at: ts(),
        }).eq('id', gameState.id)
        set({ isLoading: false })
      } catch (e) {
        set({ error: String(e), isLoading: false })
      }
    },

    // ── placeBid ───────────────────────────────────────────────────────────
    placeBid: async (amount) => {
      const { room, gameState, players, sessionId, isCpuGame } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      const next = getNextActivePlayer(players, myPlayer.id)
      const updates = {
        phase: 'bid' as const,
        highest_bid: amount,
        highest_bidder_id: myPlayer.id,
        current_player_id: next?.id ?? null,
        updated_at: ts(),
      }

      if (isCpuGame) {
        set(s => ({ gameState: { ...s.gameState!, ...updates } }))
        await processCpuTurns()
        return
      }

      set({ isLoading: true })
      try {
        const { error } = await supabase.from('game_states').update(updates).eq('id', gameState.id)
        if (error) throw error
        set({ isLoading: false })
      } catch (e) {
        set({ error: String(e), isLoading: false })
      }
    },

    // ── fold ───────────────────────────────────────────────────────────────
    fold: async () => {
      const { room, gameState, players, sessionId, isCpuGame } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      const activePlayers = players.filter(p => !p.is_eliminated)
      const newPassCount = gameState.pass_count + 1
      const isChallenge = newPassCount >= activePlayers.length - 1
      const next = isChallenge
        ? players.find(p => p.id === gameState.highest_bidder_id) ?? null
        : getNextActivePlayer(players, myPlayer.id)

      const updates = {
        pass_count: newPassCount,
        phase: (isChallenge ? 'flip' : gameState.phase) as 'bid' | 'flip',
        current_player_id: next?.id ?? null,
        updated_at: ts(),
      }

      if (isCpuGame) {
        set(s => ({ gameState: { ...s.gameState!, ...updates } }))
        await processCpuTurns()
        return
      }

      set({ isLoading: true })
      try {
        const { error } = await supabase.from('game_states').update(updates).eq('id', gameState.id)
        if (error) throw error
        set({ isLoading: false })
      } catch (e) {
        set({ error: String(e), isLoading: false })
      }
    },

    // ── flipDisc ───────────────────────────────────────────────────────────
    flipDisc: async (discId) => {
      const { room, gameState, players, sessionId, isCpuGame, myDiscs, _cpuDiscs } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      const newFlipCount = gameState.flip_count + 1

      if (isCpuGame) {
        // Look up the true disc_type from the real-disc stores
        const realDisc = [...myDiscs, ..._cpuDiscs].find(d => d.id === discId)
        const realType = realDisc?.disc_type ?? 'flower'

        set(s => ({
          publicDiscs: s.publicDiscs.map(d =>
            d.id === discId
              ? { ...d, disc_type: realType, is_flipped: true, flipped_by: myPlayer.id }
              : d
          ),
          myDiscs: s.myDiscs.map(d =>
            d.id === discId ? { ...d, is_flipped: true, flipped_by: myPlayer.id } : d
          ),
          _cpuDiscs: s._cpuDiscs.map(d =>
            d.id === discId ? { ...d, is_flipped: true, flipped_by: myPlayer.id } : d
          ),
          gameState: { ...s.gameState!, flip_count: newFlipCount, updated_at: ts() },
        }))
        return // skull hit or success handled by UI
      }

      set({ isLoading: true })
      try {
        await supabase.from('placed_discs').update({
          is_flipped: true, flipped_by: myPlayer.id,
        }).eq('id', discId)
        await supabase.from('game_states').update({
          flip_count: newFlipCount, updated_at: ts(),
        }).eq('id', gameState.id)
        set({ isLoading: false })
      } catch (e) {
        set({ error: String(e), isLoading: false })
      }
    },

    // ── startCpuGame ───────────────────────────────────────────────────────
    startCpuGame: async (playerName, cpuCount, difficulty) => {
      set({ isLoading: true, error: null })
      const sessionId = get().sessionId
      const roomId = crypto.randomUUID()

      const room: Room = {
        id: roomId,
        room_code: generateRoomCode(),
        status: 'playing',
        host_id: sessionId,
        max_players: cpuCount + 1,
        current_round: 1,
        created_at: ts(),
        updated_at: ts(),
      }

      const humanId = crypto.randomUUID()
      const humanPlayer: Player = {
        id: humanId,
        room_id: roomId,
        session_id: sessionId,
        created_at: ts(),
        ...getInitialPlayerState(playerName, PLAYER_COLORS[0], 1, false),
      }

      const cpuPlayers: Player[] = Array.from({ length: cpuCount }, (_, i) => ({
        id: crypto.randomUUID(),
        room_id: roomId,
        session_id: `cpu-${i}-${crypto.randomUUID()}`,
        created_at: ts(),
        ...getInitialPlayerState(`CPU ${i + 1}`, PLAYER_COLORS[i + 1], i + 2, true),
      }))

      const allPlayers = [humanPlayer, ...cpuPlayers]
      const firstPlayer = [...allPlayers].sort((a, b) => a.seat_order - b.seat_order)[0]

      const initialGameState: GameState = {
        id: crypto.randomUUID(),
        room_id: roomId,
        round_number: 1,
        phase: 'place',
        current_player_id: firstPlayer.id,
        highest_bid: 0,
        highest_bidder_id: null,
        pass_count: 0,
        flip_count: 0,
        created_at: ts(),
        updated_at: ts(),
      }

      set({
        room,
        players: allPlayers,
        gameState: initialGameState,
        myDiscs: [],
        publicDiscs: [],
        _cpuDiscs: [],
        isCpuGame: true,
        cpuDifficulty: difficulty as 'easy' | 'normal' | 'hard',
        _myPlayerId: humanId,
        isLoading: false,
      })

      await processCpuTurns()
    },

    // ── subscribeToRoom ────────────────────────────────────────────────────
    subscribeToRoom: (_roomCode) => {
      const { _subscription, room, _myPlayerId } = get()
      if (_subscription) supabase.removeChannel(_subscription)
      if (!room) return

      const roomId = room.id

      const channel = supabase
        .channel(`room:${roomId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`,
        }, payload => {
          if (payload.eventType !== 'DELETE') set({ room: payload.new as Room })
        })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}`,
        }, payload => {
          if (payload.eventType === 'INSERT') {
            set(s => ({ players: [...s.players, payload.new as Player] }))
          } else if (payload.eventType === 'UPDATE') {
            set(s => ({
              players: s.players.map(p =>
                p.id === (payload.new as Player).id ? payload.new as Player : p
              ),
            }))
          }
        })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'game_states', filter: `room_id=eq.${roomId}`,
        }, payload => {
          if (payload.eventType !== 'DELETE') set({ gameState: payload.new as GameState })
        })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'placed_discs', filter: `room_id=eq.${roomId}`,
        }, payload => {
          if (payload.eventType === 'DELETE') return
          const disc = payload.new as PlacedDisc
          const isOwn = disc.player_id === _myPlayerId
          // Mask disc_type for other players' unflipped discs
          const publicDisc: PlacedDisc = isOwn || disc.is_flipped
            ? disc
            : { ...disc, disc_type: 'flower' }

          if (payload.eventType === 'INSERT') {
            set(s => ({
              publicDiscs: [...s.publicDiscs, publicDisc],
              myDiscs: isOwn ? [...s.myDiscs, disc] : s.myDiscs,
            }))
          } else {
            set(s => ({
              publicDiscs: s.publicDiscs.map(d => d.id === disc.id ? publicDisc : d),
              myDiscs: isOwn ? s.myDiscs.map(d => d.id === disc.id ? disc : d) : s.myDiscs,
            }))
          }
        })
        .subscribe()

      set({ _subscription: channel })
    },

    // ── unsubscribeFromRoom ────────────────────────────────────────────────
    unsubscribeFromRoom: () => {
      const channel = get()._subscription
      if (channel) {
        supabase.removeChannel(channel)
        set({ _subscription: null })
      }
    },

    // ── resetGame ─────────────────────────────────────────────────────────
    resetGame: () => {
      const channel = get()._subscription
      if (channel) supabase.removeChannel(channel)
      set({
        room: null,
        players: [],
        gameState: null,
        myDiscs: [],
        publicDiscs: [],
        _cpuDiscs: [],
        isLoading: false,
        error: null,
        isCpuGame: false,
        cpuDifficulty: 'normal',
        _subscription: null,
        _myPlayerId: null,
      })
    },
  }
})
