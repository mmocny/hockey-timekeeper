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
  game_time: number;
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
} as const;

export const LANE_NAMES = ['Center', 'Left Wing', 'Right Wing', 'Left Def', 'Right Def', 'Goalie', 'Bench'];