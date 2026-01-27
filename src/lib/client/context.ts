import { createContext } from 'react';
import type { Player } from '../shared/types';

export interface GameContextType {
  players: Player[];
  isPaused: boolean;
  gameTime: number;
  updatedAt: number;
  actions: {
    switchLane: (lane: number) => void;
    switchAll: () => void;
    moveLane: (id: string, lane: number) => void;
    toggleGlobalPause: () => void;
    resetGame: () => void;
    syncClock: (direction: 'up' | 'down') => void;
  };
}

export const GameContext = createContext<GameContextType | null>(null);
