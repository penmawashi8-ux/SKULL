export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type GamePhase = 'place' | 'bid' | 'flip'
export type DiscType = 'flower' | 'bomb'
export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'pink'
export type EmoteType = 'BOMB' | 'FLOWER'

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
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
        Insert: {
          id?: string
          room_code: string
          status?: RoomStatus
          host_id: string
          max_players?: number
          current_round?: number
          password?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_code?: string
          status?: RoomStatus
          host_id?: string
          max_players?: number
          current_round?: number
          password?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
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
        Insert: {
          id?: string
          room_id: string
          player_name: string
          player_color: PlayerColor
          seat_order: number
          is_cpu?: boolean
          session_id: string
          flower_count?: number
          bomb_count?: number
          win_count?: number
          is_eliminated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          player_name?: string
          player_color?: PlayerColor
          seat_order?: number
          is_cpu?: boolean
          session_id?: string
          flower_count?: number
          bomb_count?: number
          win_count?: number
          is_eliminated?: boolean
          created_at?: string
        }
        Relationships: []
      }
      game_states: {
        Row: {
          id: string
          room_id: string
          round_number: number
          phase: GamePhase
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
        Insert: {
          id?: string
          room_id: string
          round_number: number
          phase?: GamePhase
          current_player_id?: string | null
          highest_bid?: number
          highest_bidder_id?: string | null
          pass_count?: number
          flip_count?: number
          turn_started_at?: string | null
          last_emote?: { playerId: string; type: EmoteType; sentAt: string } | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          round_number?: number
          phase?: GamePhase
          current_player_id?: string | null
          highest_bid?: number
          highest_bidder_id?: string | null
          pass_count?: number
          flip_count?: number
          turn_started_at?: string | null
          last_emote?: { playerId: string; type: EmoteType; sentAt: string } | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      placed_discs: {
        Row: {
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
        Insert: {
          id?: string
          room_id: string
          player_id: string
          round_number: number
          disc_type: DiscType
          position: number
          is_flipped?: boolean
          flipped_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          player_id?: string
          round_number?: number
          disc_type?: DiscType
          position?: number
          is_flipped?: boolean
          flipped_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
