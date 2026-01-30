import { useState, useOptimistic, useTransition, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { playersStore, isPaused as isPausedStore, clockSkew as clockSkewStore, startPolling, abortPolling, updateGameStore } from '../lib/client/store';
import { GameClockModel, serverClockState } from '../lib/client/GameClockModel';
import * as serverActions from '../lib/client/actions';
import { type Player } from '../lib/shared/types';

type PlayerAction = 
  | { type: 'update_players'; updates: Record<string, Partial<Player>> }
  | { type: 'set_pause'; isPaused: boolean }
  | { type: 'reset_game' };

function playerReducer(state: Player[], action: PlayerAction): Player[] {
  switch (action.type) {
    case 'update_players': {
      return state.map(p => {
        const update = action.updates[p.id];
        return update ? { ...p, ...update } : p;
      });
    }
    case 'set_pause': {
      return state;
    }
    case 'reset_game': {
      return state.map(p => ({ ...p, total_time: 0, last_shift_started: undefined }));
    }
    default:
      return state;
  }
}

// Helper to update the Nanostore "Client Cache" to prevent UI flicker between action and poll
function commitLocalCacheUpdate(
  playerUpdates: Record<string, Partial<Player>> = {}, 
  gameStateUpdates: Partial<{ is_paused?: boolean; base_game_time?: number; last_resume_time?: number; current_elapsed_time?: number }> = {},
  model: GameClockModel
) {
  // 1. Update Players Store
  if (Object.keys(playerUpdates).length > 0) {
    const currentPlayers = playersStore.get();
    const newPlayers = { ...currentPlayers };
    
    Object.entries(playerUpdates).forEach(([id, updates]) => {
      if (newPlayers[id]) {
        newPlayers[id] = { ...newPlayers[id], ...updates };
      }
    });
    playersStore.set(newPlayers);
  }

  // 2. Update Model and Pause Store
  if (gameStateUpdates.is_paused !== undefined) {
    model.togglePause(gameStateUpdates.is_paused);
    isPausedStore.set(gameStateUpdates.is_paused);
  }
  
  if (gameStateUpdates.current_elapsed_time !== undefined) {
    model.syncToWallClock(gameStateUpdates.current_elapsed_time);
  }
}

export function useGameController() {
  // --- 1. Model Initialization ---
  const serverClock = useStore(serverClockState);
  const serverSkew = useStore(clockSkewStore);
  
  // Create the Model instance once.
  // We use a ref to ensure it survives re-renders.
  const gameClockModelRef = useRef<GameClockModel | null>(null);
  if (!gameClockModelRef.current) {
    gameClockModelRef.current = new GameClockModel(serverClock, serverSkew);
  }
  const gameClockModel = gameClockModelRef.current;

  // Sync Model with Server State (Nanostore -> Model)
  useEffect(() => {
    gameClockModel.onServerUpdate(serverClock, serverSkew);
  }, [serverClock, serverSkew, gameClockModel]);

  // Sync Model with Paused Store (Nanostore -> Model)
  // This handles updates coming from polling that update the store
  useEffect(() => {
    const unsubscribe = isPausedStore.listen(paused => {
      gameClockModel.togglePause(paused);
    });
    return unsubscribe;
  }, [gameClockModel]);


  // --- 2. State Access ---
  const serverPlayers = useStore(playersStore);
  const serverPaused = useStore(isPausedStore);
  const playerList = Object.values(serverPlayers);

  // --- 3. Optimistic UI ---
  const [optimisticPlayers, setOptimisticPlayers] = useOptimistic(
    playerList,
    playerReducer
  );
  
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(
    serverPaused,
    (state, newState: boolean) => newState
  );

  const [isPending, startTransition] = useTransition();


  // --- 4. Actions ---
  const actions = {
    syncClock: (direction: 'up' | 'down') => {
      const currentDisplayedTime = gameClockModel.currentDisplayTime.get();
      const seconds = currentDisplayedTime % 60;
      let delta = 0;
      
      if (direction === 'down') delta = seconds === 0 ? -60 : -seconds;
      else delta = seconds === 0 ? 60 : (60 - seconds);

      const newTargetTime = Math.max(0, currentDisplayedTime + delta);
      actions.syncWallClock(newTargetTime);
    },

    syncWallClock: (newTime: number) => {
      const oldTime = gameClockModel.getCurrentElapsed();
      const delta = newTime - oldTime;
      
      const updates: Record<string, Partial<Player>> = {};
      optimisticPlayers.forEach(p => {
        if (p.last_shift_started !== undefined) {
          updates[p.id] = { last_shift_started: p.last_shift_started + delta };
        }
      });
      
      abortPolling();
      gameClockModel.syncToWallClock(newTime);
      commitLocalCacheUpdate(updates, { current_elapsed_time: newTime }, gameClockModel);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.syncWallClock(newTime);
      });
    },

    togglePenalty: (id: string) => {
      const gameTime = gameClockModel.getCurrentElapsed();
      const player = optimisticPlayers.find(p => p.id === id);
      if (!player) return;

      const nextIsServing = !player.is_serving_penalty;
      let nextTotalTime = player.total_time;
      let nextTotalPenalty = player.total_penalty_time || 0;

      if (player.last_shift_started !== undefined) {
        const elapsed = gameTime - player.last_shift_started;
        if (player.is_serving_penalty) {
          nextTotalPenalty += elapsed;
        } else {
          nextTotalTime += elapsed;
        }
      }

      // Check if timer should be running
      const isActive = (player.queue_order === 0 && player.lane < 6) && !gameClockModel.getPausedState();
      
      const updates: Record<string, Partial<Player>> = {
        [id]: { 
          is_serving_penalty: nextIsServing,
          total_time: nextTotalTime,
          total_penalty_time: nextTotalPenalty,
          last_shift_started: isActive ? gameTime : undefined
        }
      };

      abortPolling();
      commitLocalCacheUpdate(updates, {}, gameClockModel);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.togglePenalty(id);
      });
    },

    switchLane: (lane: number) => {
      const gameTime = gameClockModel.getCurrentElapsed();
      const lanePlayers = optimisticPlayers.filter(p => p.lane === lane).sort((a, b) => a.queue_order - b.queue_order);
      if (lanePlayers.length === 0) return;

      // Lock line if penalty
      if (lanePlayers.some(p => p.is_serving_penalty)) return;

      const current = lanePlayers[0];
      const maxOrder = Math.max(...lanePlayers.map(p => p.queue_order));
      const updates: Record<string, Partial<Player>> = {};

      lanePlayers.forEach(p => {
        if (p.id === current.id) {
          let newTotal = p.total_time;
          if (p.last_shift_started !== undefined) { 
            newTotal += (gameTime - p.last_shift_started);
          }
          updates[p.id] = { queue_order: maxOrder + 1, total_time: newTotal, last_shift_started: undefined };
        } else {
          const newOrder = p.queue_order - 1;
          const isNowActive = newOrder === 0;
          updates[p.id] = { 
            queue_order: newOrder, 
            last_shift_started: isNowActive ? gameTime : undefined 
          };
        }
      });

      abortPolling();
      commitLocalCacheUpdate(updates, {}, gameClockModel);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.switchLane(lane);
      });
    },

    switchAll: () => {
      const gameTime = gameClockModel.getCurrentElapsed();
      const updates: Record<string, Partial<Player>> = {};

      for (let lane = 0; lane < 5; lane++) {
        const lanePlayers = optimisticPlayers.filter(p => p.lane === lane).sort((a, b) => a.queue_order - b.queue_order);
        if (lanePlayers.length === 0) continue;

        // Lock line if penalty
        if (lanePlayers.some(p => p.is_serving_penalty)) continue;

        const current = lanePlayers[0];
        const maxOrder = Math.max(...lanePlayers.map(p => p.queue_order));

        lanePlayers.forEach(p => {
          if (p.id === current.id) {
            let newTotal = p.total_time;
            if (p.last_shift_started !== undefined) {
              newTotal += (gameTime - p.last_shift_started);
            }
            updates[p.id] = { ...updates[p.id], queue_order: maxOrder + 1, total_time: newTotal, last_shift_started: undefined };
          } else {
            const newOrder = p.queue_order - 1;
            const isNowActive = newOrder === 0;
            updates[p.id] = { 
              ...updates[p.id],
              queue_order: newOrder, 
              last_shift_started: isNowActive ? gameTime : undefined 
            };
          }
        });
      }

      abortPolling();
      commitLocalCacheUpdate(updates, {}, gameClockModel);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.switchAll();
      });
    },

    moveLane: (id: string, lane: number) => {
      // Intercept drag to Penalty (Lane 8) -> Toggle Penalty instead
      if (lane === 8) {
        actions.togglePenalty(id);
        return;
      }

      const gameTime = gameClockModel.getCurrentElapsed();
      
      const updates: Record<string, Partial<Player>> = {};
      const serverCalls: Promise<void>[] = [];

      // 1. Handle Goalie Replacement (if moving INTO lane 5)
      if (lane === 5) {
        const existingGoalie = optimisticPlayers.find(p => p.lane === 5 && p.id !== id);
        if (existingGoalie) {
           const benchPlayers = optimisticPlayers.filter(p => p.lane === 6);
           const nextBenchOrder = benchPlayers.length > 0 ? Math.max(...benchPlayers.map(p => p.queue_order)) + 1 : 0;
           
           let newTotal = existingGoalie.total_time;
           if (existingGoalie.last_shift_started !== undefined) {
             newTotal += (gameTime - existingGoalie.last_shift_started);
           }

           updates[existingGoalie.id] = {
             lane: 6,
             queue_order: nextBenchOrder,
             total_time: newTotal,
             last_shift_started: undefined
           };
           
           serverCalls.push(serverActions.moveLane(existingGoalie.id, 6));
        }
      }

      // 2. Handle Moving Player
      const targetLanePlayers = optimisticPlayers.filter(p => p.lane === lane);
      
      let nextOrder = 0;
      if (lane === 5) {
        nextOrder = 0; 
      } else {
        nextOrder = targetLanePlayers.length > 0 ? Math.max(...targetLanePlayers.map(p => p.queue_order)) + 1 : 0;
      }

      const player = optimisticPlayers.find(p => p.id === id);
      if (!player) return;

      let nextTotalTime = player.total_time;
      let nextTotalPenalty = player.total_penalty_time || 0;

      if (player.last_shift_started !== undefined) {
         const elapsed = gameTime - player.last_shift_started;
         if (player.is_serving_penalty) {
            nextTotalPenalty += elapsed;
         } else {
            nextTotalTime += elapsed;
         }
      }

      updates[id] = { 
        lane, 
        queue_order: nextOrder, 
        total_time: nextTotalTime,
        total_penalty_time: nextTotalPenalty,
        is_serving_penalty: false, // Reset penalty on move
        last_shift_started: ((nextOrder === 0 && lane < 6) || lane === 8) ? gameTime : undefined 
      };
      
      serverCalls.push(serverActions.moveLane(id, lane));

      abortPolling();
      commitLocalCacheUpdate(updates, {}, gameClockModel);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        for (const call of serverCalls) {
            await call;
        }
      });
    },

    toggleGlobalPause: () => {
      const next = !gameClockModel.getPausedState();
      
      abortPolling();
      commitLocalCacheUpdate({}, { is_paused: next }, gameClockModel);

      startTransition(async () => {
        setOptimisticPaused(next);
        await serverActions.toggleGlobalPause(next);
      });
    },

    resetGame: async () => {
      if (!confirm('Are you sure you want to reset all game time?')) return;
      
      abortPolling();
      const updates: Record<string, Partial<Player>> = {};
      optimisticPlayers.forEach(p => {
        updates[p.id] = { total_time: 0, last_shift_started: undefined };
      });
      commitLocalCacheUpdate(updates, { is_paused: true, base_game_time: 0, last_resume_time: 0, current_elapsed_time: 0 }, gameClockModel);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'reset_game' });
        setOptimisticPaused(true);
        await serverActions.resetGame();
      });
    }
  };

  // --- 5. Polling Lifecycle ---
  useEffect(() => {
    startPolling();
    gameClockModel.startTicker();
    
    return () => {
      // Cleanup
      gameClockModel.destroy();
      // We don't necessarily stop polling globally here as it's shared, but for this component we could.
      // Since store.ts handles the singleton polling loop check, calling startPolling is safe.
    };
  }, [gameClockModel]);

  return {
    players: optimisticPlayers,
    isPaused: optimisticPaused,
    gameClockModel,
    actions,
    isPending,
    isLoading: playerList.length === 0
  };
}
