export type Phase = 'place' | 'bid' | 'flip'
export type DiscType = 'flower' | 'bomb'
export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'pink'
export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type EmoteType = 'BOMB' | 'FLOWER'

export interface Room {
  id: string
  room_code: string
  status: RoomStatus
  host_id: string
  max_players: number
  current_round: number
  password: string | null
  created_at: string
  updated_at: string
}

export interface RoomListItem {
  id: string
  room_code: string
  max_players: number
  current_players: number
  has_password: boolean
  created_at: string
}

export interface Player {
  id: string
  room_id: string
  player_name: string
  player_color: PlayerColor
  seat_order: number
  is_cpu: boolean
  session_id: string
  flower_count: number
  bomb_count: number
  win_count: number
  is_eliminated: boolean
  created_at: string
}

export interface GameState {
  id: string
  room_id: string
  round_number: number
  phase: Phase
  current_player_id: string | null
  highest_bid: number
  highest_bidder_id: string | null
  pass_count: number
  flip_count: number
  turn_started_at: string | null
  last_emote: { playerId: string; type: EmoteType; sentAt: string } | null
  created_at: string
  updated_at: string
}

export interface PlacedDisc {
  id: string
  room_id: string
  player_id: string
  round_number: number
  disc_type: DiscType
  position: number
  is_flipped: boolean
  flipped_by: string | null
  created_at: string
}
