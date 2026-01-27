import { atom, map } from 'nanostores';
import { type Player } from '../shared/types';

export const playersStore = map<Record<string, Player>>({});
export const isPaused = atom(true);
export const lastUpdate = atom(0); // Server-side updated_at timestamp

let isPolling = false;
let currentTs = 0;

export function startPolling() {
  if (isPolling) return;
  isPolling = true;
  pollLoop();
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Force an immediate check if we were sleeping or errored
      // But usually the long-poll is hanging. 
      // We can't easily cancel the existing fetch without AbortController,
      // but simpler to just let it ride.
    }
  });
}

async function pollLoop() {
  while (isPolling) {
    try {
      await syncWithServer();
    } catch (err) {
      console.error('Poll failed, retrying in 2s:', err);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export function updateGameStore(data: any) {
  if (!data || !data.players || !data.gameState) return;

  const playersMap = Object.fromEntries(data.players.map((p: any) => [p.id, p]));
  playersStore.set(playersMap);
  isPaused.set(!!data.gameState.is_paused);
  
  const serverTs = data.gameState.updated_at || 0;
  if (serverTs > currentTs) {
    currentTs = serverTs;
    lastUpdate.set(currentTs);
  }
}

export async function syncWithServer() {
  try {
    const url = `/api/game?since=${currentTs}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    updateGameStore(data);
  } catch (err) {
    throw err; // Propagate to loop to handle backoff
  }
}