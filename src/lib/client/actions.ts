import { playersStore, isPaused, syncWithServer } from './store';
import { API_ACTIONS, type Player } from '../shared/types';

// Track in-flight optimistic updates
let pendingUpdates = 0;

// Helper to manage optimistic updates + server sync
async function performOptimisticAction(
  updateFn: () => void, 
  apiAction: string, 
  payload: any = {}
) {
  // 1. Optimistic Local Update
  updateFn();
  pendingUpdates++;

  try {
    // 2. Send to Server
    await fetch('/api/game', {
      method: 'POST',
      body: JSON.stringify({ 
        action: apiAction, 
        payload, 
        timestamp: Date.now() 
      })
    });
  } catch (err) {
    console.error(`Action ${apiAction} failed:`, err);
  } finally {
    pendingUpdates--;
    // 3. Force sync (small delay for DB propagation)
    setTimeout(() => syncWithServer(pendingUpdates), 100);
  }
}

export function switchLane(lane: number) {
  performOptimisticAction(() => {
    const players = { ...playersStore.get() };
    const lanePlayers = Object.values(players)
      .filter(p => p.lane === lane)
      .sort((a, b) => a.queue_order - b.queue_order);

    if (lanePlayers.length === 0) return;

    const currentOnIce = lanePlayers[0];
    const now = Math.floor(Date.now() / 1000);

    // 1. Move first player to end
    if (currentOnIce) {
      players[currentOnIce.id] = { 
        ...currentOnIce, 
        queue_order: lanePlayers.length - 1,
        last_shift_started: undefined 
      };
    }

    // 2. Shift everyone else up
    for (let i = 1; i < lanePlayers.length; i++) {
      const p = lanePlayers[i];
      const newOrder = i - 1;
      const isNowActive = newOrder === 0;
      players[p.id] = {
        ...p,
        queue_order: newOrder,
        last_shift_started: isNowActive ? now : undefined
      };
    }
    
    playersStore.set(players);
  }, API_ACTIONS.SWITCH_LANE, { lane });
}

export function switchAll() {
  performOptimisticAction(() => {
    const players = { ...playersStore.get() };
    const now = Math.floor(Date.now() / 1000);

    for (let lane = 0; lane < 5; lane++) {
      const lanePlayers = Object.values(players)
        .filter(p => p.lane === lane)
        .sort((a, b) => a.queue_order - b.queue_order);

      if (lanePlayers.length === 0) continue;

      // Move 0 to end
      const current = lanePlayers[0];
      players[current.id] = { 
        ...current, 
        queue_order: lanePlayers.length - 1, 
        last_shift_started: undefined 
      };

      // Shift others up
      for (let i = 1; i < lanePlayers.length; i++) {
        const p = lanePlayers[i];
        const newOrder = i - 1;
        players[p.id] = { 
          ...p, 
          queue_order: newOrder, 
          last_shift_started: newOrder === 0 ? now : undefined 
        };
      }
    }
    playersStore.set(players);
  }, API_ACTIONS.SWITCH_ALL);
}

export function moveLane(id: string, lane: number) {
  performOptimisticAction(() => {
    const players = { ...playersStore.get() };
    const player = players[id];
    if (player) {
      // Find max order in target lane to append
      const targetLanePlayers = Object.values(players).filter(p => p.lane === lane);
      const nextOrder = targetLanePlayers.length > 0 
        ? Math.max(...targetLanePlayers.map(p => p.queue_order)) + 1 
        : 0;

      players[id] = { 
        ...player, 
        lane, 
        queue_order: nextOrder,
        last_shift_started: undefined 
      };
      playersStore.set(players);
    }
  }, API_ACTIONS.MOVE_LANE, { id, lane });
}

export function toggleGlobalPause(target?: boolean) {
  const current = isPaused.get();
  const next = target !== undefined ? target : !current;
  performOptimisticAction(() => {
    isPaused.set(next);
    
    // Update timestamps for active players if resuming
    if (!next) {
      const now = Math.floor(Date.now() / 1000);
      const players = { ...playersStore.get() };
      let changed = false;
      Object.values(players).forEach(p => {
        if (p.lane < 5 && p.queue_order === 0) {
          players[p.id] = { ...p, last_shift_started: now };
          changed = true;
        }
      });
      if (changed) playersStore.set(players);
    }
  }, API_ACTIONS.TOGGLE_PAUSE, { target: next });
}

export function resetGame() {
  if (!confirm('Reset all stats?')) return;
  performOptimisticAction(() => {
    const players = playersStore.get();
    const updates = Object.fromEntries(
      Object.values(players).map(p => [
        p.id, 
        { ...p, total_time: 0, last_shift_started: undefined }
      ])
    );
    playersStore.set(updates);
    isPaused.set(true);
  }, API_ACTIONS.RESET_GAME);
}
