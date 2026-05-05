import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, getSessionId } from '../lib/supabase'
import { generateRoomCode, getInitialPlayerState, getWinner } from '../lib/gameEngine'
import { cpuDecidePlace, cpuDecideBidOrFold, cpuDecideFlipTarget } from '../lib/cpuAI'
import type { Room, Player, GameState, PlacedDisc, DiscType, PlayerColor } from '../types/game'

const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'pink']

function getNextActivePlayer(
  players: Player[],
  currentPlayerId: string,
  skipIds: string[] = [],
): Player | null {
  const all = [...players]
    .filter(p => !p.is_eliminated)
    .sort((a, b) => a.seat_order - b.seat_order)
  const idx = all.findIndex(p => p.id === currentPlayerId)
  // Walk forward; never return the current player themselves (wrap-around guard)
  for (let i = 1; i < all.length; i++) {
    const candidate = all[(idx + i) % all.length]
    if (!skipIds.includes(candidate.id)) return candidate
  }
  return null
}

// Like getNextActivePlayer but also skips players with empty hands.
// Returns null when no other active player has cards — caller should force bid.
function getNextPlayerWithHand(players: Player[], currentPlayerId: string): Player | null {
  const all = [...players]
    .filter(p => !p.is_eliminated)
    .sort((a, b) => a.seat_order - b.seat_order)
  const idx = all.findIndex(p => p.id === currentPlayerId)
  for (let i = 1; i < all.length; i++) {
    const candidate = all[(idx + i) % all.length]
    if (candidate.flower_count + candidate.skull_count > 0) return candidate
  }
  return null
}

function ts(): string {
  return new Date().toISOString()
}

export interface StoreState {
  room: Room | null
  players: Player[]
  gameState: GameState | null
  myDiscs: PlacedDisc[]
  publicDiscs: PlacedDisc[]
  sessionId: string
  isLoading: boolean
  error: string | null
  isCpuGame: boolean
  cpuDifficulty: 'easy' | 'normal' | 'hard'
  isReconnecting: boolean
  _subscription: RealtimeChannel | null
  _myPlayerId: string | null
  _cpuDiscs: PlacedDisc[]
  _foldedPlayerIds: string[]  // client-side fold tracking
  _permCards: Record<string, { flowers: number; skulls: number }>  // permanent card totals
  _cpuLog: { id: string; message: string; type: 'place' | 'bid' | 'fold' | 'flip' | 'result' } | null

  createRoom: (playerName: string, maxPlayers: number) => Promise<string>
  joinRoom: (roomCode: string, playerName: string) => Promise<void>
  startGame: () => Promise<void>
  placeDisc: (discType: DiscType) => Promise<void>
  placeBid: (amount: number) => Promise<void>
  fold: () => Promise<void>
  flipDisc: (discId: string) => Promise<DiscType>
  advanceAfterChallenge: (result: 'win' | 'loss', skullOwnerId?: string) => Promise<void>
  addCpuPlayer: () => Promise<void>
  startCpuGame: (playerName: string, cpuCount: number, difficulty: string) => Promise<void>
  subscribeToRoom: (roomCode: string) => void
  unsubscribeFromRoom: () => void
  resetGame: () => void
  resumeCpuTurns: () => Promise<void>
}

// Mutex to prevent concurrent online CPU turn processing
let _onlineCpuProcessing = false
// Mutex to prevent concurrent local CPU turn processing
let _cpuRunning = false
// Mutex to prevent concurrent addCpuPlayer calls (module-level for synchronous block)
let _addingCpu = false

export const useGameStore = create<StoreState>()((set, get) => {

  // ── helpers ──────────────────────────────────────────────────────────────────

  function allPlacedAtLeastOnce(players: Player[], discs: PlacedDisc[], round: number): boolean {
    const active = players.filter(p => !p.is_eliminated)
    return active.every(p => discs.some(d => d.player_id === p.id && d.round_number === round))
  }

  function allHandsEmpty(players: Player[]): boolean {
    return players.filter(p => !p.is_eliminated).every(p => p.flower_count + p.skull_count === 0)
  }

  // ── startNextRound (CPU game) ─────────────────────────────────────────────
  function startNextRound(
    startingPlayerId: string,
    playersIn: Player[],
    roomIn: Room,
    gameStateIn: GameState,
  ) {
    const newRound = gameStateIn.round_number + 1
    const newGs: GameState = {
      ...gameStateIn,
      round_number: newRound,
      phase: 'place',
      current_player_id: startingPlayerId,
      highest_bid: 0,
      highest_bidder_id: null,
      pass_count: 0,
      flip_count: 0,
      updated_at: ts(),
    }
    // Restore hand to permanent totals (respects cards lost to skulls)
    const { _permCards } = get()
    const resetPlayers = playersIn.map(p => {
      if (p.is_eliminated) return p
      const perm = _permCards[p.id]
      return perm
        ? { ...p, flower_count: perm.flowers, skull_count: perm.skulls }
        : { ...p, flower_count: Math.min(3, p.flower_count + 3), skull_count: Math.min(1, p.skull_count + 1) }
    })
    set({
      gameState: newGs,
      players: resetPlayers,
      publicDiscs: [],
      myDiscs: [],
      _cpuDiscs: [],
      _foldedPlayerIds: [],
      room: { ...roomIn, current_round: newRound },
    })
  }

  // ── processCpuTurns ───────────────────────────────────────────────────────
  // _runCpuLoop: inner recursive implementation (no mutex check)
  async function _runCpuLoop(): Promise<void> {
    await new Promise(r => setTimeout(r, 700))
    const s = get()
    if (!s.isCpuGame || !s.gameState) return

    const currentPlayer = s.players.find(p => p.id === s.gameState!.current_player_id)
    if (!currentPlayer?.is_cpu) return

    const { cpuDifficulty, players, gameState, myDiscs, publicDiscs, _cpuDiscs, room, _foldedPlayerIds } = s
    const round = gameState.round_number
    const allReal = [...myDiscs, ..._cpuDiscs]

    // ── place phase ──────────────────────────────────────────────────────────
    if (gameState.phase === 'place') {
      const hasHand = currentPlayer.flower_count + currentPlayer.skull_count > 0
      const placed = allPlacedAtLeastOnce(players, publicDiscs, round)

      // If no hand left, skip to next player
      if (!hasHand) {
        // Check if all hands empty → force bid phase
        if (allHandsEmpty(players)) {
          const firstActive = [...players]
            .filter(p => !p.is_eliminated)
            .sort((a, b) => a.seat_order - b.seat_order)[0]
          set(prev => ({
            gameState: {
              ...prev.gameState!,
              phase: 'bid',
              current_player_id: firstActive?.id ?? null,
              updated_at: ts(),
            },
            _foldedPlayerIds: [],
          }))
          await _runCpuLoop()
          return
        }
        const next = getNextActivePlayer(players, currentPlayer.id)
        set(prev => ({
          gameState: { ...prev.gameState!, current_player_id: next?.id ?? null, updated_at: ts() },
        }))
        await _runCpuLoop()
        return
      }

      // CPU decides: if allPlaced, may choose to bid instead of placing
      let shouldBid = false
      if (placed && hasHand) {
        // Decide stochastically based on difficulty
        const bidChance = cpuDifficulty === 'hard' ? 0.5 : cpuDifficulty === 'normal' ? 0.35 : 0.2
        shouldBid = Math.random() < bidChance
      }

      if (shouldBid) {
        // CPU starts bidding
        const totalDiscs = publicDiscs.filter(d => d.round_number === round).length
        const minBid = gameState.highest_bid + 1
        if (minBid <= totalDiscs) {
          const next = getNextActivePlayer(players, currentPlayer.id, _foldedPlayerIds)
          set(prev => ({
            gameState: {
              ...prev.gameState!,
              phase: 'bid',
              highest_bid: minBid,
              highest_bidder_id: currentPlayer.id,
              current_player_id: next?.id ?? null,
              updated_at: ts(),
            },
            _foldedPlayerIds: [],
            _cpuLog: { id: crypto.randomUUID(), message: `${currentPlayer.player_name} が ${minBid} 枚と宣言`, type: 'bid' },
          }))
          await _runCpuLoop()
          return
        }
      }

      const discType = await cpuDecidePlace(currentPlayer, gameState, cpuDifficulty)
      const position = publicDiscs.filter(
        d => d.player_id === currentPlayer.id && d.round_number === round,
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
      const maskedDisc: PlacedDisc = { ...realDisc, disc_type: 'flower' }

      const updatedPlayers = players.map(p =>
        p.id !== currentPlayer.id ? p : {
          ...p,
          flower_count: discType === 'flower' ? p.flower_count - 1 : p.flower_count,
          skull_count:  discType === 'skull'  ? p.skull_count  - 1 : p.skull_count,
        },
      )

      const cpuPlaceLog = { id: crypto.randomUUID(), message: `${currentPlayer.player_name} がカードを置いた`, type: 'place' as const }

      // Check if all hands now empty → force bid
      if (allHandsEmpty(updatedPlayers)) {
        const firstActive = [...updatedPlayers]
          .filter(p => !p.is_eliminated)
          .sort((a, b) => a.seat_order - b.seat_order)[0]
        set(prev => ({
          players: updatedPlayers,
          publicDiscs: [...prev.publicDiscs, maskedDisc],
          _cpuDiscs: [...prev._cpuDiscs, realDisc],
          gameState: {
            ...prev.gameState!,
            phase: 'bid',
            current_player_id: firstActive?.id ?? null,
            updated_at: ts(),
          },
          _foldedPlayerIds: [],
          _cpuLog: cpuPlaceLog,
        }))
        await _runCpuLoop()
        return
      }

      const next = getNextActivePlayer(updatedPlayers, currentPlayer.id)
      set(prev => ({
        players: updatedPlayers,
        publicDiscs: [...prev.publicDiscs, maskedDisc],
        _cpuDiscs: [...prev._cpuDiscs, realDisc],
        gameState: { ...prev.gameState!, current_player_id: next?.id ?? null, updated_at: ts() },
        _cpuLog: cpuPlaceLog,
      }))
      await _runCpuLoop()
      return
    }

    // ── bid phase ────────────────────────────────────────────────────────────
    if (gameState.phase === 'bid') {
      const result = await cpuDecideBidOrFold(
        currentPlayer, gameState, players, allReal, cpuDifficulty,
      )
      const activePlayers = players.filter(p => !p.is_eliminated)
      const newFoldedIds = result.action === 'fold'
        ? [..._foldedPlayerIds, currentPlayer.id]
        : _foldedPlayerIds

      // Challenge starts when only one non-folded player remains (the highest bidder)
      const nonFolded = activePlayers.filter(p => !newFoldedIds.includes(p.id))
      const isChallenge = nonFolded.length <= 1

      if (result.action === 'fold') {
        const foldLog = { id: crypto.randomUUID(), message: `${currentPlayer.player_name} がパス`, type: 'fold' as const }
        if (isChallenge) {
          const challenger = players.find(p => p.id === gameState.highest_bidder_id) ?? null
          set(prev => ({
            gameState: {
              ...prev.gameState!,
              pass_count: prev.gameState!.pass_count + 1,
              phase: 'flip',
              current_player_id: challenger?.id ?? null,
              updated_at: ts(),
            },
            _foldedPlayerIds: newFoldedIds,
            _cpuLog: foldLog,
          }))
          await _runCpuLoop()
        } else {
          const next = getNextActivePlayer(players, currentPlayer.id, newFoldedIds)
          set(prev => ({
            gameState: {
              ...prev.gameState!,
              pass_count: prev.gameState!.pass_count + 1,
              current_player_id: next?.id ?? null,
              updated_at: ts(),
            },
            _foldedPlayerIds: newFoldedIds,
            _cpuLog: foldLog,
          }))
          await _runCpuLoop()
        }
      } else {
        const totalPlaced = publicDiscs.filter(d => d.round_number === round).length
        const nextPlayer = getNextActivePlayer(players, currentPlayer.id, _foldedPlayerIds)
        const goToFlip = result.amount! >= totalPlaced || !nextPlayer
        set(prev => ({
          gameState: {
            ...prev.gameState!,
            highest_bid: result.amount!,
            highest_bidder_id: currentPlayer.id,
            current_player_id: goToFlip ? currentPlayer.id : nextPlayer!.id,
            phase: goToFlip ? 'flip' : 'bid',
            updated_at: ts(),
          },
          _cpuLog: { id: crypto.randomUUID(), message: `${currentPlayer.player_name} が ${result.amount} 枚と宣言`, type: 'bid' },
        }))
        await _runCpuLoop()
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
        cpuDifficulty,
      )
      if (!targetId) return

      const realDisc = allReal.find(d => d.id === targetId)
      if (!realDisc) return

      const newFlipCount = gameState.flip_count + 1

      const flipLog = realDisc.disc_type === 'skull'
        ? { id: crypto.randomUUID(), message: `💀 ${currentPlayer.player_name} がドクロを踏んだ！`, type: 'result' as const }
        : { id: crypto.randomUUID(), message: `🌸 ${currentPlayer.player_name} がカードをめくった`, type: 'flip' as const }

      set(prev => ({
        publicDiscs: prev.publicDiscs.map(d =>
          d.id === targetId
            ? { ...d, disc_type: realDisc.disc_type, is_flipped: true, flipped_by: currentPlayer.id }
            : d,
        ),
        _cpuDiscs: prev._cpuDiscs.map(d =>
          d.id === targetId ? { ...d, is_flipped: true, flipped_by: currentPlayer.id } : d,
        ),
        myDiscs: prev.myDiscs.map(d =>
          d.id === targetId ? { ...d, is_flipped: true, flipped_by: currentPlayer.id } : d,
        ),
        gameState: { ...prev.gameState!, flip_count: newFlipCount, updated_at: ts() },
        _cpuLog: flipLog,
      }))

      if (realDisc.disc_type === 'skull') {
        // CPU challenger hit a skull — lose a random card permanently
        const freshState = get()
        const currentPerm = freshState._permCards[currentPlayer.id] ?? { flowers: 3, skulls: 1 }
        const permTotal = currentPerm.flowers + currentPerm.skulls
        const loseSkull = permTotal > 0 && currentPerm.skulls > 0 && Math.random() < currentPerm.skulls / permTotal
        const newPerm = {
          flowers: loseSkull ? currentPerm.flowers : Math.max(0, currentPerm.flowers - 1),
          skulls:  loseSkull ? Math.max(0, currentPerm.skulls - 1) : currentPerm.skulls,
        }
        const isEliminated = newPerm.flowers + newPerm.skulls === 0
        const updatedPermCards = { ...freshState._permCards, [currentPlayer.id]: newPerm }
        const updatedPlayers = freshState.players.map(p => {
          if (p.id !== currentPlayer.id) return p
          return { ...p, flower_count: newPerm.flowers, skull_count: newPerm.skulls, is_eliminated: isEliminated }
        })
        const winner = getWinner(updatedPlayers)
        set({
          players: updatedPlayers,
          _permCards: updatedPermCards,
          gameState: winner
            ? { ...freshState.gameState!, phase: 'place', updated_at: ts() }
            : freshState.gameState,
          _cpuLog: { id: crypto.randomUUID(), message: `💀 ${currentPlayer.player_name} がドクロを踏んだ！カードを1枚失った`, type: 'result' },
        })
        if (!winner) {
          // Challenger (who failed) starts next round
          const failedChallenger = updatedPlayers.find(p => p.id === currentPlayer.id)
          const starterId = failedChallenger?.is_eliminated
            ? getNextActivePlayer(updatedPlayers, currentPlayer.id)?.id ?? currentPlayer.id
            : currentPlayer.id
          await new Promise(r => setTimeout(r, 1500))  // let user read the skull result
          startNextRound(starterId, updatedPlayers, freshState.room!, freshState.gameState!)
          await _runCpuLoop()
        }
        return
      }

      if (newFlipCount >= gameState.highest_bid) {
        // CPU challenge succeeded
        const freshState = get()
        const updatedPlayers = freshState.players.map(p =>
          p.id !== currentPlayer.id ? p : { ...p, win_count: p.win_count + 1 },
        )
        const winner = getWinner(updatedPlayers)
        set({
          players: updatedPlayers,
          _cpuLog: { id: crypto.randomUUID(), message: `🌸 ${currentPlayer.player_name} がチャレンジ成功！`, type: 'result' },
        })
        if (!winner) {
          await new Promise(r => setTimeout(r, 1500))  // let user read the success result
          startNextRound(currentPlayer.id, updatedPlayers, freshState.room!, freshState.gameState!)
          await _runCpuLoop()
        }
        return
      }

      await _runCpuLoop()
    }
  }

  // processCpuTurns: guarded entry point — drops concurrent calls via _cpuRunning mutex
  async function processCpuTurns(): Promise<void> {
    if (_cpuRunning) return
    _cpuRunning = true
    try {
      await _runCpuLoop()
    } finally {
      _cpuRunning = false
    }
  }

  // ── processOnlineCpuTurn ──────────────────────────────────────────────────
  // Called by the host client when the realtime game_state update shows a CPU's turn.
  async function processOnlineCpuTurn(cpuPlayer: Player, _gs: GameState): Promise<void> {
    if (_onlineCpuProcessing) return
    _onlineCpuProcessing = true
    try {
      await new Promise(r => setTimeout(r, 700))

      const s = get()
      if (!s.room || s.isCpuGame || !s.gameState) return
      if (s.gameState.current_player_id !== cpuPlayer.id) return

      const { players, publicDiscs, myDiscs, _cpuDiscs, _foldedPlayerIds, room, cpuDifficulty } = s
      const round = s.gameState.round_number
      const allReal = [...myDiscs, ..._cpuDiscs]
      const gs2 = s.gameState  // fresh game state

      // ── place ────────────────────────────────────────────────────────────
      if (gs2.phase === 'place') {
        const hasHand = cpuPlayer.flower_count + cpuPlayer.skull_count > 0
        const placed = allPlacedAtLeastOnce(players, publicDiscs, round)

        if (!hasHand) {
          if (allHandsEmpty(players)) {
            const first = [...players].filter(p => !p.is_eliminated).sort((a, b) => a.seat_order - b.seat_order)[0]
            await supabase.from('game_states').update({ phase: 'bid', current_player_id: first?.id ?? null, updated_at: ts() }).eq('id', gs2.id)
            set({ _foldedPlayerIds: [] })
          } else {
            const next = getNextPlayerWithHand(players, cpuPlayer.id)
            if (next === null) {
              await supabase.from('game_states').update({ phase: 'bid', current_player_id: cpuPlayer.id, updated_at: ts() }).eq('id', gs2.id)
              set({ _foldedPlayerIds: [] })
            } else {
              await supabase.from('game_states').update({ current_player_id: next.id, updated_at: ts() }).eq('id', gs2.id)
            }
          }
          return
        }

        let shouldBid = false
        if (placed && hasHand) {
          const bidChance = cpuDifficulty === 'hard' ? 0.5 : cpuDifficulty === 'normal' ? 0.35 : 0.2
          shouldBid = Math.random() < bidChance
        }

        if (shouldBid) {
          const totalDiscs = publicDiscs.filter(d => d.round_number === round).length
          const minBid = gs2.highest_bid + 1
          if (minBid <= totalDiscs) {
            const next = getNextActivePlayer(players, cpuPlayer.id, _foldedPlayerIds)
            await supabase.from('game_states').update({
              phase: 'bid', highest_bid: minBid, highest_bidder_id: cpuPlayer.id,
              current_player_id: next?.id ?? null, updated_at: ts(),
            }).eq('id', gs2.id)
            set({ _foldedPlayerIds: [], _cpuLog: { id: crypto.randomUUID(), message: `${cpuPlayer.player_name} が ${minBid} 枚と宣言`, type: 'bid' } })
            return
          }
        }

        const discType = await cpuDecidePlace(cpuPlayer, gs2, cpuDifficulty)
        const position = publicDiscs.filter(d => d.player_id === cpuPlayer.id && d.round_number === round).length + 1
        const { data: insertedDisc } = await supabase.from('placed_discs').insert({
          room_id: room.id, player_id: cpuPlayer.id, round_number: round, disc_type: discType, position,
        }).select().single()
        if (insertedDisc) set(prev => ({ _cpuDiscs: [...prev._cpuDiscs, insertedDisc] }))

        const newFlower = discType === 'flower' ? cpuPlayer.flower_count - 1 : cpuPlayer.flower_count
        const newSkull  = discType === 'skull'  ? cpuPlayer.skull_count  - 1 : cpuPlayer.skull_count
        await supabase.from('players').update({ flower_count: newFlower, skull_count: newSkull }).eq('id', cpuPlayer.id)
        set(prev => ({
          players: prev.players.map(p => p.id !== cpuPlayer.id ? p : { ...p, flower_count: newFlower, skull_count: newSkull }),
          _cpuLog: { id: crypto.randomUUID(), message: `${cpuPlayer.player_name} がカードを置いた`, type: 'place' },
        }))

        const updatedPlayers = players.map(p => p.id !== cpuPlayer.id ? p : { ...p, flower_count: newFlower, skull_count: newSkull })
        if (allHandsEmpty(updatedPlayers)) {
          const first = [...updatedPlayers].filter(p => !p.is_eliminated).sort((a, b) => a.seat_order - b.seat_order)[0]
          await supabase.from('game_states').update({ phase: 'bid', current_player_id: first?.id ?? null, updated_at: ts() }).eq('id', gs2.id)
          set({ _foldedPlayerIds: [] })
        } else {
          const next = getNextPlayerWithHand(updatedPlayers, cpuPlayer.id)
          if (next === null) {
            await supabase.from('game_states').update({ phase: 'bid', current_player_id: cpuPlayer.id, updated_at: ts() }).eq('id', gs2.id)
            set({ _foldedPlayerIds: [] })
          } else {
            await supabase.from('game_states').update({ current_player_id: next.id, updated_at: ts() }).eq('id', gs2.id)
          }
        }
        return
      }

      // ── bid ──────────────────────────────────────────────────────────────
      if (gs2.phase === 'bid') {
        const result = await cpuDecideBidOrFold(cpuPlayer, gs2, players, allReal, cpuDifficulty)
        const activePlayers = players.filter(p => !p.is_eliminated)
        const newFoldedIds = result.action === 'fold' ? [..._foldedPlayerIds, cpuPlayer.id] : _foldedPlayerIds
        // Use pass_count (authoritative in DB) instead of local _foldedPlayerIds,
        // because guest folds are not propagated to the host's _foldedPlayerIds.
        const isChallenge = result.action === 'fold' && (gs2.pass_count + 1) >= (activePlayers.length - 1)

        if (result.action === 'fold') {
          set({ _foldedPlayerIds: newFoldedIds, _cpuLog: { id: crypto.randomUUID(), message: `${cpuPlayer.player_name} がパス`, type: 'fold' } })
          if (isChallenge) {
            const challenger = players.find(p => p.id === gs2.highest_bidder_id)
            await supabase.from('game_states').update({
              pass_count: gs2.pass_count + 1, phase: 'flip',
              current_player_id: challenger?.id ?? null, updated_at: ts(),
            }).eq('id', gs2.id)
          } else {
            const next = getNextActivePlayer(players, cpuPlayer.id, newFoldedIds)
            await supabase.from('game_states').update({
              pass_count: gs2.pass_count + 1, current_player_id: next?.id ?? null, updated_at: ts(),
            }).eq('id', gs2.id)
          }
        } else {
          set({ _cpuLog: { id: crypto.randomUUID(), message: `${cpuPlayer.player_name} が ${result.amount} 枚と宣言`, type: 'bid' } })
          const round2 = gs2.round_number
          const totalPlaced2 = publicDiscs.filter(d => d.round_number === round2).length
          const nextPlayer2 = getNextActivePlayer(players, cpuPlayer.id, _foldedPlayerIds)
          const goToFlip2 = result.amount! >= totalPlaced2 || !nextPlayer2
          await supabase.from('game_states').update({
            highest_bid: result.amount!, highest_bidder_id: cpuPlayer.id,
            current_player_id: goToFlip2 ? cpuPlayer.id : nextPlayer2!.id,
            phase: goToFlip2 ? 'flip' : 'bid',
            updated_at: ts(),
          }).eq('id', gs2.id)
        }
        return
      }

      // ── flip (CPU is challenger) ──────────────────────────────────────────
      if (gs2.phase === 'flip' && gs2.highest_bidder_id === cpuPlayer.id) {
        const alreadyFlipped = publicDiscs.filter(d => d.is_flipped && d.round_number === round).map(d => d.id)
        const targetId = await cpuDecideFlipTarget(cpuPlayer, players, allReal.filter(d => d.round_number === round), alreadyFlipped, cpuDifficulty)
        if (!targetId) return

        const realDisc = allReal.find(d => d.id === targetId)
        if (!realDisc) return

        const newFlipCount = gs2.flip_count + 1
        await supabase.from('placed_discs').update({ is_flipped: true, flipped_by: cpuPlayer.id }).eq('id', targetId)
        await supabase.from('game_states').update({ flip_count: newFlipCount, updated_at: ts() }).eq('id', gs2.id)

        const flipLog = realDisc.disc_type === 'skull'
          ? { id: crypto.randomUUID(), message: `💀 ${cpuPlayer.player_name} がドクロを踏んだ！`, type: 'result' as const }
          : { id: crypto.randomUUID(), message: `🌸 ${cpuPlayer.player_name} がカードをめくった`, type: 'flip' as const }

        set(prev => ({
          publicDiscs: prev.publicDiscs.map(d => d.id === targetId ? { ...d, disc_type: realDisc.disc_type, is_flipped: true } : d),
          _cpuDiscs: prev._cpuDiscs.map(d => d.id === targetId ? { ...d, is_flipped: true } : d),
          myDiscs: prev.myDiscs.map(d => d.id === targetId ? { ...d, is_flipped: true } : d),
          _cpuLog: flipLog,
        }))

        if (realDisc.disc_type === 'skull') {
          // CPU hit a skull — lose a random card
          const freshS = get()
          const currentPerm = freshS._permCards[cpuPlayer.id] ?? { flowers: 3, skulls: 1 }
          const permTotal = currentPerm.flowers + currentPerm.skulls
          const loseSkull = permTotal > 0 && currentPerm.skulls > 0 && Math.random() < currentPerm.skulls / permTotal
          const newPerm = {
            flowers: loseSkull ? currentPerm.flowers : Math.max(0, currentPerm.flowers - 1),
            skulls:  loseSkull ? Math.max(0, currentPerm.skulls - 1) : currentPerm.skulls,
          }
          const isEliminated = newPerm.flowers + newPerm.skulls === 0
          const updatedPerm = { ...freshS._permCards, [cpuPlayer.id]: newPerm }
          await supabase.from('players').update({ flower_count: newPerm.flowers, skull_count: newPerm.skulls, is_eliminated: isEliminated }).eq('id', cpuPlayer.id)
          const updatedPlayers = freshS.players.map(p => p.id !== cpuPlayer.id ? p : { ...p, flower_count: newPerm.flowers, skull_count: newPerm.skulls, is_eliminated: isEliminated })
          set({
            players: updatedPlayers,
            _permCards: updatedPerm,
            _cpuLog: { id: crypto.randomUUID(), message: `💀 ${cpuPlayer.player_name} がドクロを踏んだ！カードを1枚失った`, type: 'result' },
          })
          const winner = getWinner(updatedPlayers)
          if (!winner) {
            // Challenger (who failed) starts next round
            const failedChallenger = updatedPlayers.find(p => p.id === cpuPlayer.id)
            const starterId = failedChallenger?.is_eliminated
              ? getNextActivePlayer(updatedPlayers, cpuPlayer.id)?.id ?? cpuPlayer.id
              : cpuPlayer.id
            const newRound = gs2.round_number + 1
            const resetPlayers = updatedPlayers.map(p => {
              if (p.is_eliminated) return p
              const perm = updatedPerm[p.id]
              return perm ? { ...p, flower_count: perm.flowers, skull_count: perm.skulls } : p
            })
            await new Promise(r => setTimeout(r, 1500))
            await supabase.from('placed_discs').delete().eq('room_id', room.id).eq('round_number', gs2.round_number)
            await supabase.from('game_states').update({
              round_number: newRound, phase: 'place', current_player_id: starterId,
              highest_bid: 0, highest_bidder_id: null, pass_count: 0, flip_count: 0, updated_at: ts(),
            }).eq('id', gs2.id)
            for (const p of resetPlayers.filter(p => !p.is_eliminated)) {
              await supabase.from('players').update({ flower_count: p.flower_count, skull_count: p.skull_count }).eq('id', p.id)
            }
            set({ players: resetPlayers, publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] })
          }
        } else if (newFlipCount >= gs2.highest_bid) {
          // CPU challenge succeeded
          await supabase.from('players').update({ win_count: cpuPlayer.win_count + 1 }).eq('id', cpuPlayer.id)
          const freshS = get()
          const updatedPlayers = freshS.players.map(p => p.id !== cpuPlayer.id ? p : { ...p, win_count: p.win_count + 1 })
          set({
            players: updatedPlayers,
            _cpuLog: { id: crypto.randomUUID(), message: `🌸 ${cpuPlayer.player_name} がチャレンジ成功！`, type: 'result' },
          })
          const winner = getWinner(updatedPlayers)
          if (!winner) {
            const newRound = gs2.round_number + 1
            const resetPlayers = updatedPlayers.map(p => {
              if (p.is_eliminated) return p
              const perm = freshS._permCards[p.id]
              return perm ? { ...p, flower_count: perm.flowers, skull_count: perm.skulls } : p
            })
            await new Promise(r => setTimeout(r, 1500))
            await supabase.from('placed_discs').delete().eq('room_id', room.id).eq('round_number', gs2.round_number)
            await supabase.from('game_states').update({
              round_number: newRound, phase: 'place', current_player_id: cpuPlayer.id,
              highest_bid: 0, highest_bidder_id: null, pass_count: 0, flip_count: 0, updated_at: ts(),
            }).eq('id', gs2.id)
            for (const p of resetPlayers.filter(p => !p.is_eliminated)) {
              await supabase.from('players').update({ flower_count: p.flower_count, skull_count: p.skull_count }).eq('id', p.id)
            }
            set({ players: resetPlayers, publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] })
          }
        }
      }
    } finally {
      _onlineCpuProcessing = false
      // If still CPU's turn (e.g. mid-flip), retrigger
      const s2 = get()
      const still = s2.players.find(p => p.id === s2.gameState?.current_player_id)
      if (still?.is_cpu && !s2.isCpuGame && s2.room) {
        processOnlineCpuTurn(still, s2.gameState!)
      }
    }
  }

  // ── processOnlineEmptyHandTurn ────────────────────────────────────────────
  // Host: called when a human player gets the turn in place phase but may have
  // 0 cards due to subscription race (player counts updated before game_states).
  // Mirrors the empty-hand branch in processOnlineCpuTurn.
  async function processOnlineEmptyHandTurn(player: Player, gs: GameState): Promise<void> {
    if (_onlineCpuProcessing) return
    _onlineCpuProcessing = true
    try {
      const s = get()
      if (!s.room || s.isCpuGame || !s.gameState) return
      if (s.gameState.current_player_id !== player.id || s.gameState.phase !== 'place') return

      // Fetch authoritative player counts from DB to avoid stale local state
      const { data: freshPlayers } = await supabase.from('players').select().eq('room_id', s.room.id)
      if (!freshPlayers) return

      // Guard: turn may have moved while we awaited the DB fetch
      const s2 = get()
      if (!s2.gameState || s2.gameState.current_player_id !== player.id || s2.gameState.phase !== 'place') return

      const freshPlayer = freshPlayers.find(p => p.id === player.id)
      if (!freshPlayer || freshPlayer.flower_count + freshPlayer.skull_count > 0) return

      // Player has 0 cards — advance turn or force bid (same logic as CPU empty-hand)
      const active = freshPlayers.filter(p => !p.is_eliminated)
      const allEmpty = active.every(p => p.flower_count + p.skull_count === 0)
      if (allEmpty) {
        const first = [...active].sort((a, b) => a.seat_order - b.seat_order)[0]
        await supabase.from('game_states').update({
          phase: 'bid', current_player_id: first?.id ?? null, updated_at: ts(),
        }).eq('id', gs.id)
        set({ _foldedPlayerIds: [] })
      } else {
        const next = getNextPlayerWithHand(freshPlayers, freshPlayer.id)
        if (next === null) {
          await supabase.from('game_states').update({
            phase: 'bid', current_player_id: freshPlayer.id, updated_at: ts(),
          }).eq('id', gs.id)
          set({ _foldedPlayerIds: [] })
        } else {
          await supabase.from('game_states').update({
            current_player_id: next.id, updated_at: ts(),
          }).eq('id', gs.id)
        }
      }
    } finally {
      _onlineCpuProcessing = false
    }
  }

  return {
    // ── Initial state ─────────────────────────────────────────────────────────
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
    isReconnecting: false,
    _subscription: null,
    _myPlayerId: null,
    _cpuDiscs: [],
    _foldedPlayerIds: [],
    _permCards: {},
    _cpuLog: null,

    // ── createRoom ────────────────────────────────────────────────────────────
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
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
        throw e
      }
    },

    // ── joinRoom ──────────────────────────────────────────────────────────────
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

        // Rejoin if session already has a player in this room
        const rejoining = existing.find(p => p.session_id === sessionId)
        if (rejoining) {
          set({ room, players: existing, _myPlayerId: rejoining.id, isLoading: false })
          return
        }

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
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
        throw e
      }
    },

    // ── startGame ─────────────────────────────────────────────────────────────
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
        // Init _permCards for online+CPU hybrid mode
        const initPerm: Record<string, { flowers: number; skulls: number }> = {}
        for (const p of players) initPerm[p.id] = { flowers: p.flower_count, skulls: p.skull_count }
        set({ gameState: gs, room: { ...room, status: 'playing' }, isLoading: false, _permCards: initPerm, _cpuDiscs: [] })
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
        throw e
      }
    },

    // ── addCpuPlayer ──────────────────────────────────────────────────────────
    addCpuPlayer: async () => {
      if (_addingCpu) return  // synchronous module-level guard
      _addingCpu = true
      const { room, players, sessionId } = get()
      if (!room || room.host_id !== sessionId) { _addingCpu = false; return }
      if (players.length >= room.max_players) { _addingCpu = false; return }
      set({ isLoading: true, error: null })
      try {
        const cpuCount = players.filter(p => p.is_cpu).length
        const seatOrder = players.length + 1
        const color = PLAYER_COLORS[(seatOrder - 1) % PLAYER_COLORS.length]
        const { error } = await supabase.from('players').insert({
          room_id: room.id,
          session_id: `cpu-${crypto.randomUUID()}`,
          player_name: `CPU ${cpuCount + 1}`,
          player_color: color,
          seat_order: seatOrder,
          is_cpu: true,
          flower_count: 3,
          skull_count: 1,
          win_count: 0,
          is_eliminated: false,
        })
        if (error) throw error
        set({ isLoading: false })
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
      } finally {
        _addingCpu = false
      }
    },

    // ── placeDisc ─────────────────────────────────────────────────────────────
    placeDisc: async (discType) => {
      const { room, gameState, players, sessionId, isCpuGame, myDiscs, publicDiscs, _foldedPlayerIds } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      const round = gameState.round_number
      const position = publicDiscs.filter(
        d => d.player_id === myPlayer.id && d.round_number === round,
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
          },
        )
        const newPublicDiscs = [...publicDiscs, newDisc]

        // Force bid if all hands empty
        if (allHandsEmpty(updatedPlayers)) {
          const firstActive = [...updatedPlayers]
            .filter(p => !p.is_eliminated)
            .sort((a, b) => a.seat_order - b.seat_order)[0]
          set({
            myDiscs: [...myDiscs, newDisc],
            publicDiscs: newPublicDiscs,
            players: updatedPlayers,
            gameState: {
              ...gameState,
              phase: 'bid',
              current_player_id: firstActive?.id ?? null,
              updated_at: ts(),
            },
            _foldedPlayerIds: [],
          })
          await processCpuTurns()
          return
        }

        const next = getNextActivePlayer(updatedPlayers, myPlayer.id)
        set({
          myDiscs: [...myDiscs, newDisc],
          publicDiscs: newPublicDiscs,
          players: updatedPlayers,
          gameState: { ...gameState, current_player_id: next?.id ?? null, updated_at: ts() },
        })
        await processCpuTurns()
        return
      }

      // Online
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

        const updatedPlayers = players.map(p =>
          p.id !== myPlayer.id ? p : {
            ...p,
            flower_count: discType === 'flower' ? p.flower_count - 1 : p.flower_count,
            skull_count:  discType === 'skull'  ? p.skull_count  - 1 : p.skull_count,
          },
        )
        if (allHandsEmpty(updatedPlayers)) {
          const firstActive = [...updatedPlayers]
            .filter(p => !p.is_eliminated)
            .sort((a, b) => a.seat_order - b.seat_order)[0]
          await supabase.from('game_states').update({
            phase: 'bid',
            current_player_id: firstActive?.id ?? null,
            updated_at: ts(),
          }).eq('id', gameState.id)
          set({ isLoading: false, _foldedPlayerIds: [] })
        } else {
          // Skip empty-hand players; if no other player has cards, force bid
          // (current player will see the bid controller since allPlaced=true).
          const next = getNextPlayerWithHand(updatedPlayers, myPlayer.id)
          if (next === null) {
            await supabase.from('game_states').update({
              phase: 'bid', current_player_id: myPlayer.id, updated_at: ts(),
            }).eq('id', gameState.id)
            set({ isLoading: false, _foldedPlayerIds: [] })
          } else {
            await supabase.from('game_states').update({
              current_player_id: next.id, updated_at: ts(),
            }).eq('id', gameState.id)
            set({ isLoading: false, _foldedPlayerIds })
          }
        }
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
      }
    },

    // ── placeBid ──────────────────────────────────────────────────────────────
    placeBid: async (amount) => {
      const { room, gameState, players, sessionId, isCpuGame, _foldedPlayerIds, publicDiscs } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      const round = gameState.round_number
      const totalPlaced = publicDiscs.filter(d => d.round_number === round).length
      const nextPlayer = getNextActivePlayer(players, myPlayer.id, _foldedPlayerIds)
      // Max bid OR only bidder left → flip phase starts immediately
      const goToFlip = amount >= totalPlaced || !nextPlayer

      const updates = goToFlip ? {
        phase: 'flip' as const,
        highest_bid: amount,
        highest_bidder_id: myPlayer.id,
        current_player_id: myPlayer.id,
        updated_at: ts(),
      } : {
        phase: 'bid' as const,
        highest_bid: amount,
        highest_bidder_id: myPlayer.id,
        current_player_id: nextPlayer.id,
        updated_at: ts(),
      }

      if (isCpuGame) {
        set(s => ({
          gameState: { ...s.gameState!, ...updates },
          // Only clear folds when starting bid from place phase; preserve them on raises
          _foldedPlayerIds: gameState.phase === 'place' ? [] : _foldedPlayerIds,
        }))
        await processCpuTurns()
        return
      }

      set({ isLoading: true })
      try {
        const { error } = await supabase.from('game_states').update(updates).eq('id', gameState.id)
        if (error) throw error
        set({ isLoading: false, _foldedPlayerIds: gameState.phase === 'place' ? [] : _foldedPlayerIds })
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
      }
    },

    // ── fold ──────────────────────────────────────────────────────────────────
    fold: async () => {
      const { room, gameState, players, sessionId, isCpuGame, _foldedPlayerIds } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      const newFoldedIds = [..._foldedPlayerIds, myPlayer.id]
      const activePlayers = players.filter(p => !p.is_eliminated)
      const nonFolded = activePlayers.filter(p => !newFoldedIds.includes(p.id))
      const isChallenge = nonFolded.length <= 1

      if (isCpuGame) {
        if (isChallenge) {
          const challenger = players.find(p => p.id === gameState.highest_bidder_id) ?? null
          set(s => ({
            gameState: {
              ...s.gameState!,
              pass_count: s.gameState!.pass_count + 1,
              phase: 'flip',
              current_player_id: challenger?.id ?? null,
              updated_at: ts(),
            },
            _foldedPlayerIds: newFoldedIds,
          }))
          await processCpuTurns()
        } else {
          const next = getNextActivePlayer(players, myPlayer.id, newFoldedIds)
          set(s => ({
            gameState: {
              ...s.gameState!,
              pass_count: s.gameState!.pass_count + 1,
              current_player_id: next?.id ?? null,
              updated_at: ts(),
            },
            _foldedPlayerIds: newFoldedIds,
          }))
          await processCpuTurns()
        }
        return
      }

      // Online: use pass_count (authoritative in DB) for isChallenge — local
      // _foldedPlayerIds is not updated when other human guests fold.
      const isChallengeOnline = (gameState.pass_count + 1) >= (activePlayers.length - 1)
      set({ isLoading: true })
      try {
        const next = isChallengeOnline
          ? players.find(p => p.id === gameState.highest_bidder_id) ?? null
          : getNextActivePlayer(players, myPlayer.id, newFoldedIds)

        const updates = {
          pass_count: gameState.pass_count + 1,
          phase: (isChallengeOnline ? 'flip' : gameState.phase) as 'bid' | 'flip',
          current_player_id: next?.id ?? null,
          updated_at: ts(),
        }
        const { error } = await supabase.from('game_states').update(updates).eq('id', gameState.id)
        if (error) throw error
        set({ isLoading: false, _foldedPlayerIds: newFoldedIds })
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
      }
    },

    // ── flipDisc ──────────────────────────────────────────────────────────────
    flipDisc: async (discId): Promise<DiscType> => {
      const { room, gameState, players, sessionId, isCpuGame, myDiscs, _cpuDiscs } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return 'flower'

      const newFlipCount = gameState.flip_count + 1

      if (isCpuGame) {
        const realDisc = [...myDiscs, ..._cpuDiscs].find(d => d.id === discId)
        const realType = realDisc?.disc_type ?? 'flower'

        set(s => ({
          publicDiscs: s.publicDiscs.map(d =>
            d.id === discId
              ? { ...d, disc_type: realType, is_flipped: true, flipped_by: myPlayer.id }
              : d,
          ),
          myDiscs: s.myDiscs.map(d =>
            d.id === discId ? { ...d, is_flipped: true, flipped_by: myPlayer.id } : d,
          ),
          _cpuDiscs: s._cpuDiscs.map(d =>
            d.id === discId ? { ...d, is_flipped: true, flipped_by: myPlayer.id } : d,
          ),
          gameState: { ...s.gameState!, flip_count: newFlipCount, updated_at: ts() },
        }))

        return realType
      }

      // Online
      set({ isLoading: true })
      try {
        const { data: updatedDisc, error } = await supabase.from('placed_discs')
          .update({ is_flipped: true, flipped_by: myPlayer.id })
          .eq('id', discId)
          .select('disc_type')
          .single()
        if (error) throw error
        await supabase.from('game_states').update({
          flip_count: newFlipCount, updated_at: ts(),
        }).eq('id', gameState.id)
        // Update local flip_count immediately so handleFlip can read it before subscription fires
        set(s => ({ isLoading: false, gameState: s.gameState ? { ...s.gameState, flip_count: newFlipCount } : null }))
        return (updatedDisc?.disc_type as DiscType) ?? 'flower'
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
        return 'flower'
      }
    },

    // ── startCpuGame ──────────────────────────────────────────────────────────
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

      const initPermCards: Record<string, { flowers: number; skulls: number }> = {}
      for (const p of allPlayers) initPermCards[p.id] = { flowers: 3, skulls: 1 }

      set({
        room,
        players: allPlayers,
        gameState: initialGameState,
        myDiscs: [],
        publicDiscs: [],
        _cpuDiscs: [],
        _foldedPlayerIds: [],
        _permCards: initPermCards,
        isCpuGame: true,
        cpuDifficulty: difficulty as 'easy' | 'normal' | 'hard',
        _myPlayerId: humanId,
        isLoading: false,
      })

      await processCpuTurns()
    },

    // ── subscribeToRoom ───────────────────────────────────────────────────────
    subscribeToRoom: (_roomCode) => {
      const { _subscription, room, _myPlayerId } = get()
      if (_subscription) supabase.removeChannel(_subscription)
      if (!room) return

      const roomId = room.id
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null

      // Immediately fetch current players — don't wait for SUBSCRIBED event.
      // Handles the case where guests joined before the host opened the lobby.
      // Also seeds _permCards for guests who never ran startGame.
      supabase.from('players').select().eq('room_id', roomId).then(({ data }) => {
        if (!data || data.length === 0) return
        set(s => {
          const update: Partial<StoreState> = { players: data }
          if (Object.keys(s._permCards).length === 0) {
            const perm: Record<string, { flowers: number; skulls: number }> = {}
            for (const p of data) if (!p.is_eliminated) perm[p.id] = { flowers: p.flower_count, skulls: p.skull_count }
            update._permCards = perm
          }
          return update
        })
      })

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
            const p = payload.new as Player
            set(s => s.players.some(x => x.id === p.id)
              ? {}
              : { players: [...s.players, p] })
          } else if (payload.eventType === 'UPDATE') {
            set(s => ({
              players: s.players.map(p =>
                p.id === (payload.new as Player).id ? payload.new as Player : p,
              ),
            }))
          }
        })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'game_states', filter: `room_id=eq.${roomId}`,
        }, payload => {
          if (payload.eventType !== 'DELETE') {
            const newGs = payload.new as GameState
            const prevGs = get().gameState
            const roundChanged = prevGs != null && newGs.round_number !== prevGs.round_number

            // Infer folds from pass_count increase — keeps _foldedPlayerIds in sync
            // for all clients including guests who don't execute processOnlineCpuTurn.
            if (!roundChanged && prevGs && newGs.pass_count > prevGs.pass_count) {
              const foldedId = prevGs.current_player_id
              if (foldedId) {
                set(s => s._foldedPlayerIds.includes(foldedId)
                  ? {}
                  : { _foldedPlayerIds: [...s._foldedPlayerIds, foldedId] })
              }
            }

            set({
              gameState: newGs,
              ...(roundChanged ? { publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] } : {}),
            })

            // On round change, re-fetch players to pick up restored hand counts
            // and rebuild _permCards so every client (host + guests) has accurate
            // permanent card totals going into the new round.
            if (roundChanged) {
              supabase.from('players').select().eq('room_id', roomId).then(({ data }) => {
                if (!data || data.length === 0) return
                const permCards: Record<string, { flowers: number; skulls: number }> = {}
                for (const p of data) {
                  if (!p.is_eliminated) permCards[p.id] = { flowers: p.flower_count, skulls: p.skull_count }
                }
                set({ players: data, _permCards: permCards })
              })
            }

            // Host processes CPU turns and detects empty-hand human players
            const s = get()
            if (!s.isCpuGame && s.room?.host_id === s.sessionId) {
              const cp = s.players.find(p => p.id === newGs.current_player_id)
              if (cp?.is_cpu) {
                processOnlineCpuTurn(cp, newGs)
              } else if (cp && !cp.is_eliminated && newGs.phase === 'place') {
                // If local state already shows 0 cards, act immediately; otherwise
                // wait 800 ms for the players subscription to arrive then re-check.
                const check = () => {
                  const s2 = get()
                  const p2 = s2.players.find(p => p.id === cp.id)
                  if (p2 && p2.flower_count + p2.skull_count === 0) {
                    processOnlineEmptyHandTurn(p2, newGs)
                  }
                }
                if (cp.flower_count + cp.skull_count === 0) check()
                else setTimeout(check, 800)
              }
            }
          }
        })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'placed_discs', filter: `room_id=eq.${roomId}`,
        }, payload => {
          if (payload.eventType === 'DELETE') return
          const disc = payload.new as PlacedDisc
          const isOwn = disc.player_id === _myPlayerId
          const publicDisc: PlacedDisc = isOwn || disc.is_flipped
            ? disc
            : { ...disc, disc_type: 'flower' }

          if (payload.eventType === 'INSERT') {
            set(s => {
              // Dedup: subscription can fire twice (own insert + realtime echo)
              if (s.publicDiscs.some(d => d.id === disc.id)) return {}
              return {
                publicDiscs: [...s.publicDiscs, publicDisc],
                myDiscs: isOwn ? [...s.myDiscs, disc] : s.myDiscs,
              }
            })
          } else {
            set(s => ({
              publicDiscs: s.publicDiscs.map(d => d.id === disc.id ? publicDisc : d),
              myDiscs: isOwn ? s.myDiscs.map(d => d.id === disc.id ? disc : d) : s.myDiscs,
            }))
          }
        })
        .on('system', {}, evt => {
          if (evt.extension === 'postgres_changes') {
            if (evt.status === 'SUBSCRIBED') {
              if (reconnectTimer) clearTimeout(reconnectTimer)
              set({ isReconnecting: false })
              // Re-fetch players to catch anyone who joined during the subscription gap.
              // Also seeds _permCards for guests who never ran startGame.
              supabase.from('players').select().eq('room_id', roomId).then(({ data }) => {
                if (!data || data.length === 0) return
                set(s => {
                  const update: Partial<StoreState> = { players: data }
                  if (Object.keys(s._permCards).length === 0) {
                    const perm: Record<string, { flowers: number; skulls: number }> = {}
                    for (const p of data) if (!p.is_eliminated) perm[p.id] = { flowers: p.flower_count, skulls: p.skull_count }
                    update._permCards = perm
                  }
                  return update
                })
              })
              // Re-fetch placed_discs to catch any placements missed during the
              // subscription gap (e.g. between LobbyScreen sub teardown and GameScreen
              // sub becoming SUBSCRIBED). Without this, allPlaced is never true and
              // the bid phase never triggers for the player who missed the events.
              const currentRound = get().gameState?.round_number
              const myId = get()._myPlayerId
              if (currentRound != null) {
                supabase.from('placed_discs').select()
                  .eq('room_id', roomId).eq('round_number', currentRound)
                  .then(({ data }) => {
                    if (!data || data.length === 0) return
                    set(s => {
                      const existingIds = new Set(s.publicDiscs.map(d => d.id))
                      const fresh = data.filter(d => !existingIds.has(d.id))
                      if (fresh.length === 0) return {}
                      return {
                        publicDiscs: [
                          ...s.publicDiscs,
                          ...fresh.map(d =>
                            d.player_id === myId || d.is_flipped
                              ? d
                              : { ...d, disc_type: 'flower' as DiscType },
                          ),
                        ],
                        myDiscs: [
                          ...s.myDiscs,
                          ...fresh.filter(d => d.player_id === myId),
                        ],
                      }
                    })
                  })
              }
            } else if (evt.status === 'CHANNEL_ERROR' || evt.status === 'TIMED_OUT') {
              set({ isReconnecting: true })
              reconnectTimer = setTimeout(() => {
                const s = get()
                if (s._subscription) {
                  supabase.removeChannel(s._subscription)
                  s.subscribeToRoom(_roomCode)
                }
              }, 3000)
            }
          }
        })
        .subscribe()

      set({ _subscription: channel })
    },

    // ── advanceAfterChallenge ─────────────────────────────────────────────────
    // Called by UI after showing skull/success modal to human player.
    advanceAfterChallenge: async (result, _skullOwnerId) => {
      const { players, gameState, room, isCpuGame, sessionId } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      if (result === 'win') {
        const updatedPlayers = players.map(p =>
          p.id !== myPlayer.id ? p : { ...p, win_count: p.win_count + 1 },
        )
        const winner = getWinner(updatedPlayers)
        if (winner) {
          if (!isCpuGame) {
            // Online: push win_count to DB so other clients see the winner via subscription
            await supabase.from('players').update({ win_count: myPlayer.win_count + 1 }).eq('id', myPlayer.id)
          }
          set({ players: updatedPlayers })
          return
        }
        if (isCpuGame) {
          startNextRound(myPlayer.id, updatedPlayers, room, gameState)
          await processCpuTurns()
        } else {
          // Online: reconstruct perm from DB (placed_discs + current counts) instead of
          // _permCards, which is empty on guest clients and may be stale on the host.
          const { data: roundDiscs } = await supabase
            .from('placed_discs').select('player_id, disc_type')
            .eq('room_id', room.id).eq('round_number', gameState.round_number)
          const permFromDB: Record<string, { flowers: number; skulls: number }> = {}
          for (const p of updatedPlayers) {
            if (p.is_eliminated) continue
            const placed = (roundDiscs ?? []).filter(d => d.player_id === p.id)
            permFromDB[p.id] = {
              flowers: p.flower_count + placed.filter(d => d.disc_type === 'flower').length,
              skulls: p.skull_count + placed.filter(d => d.disc_type === 'skull').length,
            }
          }
          set({ _permCards: permFromDB })
          const resetPlayers = updatedPlayers.map(p => {
            if (p.is_eliminated) return p
            const perm = permFromDB[p.id]
            return perm ? { ...p, flower_count: perm.flowers, skull_count: perm.skulls } : p
          })
          await Promise.all(
            resetPlayers.filter(p => !p.is_eliminated).map(p =>
              supabase.from('players').update({
                flower_count: p.flower_count,
                skull_count: p.skull_count,
                ...(p.id === myPlayer.id ? { win_count: myPlayer.win_count + 1 } : {}),
              }).eq('id', p.id)
            )
          )
          const newRound = gameState.round_number + 1
          await supabase.from('game_states').update({
            round_number: newRound, phase: 'place',
            current_player_id: myPlayer.id,
            highest_bid: 0, highest_bidder_id: null,
            pass_count: 0, flip_count: 0, updated_at: ts(),
          }).eq('id', gameState.id)
          await supabase.from('placed_discs')
            .delete().eq('room_id', room.id).eq('round_number', gameState.round_number)
          set({ players: resetPlayers, publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] })
        }
      } else {
        // Challenge loss: remove one random card permanently.
        // CPU and online paths are separate because online must reconstruct perm
        // from DB to avoid using _permCards that was seeded from mid-round depleted counts.
        if (isCpuGame) {
          const { _permCards } = get()
          const currentPerm = _permCards[myPlayer.id] ?? { flowers: 3, skulls: 1 }
          const permTotal = currentPerm.flowers + currentPerm.skulls
          const loseSkull = permTotal > 0 && currentPerm.skulls > 0 && Math.random() < currentPerm.skulls / permTotal
          const newPerm = {
            flowers: loseSkull ? currentPerm.flowers : Math.max(0, currentPerm.flowers - 1),
            skulls:  loseSkull ? Math.max(0, currentPerm.skulls - 1) : currentPerm.skulls,
          }
          const isEliminated = newPerm.flowers + newPerm.skulls === 0
          const updatedPermCards = { ..._permCards, [myPlayer.id]: newPerm }
          const updatedPlayers = players.map(p => {
            if (p.id !== myPlayer.id) return p
            return { ...p, flower_count: newPerm.flowers, skull_count: newPerm.skulls, is_eliminated: isEliminated }
          })
          set({ _permCards: updatedPermCards })
          const winner = getWinner(updatedPlayers)
          if (winner) { set({ players: updatedPlayers }); return }
          const updatedMe = updatedPlayers.find(p => p.id === myPlayer.id)!
          const starterId = updatedMe.is_eliminated
            ? getNextActivePlayer(updatedPlayers, myPlayer.id)?.id ?? myPlayer.id
            : myPlayer.id
          startNextRound(starterId, updatedPlayers, room, gameState)
          await processCpuTurns()
        } else {
          // Online: fetch placed_discs first so skull-loss is computed from authoritative
          // perm values rather than _permCards which may be seeded from depleted counts.
          const { data: roundDiscs } = await supabase
            .from('placed_discs').select('player_id, disc_type')
            .eq('room_id', room.id).eq('round_number', gameState.round_number)
          const permFromDB: Record<string, { flowers: number; skulls: number }> = {}
          for (const p of players) {
            if (p.is_eliminated) continue
            const placed = (roundDiscs ?? []).filter(d => d.player_id === p.id)
            permFromDB[p.id] = {
              flowers: p.flower_count + placed.filter(d => d.disc_type === 'flower').length,
              skulls: p.skull_count + placed.filter(d => d.disc_type === 'skull').length,
            }
          }
          const currentPerm = permFromDB[myPlayer.id] ?? { flowers: 3, skulls: 1 }
          const permTotal = currentPerm.flowers + currentPerm.skulls
          const loseSkull = permTotal > 0 && currentPerm.skulls > 0 && Math.random() < currentPerm.skulls / permTotal
          const newPerm = {
            flowers: loseSkull ? currentPerm.flowers : Math.max(0, currentPerm.flowers - 1),
            skulls:  loseSkull ? Math.max(0, currentPerm.skulls - 1) : currentPerm.skulls,
          }
          const isEliminated = newPerm.flowers + newPerm.skulls === 0
          permFromDB[myPlayer.id] = newPerm
          set({ _permCards: permFromDB })
          const updatedPlayers = players.map(p => {
            if (p.id !== myPlayer.id) return p
            return { ...p, flower_count: newPerm.flowers, skull_count: newPerm.skulls, is_eliminated: isEliminated }
          })
          const winner = getWinner(updatedPlayers)
          if (winner) {
            // Online: push elimination to DB so other clients see the winner via subscription
            await supabase.from('players').update({
              flower_count: newPerm.flowers,
              skull_count: newPerm.skulls,
              is_eliminated: isEliminated,
            }).eq('id', myPlayer.id)
            set({ players: updatedPlayers })
            return
          }
          const updatedMe = updatedPlayers.find(p => p.id === myPlayer.id)!
          const starterId = updatedMe.is_eliminated
            ? getNextActivePlayer(updatedPlayers, myPlayer.id)?.id ?? myPlayer.id
            : myPlayer.id
          const resetPlayers = updatedPlayers.map(p => {
            if (p.is_eliminated) return p
            const perm = permFromDB[p.id]
            return perm ? { ...p, flower_count: perm.flowers, skull_count: perm.skulls } : p
          })
          await Promise.all(
            resetPlayers.filter(p => !p.is_eliminated).map(p =>
              supabase.from('players').update({
                flower_count: p.flower_count,
                skull_count: p.skull_count,
                ...(p.id === myPlayer.id ? { is_eliminated: p.is_eliminated } : {}),
              }).eq('id', p.id)
            )
          )
          const newRound = gameState.round_number + 1
          await supabase.from('game_states').update({
            round_number: newRound, phase: 'place',
            current_player_id: starterId,
            highest_bid: 0, highest_bidder_id: null,
            pass_count: 0, flip_count: 0, updated_at: ts(),
          }).eq('id', gameState.id)
          await supabase.from('placed_discs')
            .delete().eq('room_id', room.id).eq('round_number', gameState.round_number)
          set({ players: resetPlayers, publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] })
        }
      }
    },

    // ── unsubscribeFromRoom ───────────────────────────────────────────────────
    unsubscribeFromRoom: () => {
      const channel = get()._subscription
      if (channel) {
        supabase.removeChannel(channel)
        set({ _subscription: null })
      }
    },

    // ── resumeCpuTurns ────────────────────────────────────────────────────────
    // Re-trigger CPU processing after page comes back from background.
    resumeCpuTurns: async () => {
      const s = get()
      if (!s.isCpuGame || !s.gameState) return
      const current = s.players.find(p => p.id === s.gameState!.current_player_id)
      if (current?.is_cpu) await processCpuTurns()
    },

    // ── resetGame ─────────────────────────────────────────────────────────────
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
        _foldedPlayerIds: [],
        _permCards: {},
        isLoading: false,
        error: null,
        isCpuGame: false,
        cpuDifficulty: 'normal',
        isReconnecting: false,
        _subscription: null,
        _myPlayerId: null,
      })
    },
  }
})
