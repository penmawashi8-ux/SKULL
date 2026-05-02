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
  const active = [...players]
    .filter(p => !p.is_eliminated && !skipIds.includes(p.id))
    .sort((a, b) => a.seat_order - b.seat_order)
  if (active.length === 0) return null
  const all = [...players]
    .filter(p => !p.is_eliminated)
    .sort((a, b) => a.seat_order - b.seat_order)
  const idx = all.findIndex(p => p.id === currentPlayerId)
  // Walk forward until we find someone not in skipIds
  for (let i = 1; i <= all.length; i++) {
    const candidate = all[(idx + i) % all.length]
    if (!skipIds.includes(candidate.id)) return candidate
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
  flipDisc: (discId: string) => Promise<void>
  advanceAfterChallenge: (result: 'win' | 'loss', skullOwnerId?: string) => Promise<void>
  addCpuPlayer: () => Promise<void>
  startCpuGame: (playerName: string, cpuCount: number, difficulty: string) => Promise<void>
  subscribeToRoom: (roomCode: string) => void
  unsubscribeFromRoom: () => void
  resetGame: () => void
}

// Mutex to prevent concurrent online CPU turn processing
let _onlineCpuProcessing = false

export const useGameStore = create<StoreState>()((set, get) => {

  // ── helpers ──────────────────────────────────────────────────────────────────

  function allPlacedAtLeastOnce(players: Player[], discs: PlacedDisc[], round: number): boolean {
    const active = players.filter(p => !p.is_eliminated)
    return active.every(p => discs.some(d => d.player_id === p.id && d.round_number === round))
  }

  function allHandsEmpty(players: Player[]): boolean {
    return players.filter(p => !p.is_eliminated).every(p => p.flower_count + p.skull_count === 0)
  }

  // Remove one random card from a player's hand. Returns updated player.
  function loseRandomCard(player: Player): Player {
    const total = player.flower_count + player.skull_count
    if (total === 0) return player
    const loseSkull = player.skull_count > 0 && Math.random() < player.skull_count / total
    return {
      ...player,
      flower_count: loseSkull ? player.flower_count : Math.max(0, player.flower_count - 1),
      skull_count:  loseSkull ? Math.max(0, player.skull_count - 1) : player.skull_count,
    }
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
  async function processCpuTurns(): Promise<void> {
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
          await processCpuTurns()
          return
        }
        const next = getNextActivePlayer(players, currentPlayer.id)
        set(prev => ({
          gameState: { ...prev.gameState!, current_player_id: next?.id ?? null, updated_at: ts() },
        }))
        await processCpuTurns()
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
          await processCpuTurns()
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
        await processCpuTurns()
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
      await processCpuTurns()
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
          await processCpuTurns()
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
          await processCpuTurns()
        }
      } else {
        const next = getNextActivePlayer(players, currentPlayer.id, _foldedPlayerIds)
        set(prev => ({
          gameState: {
            ...prev.gameState!,
            highest_bid: result.amount!,
            highest_bidder_id: currentPlayer.id,
            current_player_id: next?.id ?? null,
            updated_at: ts(),
          },
          _cpuLog: { id: crypto.randomUUID(), message: `${currentPlayer.player_name} が ${result.amount} 枚と宣言`, type: 'bid' },
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
        const afterLoss = loseRandomCard(currentPlayer)
        const lostFlower = afterLoss.flower_count < currentPlayer.flower_count
        const currentPerm = freshState._permCards[currentPlayer.id] ?? { flowers: 3, skulls: 1 }
        const updatedPermCards = {
          ...freshState._permCards,
          [currentPlayer.id]: {
            flowers: lostFlower ? Math.max(0, currentPerm.flowers - 1) : currentPerm.flowers,
            skulls:  !lostFlower ? Math.max(0, currentPerm.skulls - 1) : currentPerm.skulls,
          },
        }
        const updatedPlayers = freshState.players.map(p => {
          if (p.id !== currentPlayer.id) return p
          return { ...afterLoss, is_eliminated: (afterLoss.flower_count + afterLoss.skull_count) === 0 }
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
          const starterId = updatedPlayers.find(p => p.id === realDisc.player_id)?.is_eliminated
            ? getNextActivePlayer(updatedPlayers, realDisc.player_id)?.id ?? currentPlayer.id
            : realDisc.player_id
          await new Promise(r => setTimeout(r, 1500))  // let user read the skull result
          startNextRound(starterId, updatedPlayers, freshState.room!, freshState.gameState!)
          await processCpuTurns()
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
          await processCpuTurns()
        }
        return
      }

      await processCpuTurns()
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
            const next = getNextActivePlayer(players, cpuPlayer.id)
            await supabase.from('game_states').update({ current_player_id: next?.id ?? null, updated_at: ts() }).eq('id', gs2.id)
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
          const next = getNextActivePlayer(updatedPlayers, cpuPlayer.id)
          await supabase.from('game_states').update({ current_player_id: next?.id ?? null, updated_at: ts() }).eq('id', gs2.id)
        }
        return
      }

      // ── bid ──────────────────────────────────────────────────────────────
      if (gs2.phase === 'bid') {
        const result = await cpuDecideBidOrFold(cpuPlayer, gs2, players, allReal, cpuDifficulty)
        const activePlayers = players.filter(p => !p.is_eliminated)
        const newFoldedIds = result.action === 'fold' ? [..._foldedPlayerIds, cpuPlayer.id] : _foldedPlayerIds
        const nonFolded = activePlayers.filter(p => !newFoldedIds.includes(p.id))
        const isChallenge = nonFolded.length <= 1

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
          const next = getNextActivePlayer(players, cpuPlayer.id, _foldedPlayerIds)
          await supabase.from('game_states').update({
            highest_bid: result.amount!, highest_bidder_id: cpuPlayer.id,
            current_player_id: next?.id ?? null, updated_at: ts(),
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
        set(prev => ({
          publicDiscs: prev.publicDiscs.map(d => d.id === targetId ? { ...d, disc_type: realDisc.disc_type, is_flipped: true } : d),
          _cpuDiscs: prev._cpuDiscs.map(d => d.id === targetId ? { ...d, is_flipped: true } : d),
          myDiscs: prev.myDiscs.map(d => d.id === targetId ? { ...d, is_flipped: true } : d),
        }))

        if (realDisc.disc_type === 'skull') {
          // CPU hit a skull — lose a random card
          const freshS = get()
          const afterLoss = loseRandomCard(cpuPlayer)
          const lostFlower = afterLoss.flower_count < cpuPlayer.flower_count
          const currentPerm = freshS._permCards[cpuPlayer.id] ?? { flowers: 3, skulls: 1 }
          const updatedPerm = {
            ...freshS._permCards,
            [cpuPlayer.id]: {
              flowers: lostFlower ? Math.max(0, currentPerm.flowers - 1) : currentPerm.flowers,
              skulls:  !lostFlower ? Math.max(0, currentPerm.skulls - 1) : currentPerm.skulls,
            },
          }
          const isEliminated = afterLoss.flower_count + afterLoss.skull_count === 0
          await supabase.from('players').update({ flower_count: afterLoss.flower_count, skull_count: afterLoss.skull_count, is_eliminated: isEliminated }).eq('id', cpuPlayer.id)
          const updatedPlayers = freshS.players.map(p => p.id !== cpuPlayer.id ? p : { ...afterLoss, is_eliminated: isEliminated })
          set({ players: updatedPlayers, _permCards: updatedPerm })
          const winner = getWinner(updatedPlayers)
          if (!winner) {
            const skullOwner = players.find(p => p.id === realDisc.player_id)
            const starterId = skullOwner?.is_eliminated ? getNextActivePlayer(updatedPlayers, realDisc.player_id)?.id ?? cpuPlayer.id : realDisc.player_id
            const newRound = gs2.round_number + 1
            const resetPlayers = updatedPlayers.map(p => {
              if (p.is_eliminated) return p
              const perm = updatedPerm[p.id]
              return perm ? { ...p, flower_count: perm.flowers, skull_count: perm.skulls } : p
            })
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
          set({ players: updatedPlayers })
          const winner = getWinner(updatedPlayers)
          if (!winner) {
            const newRound = gs2.round_number + 1
            const resetPlayers = updatedPlayers.map(p => {
              if (p.is_eliminated) return p
              const perm = freshS._permCards[p.id]
              return perm ? { ...p, flower_count: perm.flowers, skull_count: perm.skulls } : p
            })
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
      const { room, players, sessionId } = get()
      if (!room || room.host_id !== sessionId) return
      if (players.length >= room.max_players) return
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
        } else {
          const next = getNextActivePlayer(updatedPlayers, myPlayer.id)
          await supabase.from('game_states').update({
            current_player_id: next?.id ?? null, updated_at: ts(),
          }).eq('id', gameState.id)
        }
        set({ isLoading: false, _foldedPlayerIds })
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
      }
    },

    // ── placeBid ──────────────────────────────────────────────────────────────
    placeBid: async (amount) => {
      const { room, gameState, players, sessionId, isCpuGame, _foldedPlayerIds } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      const next = getNextActivePlayer(players, myPlayer.id, _foldedPlayerIds)
      const updates = {
        phase: 'bid' as const,
        highest_bid: amount,
        highest_bidder_id: myPlayer.id,
        current_player_id: next?.id ?? null,
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

      set({ isLoading: true })
      try {
        const next = isChallenge
          ? players.find(p => p.id === gameState.highest_bidder_id) ?? null
          : getNextActivePlayer(players, myPlayer.id, newFoldedIds)

        const updates = {
          pass_count: gameState.pass_count + 1,
          phase: (isChallenge ? 'flip' : gameState.phase) as 'bid' | 'flip',
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
    flipDisc: async (discId) => {
      const { room, gameState, players, sessionId, isCpuGame, myDiscs, _cpuDiscs } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

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

        // UI reads the flipped disc to show skull/success modal; don't process here for human turns
        return
      }

      // Online
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
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
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
            set({ gameState: newGs })
            // Host processes CPU turns in online+CPU hybrid mode
            const s = get()
            if (!s.isCpuGame && s.room?.host_id === s.sessionId) {
              const cp = s.players.find(p => p.id === newGs.current_player_id)
              if (cp?.is_cpu) processOnlineCpuTurn(cp, newGs)
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
        .on('system', {}, evt => {
          if (evt.extension === 'postgres_changes') {
            if (evt.status === 'SUBSCRIBED') {
              if (reconnectTimer) clearTimeout(reconnectTimer)
              set({ isReconnecting: false })
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
    advanceAfterChallenge: async (result, skullOwnerId) => {
      const { players, gameState, room, isCpuGame, sessionId } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState || !room) return

      if (result === 'win') {
        const updatedPlayers = players.map(p =>
          p.id !== myPlayer.id ? p : { ...p, win_count: p.win_count + 1 },
        )
        const winner = getWinner(updatedPlayers)
        if (winner) {
          set({ players: updatedPlayers })
          return // GameBoard will redirect via resetGame
        }
        if (isCpuGame) {
          startNextRound(myPlayer.id, updatedPlayers, room, gameState)
          await processCpuTurns()
        } else {
          // Online: update DB
          await supabase.from('players').update({ win_count: myPlayer.win_count + 1 }).eq('id', myPlayer.id)
          const newRound = gameState.round_number + 1
          await supabase.from('game_states').update({
            round_number: newRound, phase: 'place',
            current_player_id: myPlayer.id,
            highest_bid: 0, highest_bidder_id: null,
            pass_count: 0, flip_count: 0, updated_at: ts(),
          }).eq('id', gameState.id)
          await supabase.from('placed_discs')
            .delete().eq('room_id', room.id).eq('round_number', gameState.round_number)
          set({ players: updatedPlayers })
        }
      } else {
        // Challenge loss: remove one random card permanently
        const { _permCards } = get()
        const afterLoss = loseRandomCard(myPlayer)
        const lostFlower = afterLoss.flower_count < myPlayer.flower_count
        const currentPerm = _permCards[myPlayer.id] ?? { flowers: 3, skulls: 1 }
        const updatedPermCards = {
          ..._permCards,
          [myPlayer.id]: {
            flowers: lostFlower ? Math.max(0, currentPerm.flowers - 1) : currentPerm.flowers,
            skulls:  !lostFlower ? Math.max(0, currentPerm.skulls - 1) : currentPerm.skulls,
          },
        }
        const updatedPlayers = players.map(p => {
          if (p.id !== myPlayer.id) return p
          return { ...afterLoss, is_eliminated: (afterLoss.flower_count + afterLoss.skull_count) === 0 }
        })
        set({ _permCards: updatedPermCards })

        const winner = getWinner(updatedPlayers)
        if (winner) {
          set({ players: updatedPlayers })
          return
        }
        // Skull owner starts next round (if still alive), else fallback to next player
        const skullOwner = players.find(p => p.id === skullOwnerId)
        const starterId = skullOwner && !updatedPlayers.find(p => p.id === skullOwnerId)?.is_eliminated
          ? skullOwnerId!
          : getNextActivePlayer(updatedPlayers, myPlayer.id)?.id ?? myPlayer.id

        if (isCpuGame) {
          startNextRound(starterId, updatedPlayers, room, gameState)
          await processCpuTurns()
        } else {
          const updatedMe = updatedPlayers.find(p => p.id === myPlayer.id)!
          await supabase.from('players').update({
            flower_count: updatedMe.flower_count,
            skull_count: updatedMe.skull_count,
            is_eliminated: updatedMe.is_eliminated,
          }).eq('id', myPlayer.id)
          const newRound = gameState.round_number + 1
          await supabase.from('game_states').update({
            round_number: newRound, phase: 'place',
            current_player_id: starterId,
            highest_bid: 0, highest_bidder_id: null,
            pass_count: 0, flip_count: 0, updated_at: ts(),
          }).eq('id', gameState.id)
          await supabase.from('placed_discs')
            .delete().eq('room_id', room.id).eq('round_number', gameState.round_number)
          set({ players: updatedPlayers })
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
