import { createContext } from 'react';
import type { Player } from '../shared/types';

export interface GameContextType {
  players: Player[];
  isPaused: boolean;
  actions: {
    switchLane: (lane: number) => void;
    switchAll: () => void;
    moveLane: (id: string, lane: number) => void;
    toggleGlobalPause: () => void;
    resetGame: () => void;
  };
}

export const GameContext = createContext<GameContextType | null>(null);
