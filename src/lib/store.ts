import { atom, map } from 'nanostores';

export type Position = 'F' | 'D' | 'G' | 'A';

export interface Player {
  id: string;
  name: string;
  number: string;
  position: Position;
  lane: number;
  queue_order: number;
  is_on_ice: boolean;
  total_time: number;
  last_shift_started?: number;
}

export const playersStore = map<Record<string, Player>>({});
export const isPaused = atom(true);
export const lastUpdate = atom(0); // For identifying remote vs local updates

// Track in-flight optimistic updates to avoid polling flicker
let pendingUpdates = 0;
let pollingInterval: NodeJS.Timeout | null = null;

export function startPolling() {
  if (pollingInterval) return;

  // Initial sync
  syncWithServer();

  // Poll every 1s
  pollingInterval = setInterval(syncWithServer, 1000);

  // Sync on visibility change
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      syncWithServer();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export async function syncWithServer() {
  // If we have pending local actions, skip polling to prevent UI flicker
  // (The optimistic state is "newer" than what the server might return immediately)
  if (pendingUpdates > 0) return;

  try {
    const res = await fetch('/api/game');
    if (!res.ok) return;
    const data = await res.json();
    
    // Only update if we still have no pending actions (race condition check)
    if (pendingUpdates === 0) {
      const playersMap = Object.fromEntries(data.players.map((p: any) => [p.id, {
        ...p,
        is_on_ice: !!p.is_on_ice
      }]));
      playersStore.set(playersMap);
      isPaused.set(!!data.gameState.is_paused);
      lastUpdate.set(Date.now());
    }
  } catch (err) {
    console.error('Failed to sync:', err);
  }
}

async function performOptimisticAction(
  updateFn: () => void, 
  apiAction: string, 
  payload: any = {}
) {
  // 1. Optimistic Local Update
  updateFn();
  pendingUpdates++;

  try {
    // 2. Send to Server with Client Timestamp
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
    // In a real app, we might revert the optimistic update here
  } finally {
    // 3. Decrement pending counter
    pendingUpdates--;
    // 4. Force a sync to ensure we eventually match the server truth
    // (We delay slightly to let the DB settle)
    setTimeout(syncWithServer, 100);
  }
}

export function nextShift(lane: number) {
  performOptimisticAction(() => {
    const players = Object.values(playersStore.get());
    const lanePlayers = players.filter(p => p.lane === lane).sort((a, b) => a.queue_order - b.queue_order);
    const onIce = lanePlayers.find(p => p.is_on_ice);
    const next = lanePlayers.find(p => !p.is_on_ice);

    // Optimistic Logic: Rotate locally
    const updates: Record<string, Player> = {};
    if (onIce) {
      updates[onIce.id] = { ...onIce, is_on_ice: false, last_shift_started: undefined };
      // Move to back roughly
      const maxOrder = Math.max(...lanePlayers.map(p => p.queue_order));
      updates[onIce.id].queue_order = maxOrder + 1;
    }
    if (next) {
      updates[next.id] = { ...next, is_on_ice: true, last_shift_started: Math.floor(Date.now() / 1000) };
    }
    
    // Re-normalize queue for UI stability
    const finalLane = lanePlayers.map(p => updates[p.id] || p).sort((a, b) => {
      // Prioritize "next" to be 0 if on ice? No, standard logic:
      if (updates[a.id]?.is_on_ice) return -1;
      return a.queue_order - b.queue_order; 
    });
    
    // Batch update store
    playersStore.set({
      ...playersStore.get(),
      ...updates
    });
  }, 'next_shift', { lane });
}

export function switchAll() {
  performOptimisticAction(() => {
    // Ideally duplicate logic for all lanes, or just rely on eventual consistency
    // For Switch All, we'll just toggle the pause state optimistically if needed, 
    // but full rotation is complex to calculate client-side accurately without duplicating all DB logic.
    // So for this one complex action, we might just let it "lag" slightly or implement full logic.
    // Let's implement full logic:
    const players = Object.values(playersStore.get());
    const updates: Record<string, Player> = {};
    const now = Math.floor(Date.now() / 1000);

    for(let lane=0; lane<5; lane++) {
      const lanePlayers = players.filter(p => p.lane === lane).sort((a, b) => a.queue_order - b.queue_order);
      const onIce = lanePlayers.find(p => p.is_on_ice);
      const next = lanePlayers.find(p => !p.is_on_ice);

      if (onIce) {
         updates[onIce.id] = { ...onIce, is_on_ice: false, last_shift_started: undefined, queue_order: 999 };
      }
      if (next) {
         updates[next.id] = { ...next, is_on_ice: true, last_shift_started: now };
      }
    }
    playersStore.set({ ...playersStore.get(), ...updates });
  }, 'switch_all');
}

export function moveLane(id: string, lane: number) {
  performOptimisticAction(() => {
    const player = playersStore.get()[id];
    if (player) {
      playersStore.setKey(id, { ...player, lane, is_on_ice: false });
    }
  }, 'move_lane', { id, lane });
}

export function toggleGlobalPause(target?: boolean) {
  const current = isPaused.get();
  const next = target !== undefined ? target : !current;
  performOptimisticAction(() => {
    isPaused.set(next);
  }, 'toggle_pause', { target: next });
}

export function resetGame() {
  if (!confirm('Reset all stats?')) return;
  performOptimisticAction(() => {
    const players = playersStore.get();
    const updates = Object.fromEntries(
      Object.values(players).map(p => [p.id, { ...p, total_time: 0, is_on_ice: false, last_shift_started: undefined }])
    );
    playersStore.set(updates);
    isPaused.set(true);
  }, 'reset_game');
}