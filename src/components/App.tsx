import React from 'react';
import { GameContext } from '../lib/client/context';
import { useGameController } from '../hooks/useGameController';
import { GameLayout } from './GameLayout';

export const App: React.FC = () => {
  const { players, isPaused, gameClockModel, actions, isPending, isLoading } = useGameController();

  return (
    <GameContext.Provider value={{ players, isPaused, gameClockModel, actions }}>
      <GameLayout isPending={isPending} isLoading={isLoading} />
    </GameContext.Provider>
  );
};