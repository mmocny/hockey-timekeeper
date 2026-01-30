export interface Player {
  id: string;
  name: string;
  number: string;
  lane: number;
  queue_order: number;
  total_time: number;
  last_shift_started?: number;
}

export interface GameState {
  is_paused: boolean;
  base_game_time: number; // Seconds accumulated while paused/before current active segment
  last_resume_time: number; // Timestamp (seconds) when the clock was last resumed
  updated_at: number;
}

export interface GameData {
  players: Player[];
  gameState: GameState;
}

export const API_ACTIONS = {
  SWITCH_LANE: 'switch_lane',
  SWITCH_ALL: 'switch_all',
  MOVE_LANE: 'move_lane',
  TOGGLE_PAUSE: 'toggle_pause',
  RESET_GAME: 'reset_game',
  SYNC_WALL_CLOCK: 'sync_wall_clock',
} as const;

export const LANE_NAMES = ['Center', 'Left Wing', 'Right Wing', 'Left Def', 'Right Def', 'Goalie', 'Bench', 'Absent'];
