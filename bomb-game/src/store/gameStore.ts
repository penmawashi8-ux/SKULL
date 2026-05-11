import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, getSessionId } from '../lib/supabase'
import { generateRoomCode, getInitialPlayerState, getWinner } from '../lib/gameEngine'
import { cpuDecidePlace, cpuDecideBidOrFold, cpuDecideFlipTarget } from '../lib/cpuAI'
import type { Room, Player, GameState, PlacedDisc, DiscType, PlayerColor, EmoteType } from '../types/game'

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
  _foldedPlayerIds: string[]
  _permCards: Record<string, { flowers: number; bombs: number }>
  _cpuLog: { id: string; message: string; type: 'place' | 'bid' | 'fold' | 'flip' | 'result' } | null

  createRoom: (playerName: string, maxPlayers: number) => Promise<string>
  joinRoom: (roomCode: string, playerName: string) => Promise<void>
  startGame: () => Promise<void>
  placeDisc: (discType: DiscType) => Promise<void>
  placeBid: (amount: number) => Promise<void>
  fold: () => Promise<void>
  flipDisc: (discId: string) => Promise<DiscType>
  advanceAfterChallenge: (result: 'win' | 'loss', bombOwnerId?: string) => Promise<void>
  addCpuPlayer: () => Promise<void>
  startCpuGame: (playerName: string, cpuCount: number, difficulty: string) => Promise<void>
  subscribeToRoom: (roomCode: string) => void
  unsubscribeFromRoom: () => void
  resetGame: () => void
  resumeCpuTurns: () => Promise<void>
  sendEmote: (type: EmoteType) => Promise<void>
}

// Mutex to prevent concurrent online CPU turn processing
let _onlineCpuProcessing = false
// When realtime fires while _onlineCpuProcessing is true, store the pending trigger here
let _pendingCpuRetrigger: { player: Player; gs: GameState } | null = null
// Mutex to prevent concurrent local CPU turn processing
let _cpuRunning = false
// Mutex to prevent concurrent addCpuPlayer calls (module-level for synchronous block)
let _addingCpu = false
// Mutex to prevent double-placing a disc (spam taps in online mode)
let _placingDisc = false

export const useGameStore = create<StoreState>()((set, get) => {

  // ── helpers ──────────────────────────────────────────────────────────────────

  function allPlacedAtLeastOnce(players: Player[], discs: PlacedDisc[], round: number): boolean {
    const active = players.filter(p => !p.is_eliminated)
    return active.every(p => discs.some(d => d.player_id === p.id && d.round_number === round))
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
      turn_started_at: ts(),
      last_emote: null,
      updated_at: ts(),
    }
    // Restore hand to permanent totals (respects cards lost to bombs)
    const { _permCards } = get()
    const resetPlayers = playersIn.map(p => {
      if (p.is_eliminated) return p
      const perm = _permCards[p.id] ?? { flowers: 3, bombs: 1 }
      return { ...p, flower_count: Math.min(3, perm.flowers), bomb_count: Math.min(1, perm.bombs) }
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
      const hasHand = currentPlayer.flower_count + currentPlayer.bomb_count > 0
      const placed = allPlacedAtLeastOnce(players, publicDiscs, round)

      // If no hand left: skip turn so the human can bid on their own turn
      if (!hasHand) {
        const next = getNextActivePlayer(players, currentPlayer.id)
        set(prev => ({
          gameState: { ...prev.gameState!, current_player_id: next?.id ?? null, turn_started_at: ts(), updated_at: ts() },
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
              turn_started_at: ts(),
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
          bomb_count:   discType === 'bomb'   ? p.bomb_count   - 1 : p.bomb_count,
        },
      )

      const cpuPlaceLog = { id: crypto.randomUUID(), message: `${currentPlayer.player_name} がカードを置いた`, type: 'place' as const }

      const next = getNextActivePlayer(updatedPlayers, currentPlayer.id)
      const cpuEmote = Math.random() < 0.4
        ? { playerId: currentPlayer.id, type: (Math.random() < 0.5 ? 'BOMB' : 'FLOWER') as EmoteType, sentAt: ts() }
        : null

      set(prev => ({
        players: updatedPlayers,
        publicDiscs: [...prev.publicDiscs, maskedDisc],
        _cpuDiscs: [...prev._cpuDiscs, realDisc],
        gameState: {
          ...prev.gameState!,
          current_player_id: next?.id ?? null,
          turn_started_at: ts(),
          updated_at: ts(),
          ...(cpuEmote ? { last_emote: cpuEmote } : {}),
        },
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
          if (!challenger) {
            // highest_bidder_id が null のまま flip 移行するとフリーズするので bid を継続
            const next = getNextActivePlayer(players, currentPlayer.id, newFoldedIds)
            set(prev => ({
              gameState: { ...prev.gameState!, current_player_id: next?.id ?? currentPlayer.id, turn_started_at: ts(), updated_at: ts() },
              _cpuLog: foldLog,
            }))
            await _runCpuLoop()
            return
          }
          set(prev => ({
            gameState: {
              ...prev.gameState!,
              pass_count: prev.gameState!.pass_count + 1,
              phase: 'flip',
              current_player_id: challenger.id,
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
              turn_started_at: ts(),
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
            turn_started_at: ts(),
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

      const flipLog = realDisc.disc_type === 'bomb'
        ? { id: crypto.randomUUID(), message: `💣 ${currentPlayer.player_name} が爆弾を踏んだ！`, type: 'result' as const }
        : { id: crypto.randomUUID(), message: `🍎 ${currentPlayer.player_name} がカードをめくった`, type: 'flip' as const }

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

      if (realDisc.disc_type === 'bomb') {
        // CPU challenger hit a bomb — lose a random card permanently
        const freshState = get()
        const currentPerm = freshState._permCards[currentPlayer.id] ?? { flowers: 3, bombs: 1 }
        const permTotal = currentPerm.flowers + currentPerm.bombs
        const loseBomb = permTotal > 0 && currentPerm.bombs > 0 && Math.random() < currentPerm.bombs / permTotal
        const newPerm = {
          flowers: loseBomb ? currentPerm.flowers : Math.max(0, currentPerm.flowers - 1),
          bombs:   loseBomb ? Math.max(0, currentPerm.bombs - 1) : currentPerm.bombs,
        }
        const isEliminated = newPerm.flowers + newPerm.bombs === 0
        const updatedPermCards = { ...freshState._permCards, [currentPlayer.id]: newPerm }
        const updatedPlayers = freshState.players.map(p => {
          if (p.id !== currentPlayer.id) return p
          return { ...p, flower_count: newPerm.flowers, bomb_count: newPerm.bombs, is_eliminated: isEliminated }
        })
        const winner = getWinner(updatedPlayers)
        set({
          players: updatedPlayers,
          _permCards: updatedPermCards,
          gameState: winner
            ? { ...freshState.gameState!, phase: 'place', updated_at: ts() }
            : freshState.gameState,
          _cpuLog: { id: crypto.randomUUID(), message: `💣 ${currentPlayer.player_name} が爆弾を踏んだ！カードを1枚失った`, type: 'result' },
        })
        if (!winner) {
          const failedChallenger = updatedPlayers.find(p => p.id === currentPlayer.id)
          const starterId = failedChallenger?.is_eliminated
            ? getNextActivePlayer(updatedPlayers, currentPlayer.id)?.id ?? currentPlayer.id
            : currentPlayer.id
          await new Promise(r => setTimeout(r, 1500))
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
          _cpuLog: { id: crypto.randomUUID(), message: `🍎 ${currentPlayer.player_name} がチャレンジ成功！`, type: 'result' },
        })
        if (!winner) {
          await new Promise(r => setTimeout(r, 1500))
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
      const gs2 = s.gameState

      // ── place ────────────────────────────────────────────────────────────
      if (gs2.phase === 'place') {
        const hasHand = cpuPlayer.flower_count + cpuPlayer.bomb_count > 0
        const placed = allPlacedAtLeastOnce(players, publicDiscs, round)

        if (!hasHand) {
          const next = getNextActivePlayer(players, cpuPlayer.id)
          await supabase.from('game_states').update({ current_player_id: next?.id ?? null, turn_started_at: ts(), updated_at: ts() }).eq('id', gs2.id)
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
              current_player_id: next?.id ?? null, turn_started_at: ts(), updated_at: ts(),
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
        const newBomb   = discType === 'bomb'   ? cpuPlayer.bomb_count   - 1 : cpuPlayer.bomb_count
        await supabase.from('players').update({ flower_count: newFlower, bomb_count: newBomb }).eq('id', cpuPlayer.id)
        set(prev => ({
          players: prev.players.map(p => p.id !== cpuPlayer.id ? p : { ...p, flower_count: newFlower, bomb_count: newBomb }),
          _cpuLog: { id: crypto.randomUUID(), message: `${cpuPlayer.player_name} がカードを置いた`, type: 'place' },
        }))

        const cpuEmote = Math.random() < 0.4
          ? { playerId: cpuPlayer.id, type: (Math.random() < 0.5 ? 'BOMB' : 'FLOWER') as EmoteType, sentAt: ts() }
          : null

        const updatedPlayers = players.map(p => p.id !== cpuPlayer.id ? p : { ...p, flower_count: newFlower, bomb_count: newBomb })
        const next = getNextActivePlayer(updatedPlayers, cpuPlayer.id)
        await supabase.from('game_states').update({ current_player_id: next?.id ?? null, turn_started_at: ts(), updated_at: ts(), ...(cpuEmote ? { last_emote: cpuEmote } : {}) }).eq('id', gs2.id)
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
              pass_count: gs2.pass_count + 1, current_player_id: next?.id ?? null, turn_started_at: ts(), updated_at: ts(),
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
            turn_started_at: ts(), updated_at: ts(),
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

        const flipLog = realDisc.disc_type === 'bomb'
          ? { id: crypto.randomUUID(), message: `💣 ${cpuPlayer.player_name} が爆弾を踏んだ！`, type: 'result' as const }
          : { id: crypto.randomUUID(), message: `🍎 ${cpuPlayer.player_name} がカードをめくった`, type: 'flip' as const }

        set(prev => ({
          publicDiscs: prev.publicDiscs.map(d => d.id === targetId ? { ...d, disc_type: realDisc.disc_type, is_flipped: true } : d),
          _cpuDiscs: prev._cpuDiscs.map(d => d.id === targetId ? { ...d, is_flipped: true } : d),
          myDiscs: prev.myDiscs.map(d => d.id === targetId ? { ...d, is_flipped: true } : d),
          _cpuLog: flipLog,
        }))

        if (realDisc.disc_type === 'bomb') {
          // CPU hit a bomb — lose a random card
          const freshS = get()
          const currentPerm = freshS._permCards[cpuPlayer.id] ?? { flowers: 3, bombs: 1 }
          const permTotal = currentPerm.flowers + currentPerm.bombs
          const loseBomb = permTotal > 0 && currentPerm.bombs > 0 && Math.random() < currentPerm.bombs / permTotal
          const newPerm = {
            flowers: loseBomb ? currentPerm.flowers : Math.max(0, currentPerm.flowers - 1),
            bombs:   loseBomb ? Math.max(0, currentPerm.bombs - 1) : currentPerm.bombs,
          }
          const isEliminated = newPerm.flowers + newPerm.bombs === 0
          const updatedPerm = { ...freshS._permCards, [cpuPlayer.id]: newPerm }
          await supabase.from('players').update({ flower_count: newPerm.flowers, bomb_count: newPerm.bombs, is_eliminated: isEliminated }).eq('id', cpuPlayer.id)
          const updatedPlayers = freshS.players.map(p => p.id !== cpuPlayer.id ? p : { ...p, flower_count: newPerm.flowers, bomb_count: newPerm.bombs, is_eliminated: isEliminated })
          set({
            players: updatedPlayers,
            _permCards: updatedPerm,
            _cpuLog: { id: crypto.randomUUID(), message: `💣 ${cpuPlayer.player_name} が爆弾を踏んだ！カードを1枚失った`, type: 'result' },
          })
          const winner = getWinner(updatedPlayers)
          if (!winner) {
            const failedChallenger = updatedPlayers.find(p => p.id === cpuPlayer.id)
            const starterId = failedChallenger?.is_eliminated
              ? getNextActivePlayer(updatedPlayers, cpuPlayer.id)?.id ?? cpuPlayer.id
              : cpuPlayer.id
            const newRound = gs2.round_number + 1
            const resetPlayers = updatedPlayers.map(p => {
              if (p.is_eliminated) return p
              const perm = updatedPerm[p.id] ?? { flowers: 3, bombs: 1 }
              return { ...p, flower_count: Math.min(3, perm.flowers), bomb_count: Math.min(1, perm.bombs) }
            })
            await new Promise(r => setTimeout(r, 1500))
            await supabase.from('placed_discs').delete().eq('room_id', room.id).eq('round_number', gs2.round_number)
            await Promise.all(resetPlayers.filter(p => !p.is_eliminated).map(p =>
              supabase.from('players').update({ flower_count: p.flower_count, bomb_count: p.bomb_count }).eq('id', p.id)
            ))
            await supabase.from('game_states').update({
              round_number: newRound, phase: 'place', current_player_id: starterId,
              highest_bid: 0, highest_bidder_id: null, pass_count: 0, flip_count: 0,
              turn_started_at: ts(), last_emote: null, updated_at: ts(),
            }).eq('id', gs2.id)
            set({ players: resetPlayers, publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] })
          }
        } else if (newFlipCount >= gs2.highest_bid) {
          // CPU challenge succeeded
          await supabase.from('players').update({ win_count: cpuPlayer.win_count + 1 }).eq('id', cpuPlayer.id)
          const freshS = get()
          const updatedPlayers = freshS.players.map(p => p.id !== cpuPlayer.id ? p : { ...p, win_count: p.win_count + 1 })
          set({
            players: updatedPlayers,
            _cpuLog: { id: crypto.randomUUID(), message: `🍎 ${cpuPlayer.player_name} がチャレンジ成功！`, type: 'result' },
          })
          const winner = getWinner(updatedPlayers)
          if (!winner) {
            const newRound = gs2.round_number + 1
            const resetPlayers = updatedPlayers.map(p => {
              if (p.is_eliminated) return p
              const perm = freshS._permCards[p.id] ?? { flowers: 3, bombs: 1 }
              return { ...p, flower_count: Math.min(3, perm.flowers), bomb_count: Math.min(1, perm.bombs) }
            })
            await new Promise(r => setTimeout(r, 1500))
            await supabase.from('placed_discs').delete().eq('room_id', room.id).eq('round_number', gs2.round_number)
            await Promise.all(resetPlayers.filter(p => !p.is_eliminated).map(p =>
              supabase.from('players').update({ flower_count: p.flower_count, bomb_count: p.bomb_count }).eq('id', p.id)
            ))
            await supabase.from('game_states').update({
              round_number: newRound, phase: 'place', current_player_id: cpuPlayer.id,
              highest_bid: 0, highest_bidder_id: null, pass_count: 0, flip_count: 0,
              turn_started_at: ts(), last_emote: null, updated_at: ts(),
            }).eq('id', gs2.id)
            set({ players: resetPlayers, publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] })
          }
        }
      }
    } finally {
      _onlineCpuProcessing = false
      // If the realtime event arrived while we were processing, it was blocked by
      // _onlineCpuProcessing. Re-fire it now so the next CPU turn isn't dropped.
      const retrigger = _pendingCpuRetrigger
      _pendingCpuRetrigger = null
      if (retrigger) {
        const freshGs = get().gameState
        const freshPlayer = get().players.find(p => p.id === retrigger.player.id)
        if (
          freshGs &&
          freshPlayer &&
          freshGs.current_player_id === retrigger.gs.current_player_id &&
          freshGs.round_number === retrigger.gs.round_number
        ) {
          processOnlineCpuTurn(freshPlayer, freshGs)
        }
      }
    }
  }

  // ── processOnlineEmptyHandTurn ────────────────────────────────────────────
  async function processOnlineEmptyHandTurn(player: Player, gs: GameState): Promise<void> {
    if (_onlineCpuProcessing) return
    _onlineCpuProcessing = true
    try {
      const s = get()
      if (!s.room || s.isCpuGame || !s.gameState) return
      if (s.gameState.current_player_id !== player.id || s.gameState.phase !== 'place') return

      const { data: freshPlayers } = await supabase.from('players').select().eq('room_id', s.room.id)
      if (!freshPlayers) return

      const s2 = get()
      if (!s2.gameState || s2.gameState.current_player_id !== player.id || s2.gameState.phase !== 'place') return

      const freshPlayer = freshPlayers.find(p => p.id === player.id)
      if (!freshPlayer || freshPlayer.flower_count + freshPlayer.bomb_count > 0) return

      const { data: freshDiscs } = await supabase.from('placed_discs').select().eq('room_id', s.room!.id)
      const placed = allPlacedAtLeastOnce(freshPlayers, freshDiscs ?? [], gs.round_number)

      // If allPlaced, the human player must bid — leave the turn as-is and let them use the BidController
      if (placed) return

      const next = getNextActivePlayer(freshPlayers, freshPlayer.id)
      await supabase.from('game_states').update({
        current_player_id: next?.id ?? null, turn_started_at: ts(), updated_at: ts(),
      }).eq('id', gs.id)
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
            turn_started_at: new Date().toISOString(),
          })
          .select().single()
        if (gsErr) throw gsErr

        await supabase.from('rooms').update({ status: 'playing' }).eq('id', room.id)
        const initPerm: Record<string, { flowers: number; bombs: number }> = {}
        for (const p of players) initPerm[p.id] = { flowers: p.flower_count, bombs: p.bomb_count }
        set({ gameState: gs, room: { ...room, status: 'playing' }, isLoading: false, _permCards: initPerm, _cpuDiscs: [] })
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
        throw e
      }
    },

    // ── addCpuPlayer ──────────────────────────────────────────────────────────
    addCpuPlayer: async () => {
      if (_addingCpu) return
      _addingCpu = true
      const { room, players, sessionId } = get()
      if (!room || room.host_id !== sessionId) { _addingCpu = false; return }
      if (players.length >= room.max_players) { _addingCpu = false; return }
      set({ isLoading: true, error: null })
      try {
        const cpuCount = players.filter(p => p.is_cpu).length
        const seatOrder = players.length + 1
        const color = PLAYER_COLORS[(seatOrder - 1) % PLAYER_COLORS.length]
        const { data: newPlayer, error } = await supabase.from('players').insert({
          room_id: room.id,
          session_id: `cpu-${crypto.randomUUID()}`,
          player_name: `CPU ${cpuCount + 1}`,
          player_color: color,
          seat_order: seatOrder,
          is_cpu: true,
          flower_count: 3,
          bomb_count: 1,
          win_count: 0,
          is_eliminated: false,
        }).select().single()
        if (error) throw error
        // Update local state immediately so the next sequential addCpuPlayer
        // call sees the correct players count before the realtime event arrives
        set(s => ({
          isLoading: false,
          players: s.players.some(x => x.id === newPlayer.id)
            ? s.players
            : [...s.players, newPlayer],
        }))
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
      } finally {
        _addingCpu = false
      }
    },

    // ── placeDisc ─────────────────────────────────────────────────────────────
    placeDisc: async (discType) => {
      const { room, gameState, players, sessionId, isCpuGame, myDiscs, publicDiscs } = get()
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
            bomb_count:   discType === 'bomb'   ? p.bomb_count   - 1 : p.bomb_count,
          },
        )
        const newPublicDiscs = [...publicDiscs, newDisc]

        const next = getNextActivePlayer(updatedPlayers, myPlayer.id)
        set({
          myDiscs: [...myDiscs, newDisc],
          publicDiscs: newPublicDiscs,
          players: updatedPlayers,
          gameState: { ...gameState, current_player_id: next?.id ?? null, turn_started_at: ts(), updated_at: ts() },
        })
        await processCpuTurns()
        return
      }

      // Online
      if (_placingDisc) return
      _placingDisc = true
      set({ isLoading: true })
      try {
        await supabase.from('placed_discs').insert({
          room_id: room.id, player_id: myPlayer.id,
          round_number: round, disc_type: discType, position,
        })
        await supabase.from('players').update({
          flower_count: discType === 'flower' ? myPlayer.flower_count - 1 : myPlayer.flower_count,
          bomb_count:   discType === 'bomb'   ? myPlayer.bomb_count   - 1 : myPlayer.bomb_count,
        }).eq('id', myPlayer.id)

        const updatedPlayers = players.map(p =>
          p.id !== myPlayer.id ? p : {
            ...p,
            flower_count: discType === 'flower' ? p.flower_count - 1 : p.flower_count,
            bomb_count:   discType === 'bomb'   ? p.bomb_count   - 1 : p.bomb_count,
          },
        )
        const next = getNextActivePlayer(updatedPlayers, myPlayer.id)
        await supabase.from('game_states').update({
          current_player_id: next?.id ?? null, turn_started_at: ts(), updated_at: ts(),
        }).eq('id', gameState.id)
        set({ isLoading: false, _foldedPlayerIds: [] })
      } catch (e) {
        set({ error: (e as any)?.message ?? String(e), isLoading: false })
      } finally {
        _placingDisc = false
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
      const goToFlip = amount >= totalPlaced || !nextPlayer

      const updates = goToFlip ? {
        phase: 'flip' as const,
        highest_bid: amount,
        highest_bidder_id: myPlayer.id,
        current_player_id: myPlayer.id,
        turn_started_at: ts(),
        updated_at: ts(),
      } : {
        phase: 'bid' as const,
        highest_bid: amount,
        highest_bidder_id: myPlayer.id,
        current_player_id: nextPlayer.id,
        turn_started_at: ts(),
        updated_at: ts(),
      }

      if (isCpuGame) {
        set(s => ({
          gameState: { ...s.gameState!, ...updates },
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
          if (!challenger) {
            // highest_bidder_id が null → フリーズ防止のため次プレイヤーへ継続
            const next = getNextActivePlayer(players, myPlayer.id, newFoldedIds)
            set(s => ({
              gameState: { ...s.gameState!, current_player_id: next?.id ?? myPlayer.id, turn_started_at: ts(), updated_at: ts() },
              _foldedPlayerIds: newFoldedIds,
            }))
            await processCpuTurns()
            return
          }
          set(s => ({
            gameState: {
              ...s.gameState!,
              pass_count: s.gameState!.pass_count + 1,
              phase: 'flip',
              current_player_id: challenger.id,
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
              turn_started_at: ts(),
              updated_at: ts(),
            },
            _foldedPlayerIds: newFoldedIds,
          }))
          await processCpuTurns()
        }
        return
      }

      // Online: use pass_count (authoritative in DB) for isChallenge
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
          turn_started_at: ts(),
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
          gameState: { ...s.gameState!, flip_count: newFlipCount, turn_started_at: ts(), updated_at: ts() },
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
          flip_count: newFlipCount, turn_started_at: ts(), updated_at: ts(),
        }).eq('id', gameState.id)
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
        turn_started_at: ts(),
        last_emote: null,
        created_at: ts(),
        updated_at: ts(),
      }

      const initPermCards: Record<string, { flowers: number; bombs: number }> = {}
      for (const p of allPlayers) initPermCards[p.id] = { flowers: 3, bombs: 1 }

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

      _cpuRunning = false
      await processCpuTurns()
    },

    // ── subscribeToRoom ───────────────────────────────────────────────────────
    subscribeToRoom: (_roomCode) => {
      const { _subscription, room, _myPlayerId } = get()
      if (_subscription) supabase.removeChannel(_subscription)
      if (!room) return

      const roomId = room.id
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null

      supabase.from('players').select().eq('room_id', roomId).then(({ data }) => {
        if (!data || data.length === 0) return
        // 別ルームへ移動済みの場合は古いフェッチ結果を捨てる
        if (get().room?.id !== roomId) return
        set({ players: data })
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
              ...(roundChanged ? { publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [], _permCards: {} } : {}),
            })

            if (roundChanged) {
              supabase.from('players').select().eq('room_id', roomId).then(({ data }) => {
                if (!data || data.length === 0) return
                if (get().room?.id !== roomId) return
                const permCards: Record<string, { flowers: number; bombs: number }> = {}
                for (const p of data) {
                  if (!p.is_eliminated) permCards[p.id] = { flowers: p.flower_count, bombs: p.bomb_count }
                }
                set({ players: data, _permCards: permCards })
              })
            }

            // ゲーム開始時 (prevGs === null) にもプレイヤー一覧を最新化する。
            // ロビーで追加されたCPUが realtime でまだ届いていない場合に
            // current_player_id が不明になりフリーズするのを防ぐ。
            // また、再接続直後など prevGs が存在しても current_player_id が
            // ローカルの players に見つからない場合も再フェッチする。
            const needsPlayerRefetch = (() => {
              if (prevGs === null) return true
              if (!newGs.current_player_id) return false
              const freshState = get()
              return freshState.players.length > 0 &&
                !freshState.players.some(p => p.id === newGs.current_player_id)
            })()
            if (needsPlayerRefetch) {
              supabase.from('players').select().eq('room_id', roomId).then(({ data }) => {
                if (!data || data.length === 0) return
                if (get().room?.id !== roomId) return
                const permCards: Record<string, { flowers: number; bombs: number }> = {}
                for (const p of data) {
                  if (!p.is_eliminated) permCards[p.id] = { flowers: p.flower_count, bombs: p.bomb_count }
                }
                set(s => ({
                  players: data,
                  _permCards: Object.keys(s._permCards).length === 0 ? permCards : s._permCards,
                }))
                // プレイヤー一覧更新後、ホストがCPUターンを再チェック
                const s2 = get()
                if (!s2.isCpuGame && s2.room?.host_id === s2.sessionId) {
                  const cp2 = data.find(p => p.id === newGs.current_player_id)
                  if (cp2?.is_cpu && !_onlineCpuProcessing) processOnlineCpuTurn(cp2, newGs)
                }
              })
            }

            // Host processes CPU turns and detects empty-hand human players
            const s = get()
            if (!s.isCpuGame && s.room?.host_id === s.sessionId) {
              const cp = s.players.find(p => p.id === newGs.current_player_id)
              if (cp?.is_cpu) {
                if (_onlineCpuProcessing) {
                  // Still finishing the previous turn — store so finally can re-fire
                  _pendingCpuRetrigger = { player: cp, gs: newGs }
                } else {
                  processOnlineCpuTurn(cp, newGs)
                }
              } else if (cp && !cp.is_eliminated && newGs.phase === 'place') {
                const check = () => {
                  const s2 = get()
                  const p2 = s2.players.find(p => p.id === cp.id)
                  if (p2 && p2.flower_count + p2.bomb_count === 0) {
                    processOnlineEmptyHandTurn(p2, newGs)
                  }
                }
                if (cp.flower_count + cp.bomb_count === 0) check()
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
              supabase.from('players').select().eq('room_id', roomId).then(({ data }) => {
                if (!data || data.length === 0) return
                if (get().room?.id !== roomId) return
                set({ players: data })
              })
              const currentRound = get().gameState?.round_number
              const myId = get()._myPlayerId
              if (currentRound != null) {
                supabase.from('placed_discs').select()
                  .eq('room_id', roomId).eq('round_number', currentRound)
                  .then(({ data: placed }) => {
                    if (get().room?.id !== roomId) return
                    set(s => {
                      let permUpdate: Partial<StoreState> = {}
                      if (Object.keys(s._permCards).length === 0) {
                        const counts: Record<string, { flowers: number; bombs: number }> = {}
                        for (const d of (placed ?? [])) {
                          if (!counts[d.player_id]) counts[d.player_id] = { flowers: 0, bombs: 0 }
                          if (d.disc_type === 'bomb') counts[d.player_id].bombs++
                          else counts[d.player_id].flowers++
                        }
                        const perm: Record<string, { flowers: number; bombs: number }> = {}
                        for (const p of s.players) {
                          if (!p.is_eliminated) {
                            const c = counts[p.id] ?? { flowers: 0, bombs: 0 }
                            perm[p.id] = { flowers: p.flower_count + c.flowers, bombs: p.bomb_count + c.bombs }
                          }
                        }
                        permUpdate = { _permCards: perm }
                      }
                      if (!placed || placed.length === 0) return permUpdate
                      const existingIds = new Set(s.publicDiscs.map(d => d.id))
                      const fresh = placed.filter(d => !existingIds.has(d.id))
                      if (fresh.length === 0) return permUpdate
                      return {
                        ...permUpdate,
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
              // 再接続後にゲーム状態が変わっていた場合に備えて最新を取得する
              supabase.from('game_states').select().eq('room_id', roomId).maybeSingle().then(({ data: freshGs }) => {
                if (!freshGs || get().room?.id !== roomId) return
                const localGs = get().gameState
                if (!localGs || freshGs.updated_at !== localGs.updated_at) {
                  const roundChanged = localGs != null && freshGs.round_number !== localGs.round_number
                  set({
                    gameState: freshGs,
                    ...(roundChanged ? { publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] } : {}),
                  })
                  const s2 = get()
                  if (!s2.isCpuGame && s2.room?.host_id === s2.sessionId) {
                    const cp = s2.players.find(p => p.id === freshGs.current_player_id)
                    if (cp?.is_cpu && !_onlineCpuProcessing) processOnlineCpuTurn(cp, freshGs)
                  }
                }
              })
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
    advanceAfterChallenge: async (result, _bombOwnerId) => {
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
            await supabase.from('players').update({ win_count: myPlayer.win_count + 1 }).eq('id', myPlayer.id)
          }
          set({ players: updatedPlayers })
          return
        }
        if (isCpuGame) {
          startNextRound(myPlayer.id, updatedPlayers, room, gameState)
          await processCpuTurns()
        } else {
          const { data: roundDiscs } = await supabase
            .from('placed_discs').select('player_id, disc_type')
            .eq('room_id', room.id).eq('round_number', gameState.round_number)
          const permFromDB: Record<string, { flowers: number; bombs: number }> = {}
          for (const p of updatedPlayers) {
            if (p.is_eliminated) continue
            const placed = (roundDiscs ?? []).filter(d => d.player_id === p.id)
            permFromDB[p.id] = {
              flowers: p.flower_count + placed.filter(d => d.disc_type === 'flower').length,
              bombs:   p.bomb_count   + placed.filter(d => d.disc_type === 'bomb').length,
            }
          }
          set({ _permCards: permFromDB })
          const resetPlayers = updatedPlayers.map(p => {
            if (p.is_eliminated) return p
            const perm = permFromDB[p.id]
            return perm ? { ...p, flower_count: perm.flowers, bomb_count: perm.bombs } : p
          })
          await Promise.all(
            resetPlayers.filter(p => !p.is_eliminated).map(p =>
              supabase.from('players').update({
                flower_count: p.flower_count,
                bomb_count: p.bomb_count,
                ...(p.id === myPlayer.id ? { win_count: myPlayer.win_count + 1 } : {}),
              }).eq('id', p.id)
            )
          )
          const newRound = gameState.round_number + 1
          await supabase.from('game_states').update({
            round_number: newRound, phase: 'place',
            current_player_id: myPlayer.id,
            highest_bid: 0, highest_bidder_id: null,
            pass_count: 0, flip_count: 0,
            turn_started_at: ts(), last_emote: null, updated_at: ts(),
          }).eq('id', gameState.id)
          await supabase.from('placed_discs')
            .delete().eq('room_id', room.id).eq('round_number', gameState.round_number)
          set({ players: resetPlayers, publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] })
        }
      } else {
        // Challenge loss: remove one random card permanently.
        if (isCpuGame) {
          const { _permCards } = get()
          const currentPerm = _permCards[myPlayer.id] ?? { flowers: 3, bombs: 1 }
          const permTotal = currentPerm.flowers + currentPerm.bombs
          const loseBomb = permTotal > 0 && currentPerm.bombs > 0 && Math.random() < currentPerm.bombs / permTotal
          const newPerm = {
            flowers: loseBomb ? currentPerm.flowers : Math.max(0, currentPerm.flowers - 1),
            bombs:   loseBomb ? Math.max(0, currentPerm.bombs - 1) : currentPerm.bombs,
          }
          const isEliminated = newPerm.flowers + newPerm.bombs === 0
          const updatedPermCards = { ..._permCards, [myPlayer.id]: newPerm }
          const updatedPlayers = players.map(p => {
            if (p.id !== myPlayer.id) return p
            return { ...p, flower_count: newPerm.flowers, bomb_count: newPerm.bombs, is_eliminated: isEliminated }
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
          // Online: fetch placed_discs first so bomb-loss is computed from authoritative perm values
          const { data: roundDiscs } = await supabase
            .from('placed_discs').select('player_id, disc_type')
            .eq('room_id', room.id).eq('round_number', gameState.round_number)
          const permFromDB: Record<string, { flowers: number; bombs: number }> = {}
          for (const p of players) {
            if (p.is_eliminated) continue
            const placed = (roundDiscs ?? []).filter(d => d.player_id === p.id)
            permFromDB[p.id] = {
              flowers: p.flower_count + placed.filter(d => d.disc_type === 'flower').length,
              bombs:   p.bomb_count   + placed.filter(d => d.disc_type === 'bomb').length,
            }
          }
          const currentPerm = permFromDB[myPlayer.id] ?? { flowers: 3, bombs: 1 }
          const permTotal = currentPerm.flowers + currentPerm.bombs
          const loseBomb = permTotal > 0 && currentPerm.bombs > 0 && Math.random() < currentPerm.bombs / permTotal
          const newPerm = {
            flowers: loseBomb ? currentPerm.flowers : Math.max(0, currentPerm.flowers - 1),
            bombs:   loseBomb ? Math.max(0, currentPerm.bombs - 1) : currentPerm.bombs,
          }
          const isEliminated = newPerm.flowers + newPerm.bombs === 0
          permFromDB[myPlayer.id] = newPerm
          set({ _permCards: permFromDB })
          const updatedPlayers = players.map(p => {
            if (p.id !== myPlayer.id) return p
            return { ...p, flower_count: newPerm.flowers, bomb_count: newPerm.bombs, is_eliminated: isEliminated }
          })
          const winner = getWinner(updatedPlayers)
          if (winner) {
            await supabase.from('players').update({
              flower_count: newPerm.flowers,
              bomb_count: newPerm.bombs,
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
            return perm ? { ...p, flower_count: perm.flowers, bomb_count: perm.bombs } : p
          })
          await Promise.all([
            ...resetPlayers.filter(p => !p.is_eliminated).map(p =>
              supabase.from('players').update({
                flower_count: p.flower_count,
                bomb_count: p.bomb_count,
              }).eq('id', p.id)
            ),
            ...(isEliminated ? [
              supabase.from('players').update({
                flower_count: 0, bomb_count: 0, is_eliminated: true,
              }).eq('id', myPlayer.id),
            ] : []),
          ])
          const newRound = gameState.round_number + 1
          await supabase.from('game_states').update({
            round_number: newRound, phase: 'place',
            current_player_id: starterId,
            highest_bid: 0, highest_bidder_id: null,
            pass_count: 0, flip_count: 0,
            turn_started_at: ts(), last_emote: null, updated_at: ts(),
          }).eq('id', gameState.id)
          await supabase.from('placed_discs')
            .delete().eq('room_id', room.id).eq('round_number', gameState.round_number)
          set({ players: resetPlayers, publicDiscs: [], myDiscs: [], _cpuDiscs: [], _foldedPlayerIds: [] })
        }
      }
    },

    // ── sendEmote ─────────────────────────────────────────────────────────────
    sendEmote: async (type: EmoteType) => {
      const { gameState, players, sessionId, isCpuGame } = get()
      const myPlayer = players.find(p => p.session_id === sessionId)
      if (!myPlayer || !gameState) return
      const emote = { playerId: myPlayer.id, type, sentAt: ts() }
      if (isCpuGame) {
        set(s => ({ gameState: s.gameState ? { ...s.gameState, last_emote: emote } : null }))
      } else {
        await supabase.from('game_states').update({ last_emote: emote }).eq('id', gameState.id)
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
    resumeCpuTurns: async () => {
      const s = get()
      if (!s.isCpuGame || !s.gameState) return
      const current = s.players.find(p => p.id === s.gameState!.current_player_id)
      if (current?.is_cpu) await processCpuTurns()
    },

    // ── resetGame ─────────────────────────────────────────────────────────────
    resetGame: () => {
      _cpuRunning = false
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
        _cpuLog: null,
      })
    },
  }
})
