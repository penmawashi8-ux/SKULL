import type { Player, PlayerColor, GameState, PlacedDisc } from '../types/game'

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

export function getInitialPlayerState(
  name: string,
  color: PlayerColor,
  seatOrder: number,
  isCpu: boolean
) {
  return {
    player_name: name,
    player_color: color,
    seat_order: seatOrder,
    is_cpu: isCpu,
    flower_count: 3,
    skull_count: 1,
    win_count: 0,
    is_eliminated: false,
  }
}

export function canPlaceDisc(player: Player, gameState: GameState): boolean {
  if (gameState.phase !== 'place') return false
  if (gameState.current_player_id !== player.id) return false
  if (player.is_eliminated) return false
  return player.flower_count + player.skull_count > 0
}

export function canBid(
  player: Player,
  gameState: GameState,
  bidAmount: number,
  totalDiscs: number
): boolean {
  if (gameState.phase !== 'bid') return false
  if (gameState.current_player_id !== player.id) return false
  if (player.is_eliminated) return false
  if (bidAmount <= gameState.highest_bid) return false
  if (bidAmount > totalDiscs) return false
  return true
}

export function canFold(player: Player, gameState: GameState): boolean {
  if (gameState.phase !== 'bid') return false
  if (gameState.current_player_id !== player.id) return false
  if (player.is_eliminated) return false
  // 最高入札者はフォールドできない
  return gameState.highest_bidder_id !== player.id
}

export function resolveChallenge(
  challenger: Player,
  discs: PlacedDisc[],
  players: Player[],
  bid: number
): { success: boolean; hitSkull: boolean; skullOwner?: Player } {
  // めくる順: チャレンジャー自身の積みから先にめくり、次に他プレイヤーを任意順でめくる
  const myDiscs = discs
    .filter((d) => d.player_id === challenger.id && !d.is_flipped)
    .sort((a, b) => b.position - a.position)

  const othersDiscs = discs
    .filter((d) => d.player_id !== challenger.id && !d.is_flipped)
    .sort((a, b) => b.position - a.position)

  const flipOrder = [...myDiscs, ...othersDiscs]

  let flipped = 0
  for (const disc of flipOrder) {
    if (disc.disc_type === 'skull') {
      const skullOwner = players.find((p) => p.id === disc.player_id)
      return { success: false, hitSkull: true, skullOwner }
    }
    flipped++
    if (flipped >= bid) {
      return { success: true, hitSkull: false }
    }
  }

  return { success: flipped >= bid, hitSkull: false }
}

export function shouldAdvanceToNextRound(
  gameState: GameState,
  players: Player[]
): boolean {
  const activePlayers = players.filter((p) => !p.is_eliminated)
  // フォールドした人数 + 1（チャレンジャー）= 全アクティブプレイヤーなら次ラウンドへ
  return gameState.pass_count >= activePlayers.length - 1
}

export function getWinner(players: Player[]): Player | null {
  return players.find((p) => p.win_count >= 2) ?? null
}

export function getTotalDiscsInPlay(
  players: Player[],
  discs: PlacedDisc[],
  round: number
): number {
  const activePlayerIds = new Set(
    players.filter((p) => !p.is_eliminated).map((p) => p.id)
  )
  return discs.filter(
    (d) => d.round_number === round && activePlayerIds.has(d.player_id)
  ).length
}

export function getMustBidPlayer(
  players: Player[],
  gameState: GameState,
  discs: PlacedDisc[]
): Player | null {
  if (gameState.phase !== 'place') return null

  const activePlayers = players.filter((p) => !p.is_eliminated)
  const round = gameState.round_number

  // 全アクティブプレイヤーが少なくとも1枚置いているか確認
  const allPlaced = activePlayers.every((p) =>
    discs.some((d) => d.player_id === p.id && d.round_number === round)
  )
  if (!allPlaced) return null

  // 全員が手札を使い切った or フェーズを進めるべき状態
  const allHandsEmpty = activePlayers.every(
    (p) => p.flower_count + p.skull_count === 0
  )
  if (allHandsEmpty) {
    // 最初に置いたプレイヤー（seat_order最小）からビッドを開始
    return activePlayers.sort((a, b) => a.seat_order - b.seat_order)[0]
  }

  return null
}
