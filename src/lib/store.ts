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

export async function syncWithServer() {
  try {
    const res = await fetch('/api/game');
    if (!res.ok) return;
    const data = await res.json();
    const playersMap = Object.fromEntries(data.players.map((p: any) => [p.id, {
      ...p,
      is_on_ice: !!p.is_on_ice
    }]));
    playersStore.set(playersMap);
    isPaused.set(!!data.gameState.is_paused);
  } catch (err) {
    console.error('Failed to sync:', err);
  }
}

export async function nextShift(lane: number) {
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'next_shift', payload: { lane } })
  });
  await syncWithServer();
}

export async function switchAll() {
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'switch_all' })
  });
  await syncWithServer();
}

export async function moveLane(id: string, lane: number) {
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'move_lane', payload: { id, lane } })
  });
  await syncWithServer();
}

export async function reorderPlayer(id: string, lane: number, newIndex: number) {
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'reorder_player', payload: { id, lane, newIndex } })
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

export async function resetGame() {
  if (!confirm('Reset all stats?')) return;
  await fetch('/api/game', {
    method: 'POST',
    body: JSON.stringify({ action: 'reset_game' })
  });
  await syncWithServer();
}
