import { atom, map } from 'nanostores';
import { type Player } from '../shared/types';

export const playersStore = map<Record<string, Player>>({});
export const isPaused = atom(true);
export const lastUpdate = atom(0);

let pollingInterval: number | null = null;

export function startPolling() {
  if (pollingInterval) return;
  syncWithServer();
  pollingInterval = setInterval(() => syncWithServer(), 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncWithServer();
  });
}

export async function syncWithServer() {
  try {
    const res = await fetch('/api/game');
    if (!res.ok) return;
    const data = await res.json();
    
    const playersMap = Object.fromEntries(data.players.map((p: any) => [p.id, p]));
    
    playersStore.set(playersMap);
    isPaused.set(!!data.gameState.is_paused);
    lastUpdate.set(Date.now());
  } catch (err) {
    console.error('Failed to sync:', err);
  }
}