import type { Player, PlayerColor, GameState, PlacedDisc } from '../types/game'

export function generateRoomCode(): string {
  if (Math.random() < 0.5) {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    return Array.from({ length: 6 }, () =>
      letters[Math.floor(Math.random() * letters.length)]
    ).join('')
  }
  return Array.from({ length: 6 }, () =>
    String(Math.floor(Math.random() * 10))
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
    bomb_count: 1,
    win_count: 0,
    is_eliminated: false,
  }
}

export function canPlaceDisc(player: Player, gameState: GameState): boolean {
  if (gameState.phase !== 'place') return false
  if (gameState.current_player_id !== player.id) return false
  if (player.is_eliminated) return false
  return player.flower_count + player.bomb_count > 0
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
  // 誰も入札していない場合はフォールド不可（チャレンジャー不在のフリーズを防ぐ）
  if (gameState.highest_bidder_id === null) return false
  // 最高入札者はフォールドできない
  return gameState.highest_bidder_id !== player.id
}

export function getWinner(players: Player[]): Player | null {
  const byWins = players.find((p) => p.win_count >= 2)
  if (byWins) return byWins
  const active = players.filter((p) => !p.is_eliminated)
  if (active.length === 1 && players.length > 1) return active[0]
  return null
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

