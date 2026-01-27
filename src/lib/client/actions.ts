import { syncWithServer, updateGameStore } from './store';
import { API_ACTIONS } from '../shared/types';

// Pure Async Actions (Server Actions style)
// These will be wrapped in useTransition in the UI

async function performServerAction(apiAction: string, payload: any = {}) {
  try {
    await fetch('/api/game', {
      method: 'POST',
      body: JSON.stringify({ 
        action: apiAction, 
        payload
      })
    });
  } catch (err) {
    console.error(`Action ${apiAction} failed:`, err);
    throw err;
  }
}

export async function switchLane(lane: number) {
  await performServerAction(API_ACTIONS.SWITCH_LANE, { lane });
}

export async function switchAll() {
  await performServerAction(API_ACTIONS.SWITCH_ALL);
}

export async function moveLane(id: string, lane: number) {
  await performServerAction(API_ACTIONS.MOVE_LANE, { id, lane });
}

export async function toggleGlobalPause(target?: boolean) {
  await performServerAction(API_ACTIONS.TOGGLE_PAUSE, { target });
}

export async function resetGame() {
  await performServerAction(API_ACTIONS.RESET_GAME);
}

export async function syncClock(direction: 'up' | 'down') {
  await performServerAction(API_ACTIONS.SYNC_CLOCK, { direction });
}