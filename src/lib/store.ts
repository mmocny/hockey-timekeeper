import { atom, map } from 'nanostores';

export type Position = 'F' | 'D' | 'G' | 'A';

export interface Player {
  id: string;
  name: string;
  number: string;
  position: Position;
  is_on_ice: boolean;
  total_time: number;
  last_shift_started?: number;
}

export const playersStore = map<Record<string, Player>>({});
export const isPaused = atom(true);
export const lastServerUpdate = atom(0);

// Fetch state from server
export async function syncWithServer() {
  try {
    const res = await fetch('/api/game');
    if (!res.ok) return;
    const data = await res.json();
    
    // Update nanostores
    const playersMap = Object.fromEntries(data.players.map((p: any) => [p.id, {
      ...p,
      is_on_ice: !!p.is_on_ice // Convert 0/1 to boolean
    }]));
    
    playersStore.set(playersMap);
    isPaused.set(!!data.gameState.is_paused);
    lastServerUpdate.set(Date.now());
  } catch (err) {
    console.error('Failed to sync with server:', err);
  }
}

// Actions that push to server
export async function togglePlayer(id: string, target?: boolean) {
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'toggle_player', payload: { id, target } })
  });
  await syncWithServer();
}

export async function toggleGlobalPause(target?: boolean) {
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'toggle_pause', payload: { target } })
  });
  await syncWithServer();
}

export async function swapPosition(position: Position) {
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'swap', payload: { position } })
  });
  await syncWithServer();
}

export async function cyclePosition(id: string) {
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'cycle_position', payload: { id } })
  });
  await syncWithServer();
}

export async function resetGame() {
  if (!confirm('Are you sure you want to reset all times and the clock?')) return;
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'reset_game' })
  });
  await syncWithServer();
}

export { type Position };