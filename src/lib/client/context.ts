import { createContext } from 'react';
import type { Player } from '../shared/types';
import type { GameClockModel } from './GameClockModel';

export interface GameContextType {
  players: Player[];
  isPaused: boolean; // Managed by GameClockModel, but might be useful for other components.
  gameClockModel: GameClockModel; // The instance of the clock model
  actions: {
    switchLane: (lane: number) => void;
    switchAll: () => void;
    moveLane: (id: string, lane: number) => void;
    toggleGlobalPause: (target?: boolean) => void;
    resetGame: () => void;
    syncClock: (direction: 'up' | 'down') => void;
    syncWallClock: (newTime: number) => void;
  };
}

export const GameContext = createContext<GameContextType | null>(null);
