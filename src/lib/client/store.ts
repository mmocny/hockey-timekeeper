import { atom, map } from 'nanostores';
import { type Player } from '../shared/types';
import { GameClockModel, serverClockState } from './GameClockModel';

export const playersStore = map<Record<string, Player>>({});
export const isPaused = atom(true); // Still used by other components
export const clockSkew = atom(0); // Still used to initialize GameClockModel (or passed to it)

let isPolling = false;
let currentTs = 0;
let currentController: AbortController | null = null;
let pendingActions = 0;

// Instantiate GameClockModel once
// It will be initialized with actual data once first sync is complete
// This is not exported, but managed internally or passed via context
export const gameClockModel = new GameClockModel(
  serverClockState.get(), // Initial state will be replaced by first onServerUpdate
  0 // initial skew will be replaced by first onServerUpdate
);


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
  // Initialize GameClockModel with latest server state
  gameClockModel.onServerUpdate(serverClockState.get(), clockSkew.get());
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

export function commitLocalUpdate(playerUpdates: Record<string, Partial<Player>> = {}, gameStateUpdates: Partial<{ is_paused?: boolean; base_game_time?: number; last_resume_time?: number; current_elapsed_time?: number }> = {}) {
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

  // 2. Update Game State (Clock related parts go to GameClockModel)
  // These calls will directly update GameClockModel's internal state for immediate display.
  // GameClockModel handles `_isSyncInitiator` flags.
  if (gameStateUpdates.is_paused !== undefined) gameClockModel.togglePause(gameStateUpdates.is_paused);
  if (gameStateUpdates.current_elapsed_time !== undefined) {
    gameClockModel.syncToWallClock(gameStateUpdates.current_elapsed_time);
  } else if (gameStateUpdates.base_game_time !== undefined && gameStateUpdates.last_resume_time !== undefined && !gameClockModel.getPausedState()) {
    // This case handles explicit base_game_time update during running, usually from sync.
    // However, syncToWallClock will handle the UI input.
    // For now, let's keep it simple: syncToWallClock is only for user input.
    // Server updates go through onServerUpdate.
  }
  
  // Always update isPaused Nanostore for other components that might rely on it.
  if (gameStateUpdates.is_paused !== undefined) isPaused.set(gameStateUpdates.is_paused);
}

export async function updateGameStore(data: any) {
  if (!data || !data.players || !data.gameState) return;

  const playersMap = Object.fromEntries(data.players.map((p: any) => [p.id, p]));
  playersStore.set(playersMap);
  
  // Update Clock Skew (feed to GameClockModel)
  let newClockSkew = clockSkew.get();
  if (data.serverTime) {
    const clientNow = Date.now() / 1000;
    newClockSkew = clientNow - data.serverTime;
  }
  
  // Feed server's authoritative state to GameClockModel
  gameClockModel.onServerUpdate(
    {
      is_paused: !!data.gameState.is_paused,
      base_game_time: data.gameState.base_game_time || 0,
      last_resume_time: data.gameState.last_resume_time || 0,
      current_elapsed_time: data.gameState.current_elapsed_time || 0,
    },
    newClockSkew // Pass current calculated skew
  );

  // Still update isPaused Nanostore for other components that might rely on it.
  isPaused.set(gameClockModel.getPausedState());
  
  // Update serverClockState Nanostore for other components that might rely on raw server data.
  serverClockState.set({
    is_paused: !!data.gameState.is_paused,
    base_game_time: data.gameState.base_game_time || 0,
    last_resume_time: data.gameState.last_resume_time || 0,
    current_elapsed_time: data.gameState.current_elapsed_time || 0,
  });

  const serverTs = data.gameState.updated_at || 0; // Use updated_at for currentTs
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