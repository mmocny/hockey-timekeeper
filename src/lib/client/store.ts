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
let pendingActions = 0;

export function incrementPending() {
  pendingActions++;
  if (currentController) currentController.abort(); // Cancel any background poll to prioritize action
}

export function decrementPending() {
  pendingActions = Math.max(0, pendingActions - 1);
  // If we hit 0, the poll loop (which is sleeping) will wake up naturally or we can nudge it?
  // The loop is just retrying or sleeping.
}

export function startPolling() {
  if (isPolling) return;
  isPolling = true;
  pollLoop();
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      abortPolling();
    }
  });
}

export function abortPolling() {
  if (currentController) {
    currentController.abort();
  }
}

async function pollLoop() {
  while (isPolling) {
    if (pendingActions > 0) {
      // Don't poll while we have local actions in flight to prevent overwriting local optimistic state
      await new Promise(r => setTimeout(r, 100)); 
      continue;
    }

    try {
      currentController = new AbortController();
      await syncWithServer(currentController.signal);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Aborted to force refresh or due to user action, retry immediately
        continue;
      }
      console.error('Poll failed, retrying in 2s:', err);
      await new Promise(r => setTimeout(r, 2000));
    } finally {
      currentController = null;
    }
  }
}

export function commitLocalUpdate(playerUpdates: Record<string, Partial<Player>> = {}, gameStateUpdates: Partial<{ is_paused: boolean; game_time: number; updated_at: number }> = {}) {
  // 1. Update Players
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

  // 2. Update Game State
  if (gameStateUpdates.is_paused !== undefined) isPaused.set(gameStateUpdates.is_paused);
  if (gameStateUpdates.game_time !== undefined) gameTime.set(gameStateUpdates.game_time);
  if (gameStateUpdates.updated_at !== undefined) updatedAt.set(gameStateUpdates.updated_at);
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