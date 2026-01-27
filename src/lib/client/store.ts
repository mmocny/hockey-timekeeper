import { atom, map } from 'nanostores';
import { type Player } from '../shared/types';

export const playersStore = map<Record<string, Player>>({});
export const isPaused = atom(true);
export const gameTime = atom(0);
export const updatedAt = atom(0);
export const lastUpdate = atom(0); // Server-side updated_at timestamp

let isPolling = false;
let currentTs = 0;
let currentController: AbortController | null = null;

export function startPolling() {
  if (isPolling) return;
  isPolling = true;
  pollLoop();
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Force immediate refresh by aborting the pending long-poll
      if (currentController) {
        currentController.abort();
      }
    }
  });
}

async function pollLoop() {
  while (isPolling) {
    try {
      currentController = new AbortController();
      await syncWithServer(currentController.signal);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Aborted to force refresh, retry immediately
        continue;
      }
      console.error('Poll failed, retrying in 2s:', err);
      await new Promise(r => setTimeout(r, 2000));
    } finally {
      currentController = null;
    }
  }
}

export function updateGameStore(data: any) {
  if (!data || !data.players || !data.gameState) return;

  const playersMap = Object.fromEntries(data.players.map((p: any) => [p.id, p]));
  playersStore.set(playersMap);
  isPaused.set(!!data.gameState.is_paused);
  gameTime.set(data.gameState.game_time || 0);
  updatedAt.set(data.gameState.updated_at || 0);
  
  const serverTs = data.gameState.updated_at || 0;
  if (serverTs > currentTs) {
    currentTs = serverTs;
    lastUpdate.set(currentTs);
  }
}

export async function syncWithServer(signal?: AbortSignal) {
  try {
    const url = `/api/game?since=${currentTs}`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    updateGameStore(data);
  } catch (err) {
    throw err; // Propagate to loop to handle backoff
  }
}