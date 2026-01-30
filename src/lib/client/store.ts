import { atom, map } from 'nanostores';
import { type Player } from '../shared/types';
import { serverClockState } from './GameClockModel';

export const playersStore = map<Record<string, Player>>({});
export const isPaused = atom(true);
export const clockSkew = atom(0);

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

export async function updateGameStore(data: any) {
  if (!data || !data.players || !data.gameState) return;

  const playersMap = Object.fromEntries(data.players.map((p: any) => [p.id, p]));
  playersStore.set(playersMap);
  
  // Update Clock Skew
  let newClockSkew = clockSkew.get();
  if (data.serverTime) {
    const clientNow = Date.now() / 1000;
    newClockSkew = clientNow - data.serverTime;
    clockSkew.set(newClockSkew);
  }
  
  // Update isPaused Nanostore
  isPaused.set(!!data.gameState.is_paused);
  
  // Update serverClockState Nanostore
  serverClockState.set({
    is_paused: !!data.gameState.is_paused,
    base_game_time: data.gameState.base_game_time || 0,
    last_resume_time: data.gameState.last_resume_time || 0,
    current_elapsed_time: data.gameState.current_elapsed_time || 0,
  });

  const serverTs = data.gameState.updated_at || 0;
  if (serverTs > currentTs) {
    currentTs = serverTs;
  }
  
  // If server returned invalid timestamp (0), likely DB error or init state. 
  // Force a delay to prevent hot loop denial-of-service on self.
  if (serverTs === 0) {
    await new Promise(r => setTimeout(r, 1000));
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
    await updateGameStore(data);
  } catch (err) {
    throw err; // Propagate to loop to handle backoff
  }
}