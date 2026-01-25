import { atom, map } from 'nanostores';
import { INITIAL_PLAYERS, type GamePlayerState, type Position } from './players';

// Initialize store with GamePlayerState
const initialPlayerStates: Record<string, GamePlayerState> = Object.fromEntries(
  INITIAL_PLAYERS.map(p => [
    p.id, 
    { ...p, isOnIce: p.position === 'G', totalTime: 0 }
  ])
);

export const playersStore = map<Record<string, GamePlayerState>>(initialPlayerStates);
export { type Position };
export type Player = GamePlayerState;

export const isPaused = atom(true);
export const gameTime = atom(0); // Total game elapsed time in seconds

export function togglePlayer(id: string) {
  const players = playersStore.get();
  const player = players[id];
  if (!player) return;

  const now = Date.now();
  const newIsOnIce = !player.isOnIce;
  
  const updatedPlayer = { ...player, isOnIce: newIsOnIce };
  
  if (newIsOnIce) {
    updatedPlayer.lastShiftStarted = now;
  } else if (player.lastShiftStarted) {
    const shiftDuration = Math.floor((now - player.lastShiftStarted) / 1000);
    updatedPlayer.totalTime += shiftDuration;
    updatedPlayer.lastShiftStarted = undefined;
  }

  playersStore.setKey(id, updatedPlayer);
}

export function toggleGlobalPause() {
  const nextPaused = !isPaused.get();
  isPaused.set(nextPaused);
  
  const now = Date.now();
  const players = playersStore.get();
  
  // When pausing, update all on-ice players' total time
  if (nextPaused) {
    Object.values(players).forEach(player => {
      if (player.isOnIce && player.lastShiftStarted) {
        const shiftDuration = Math.floor((now - player.lastShiftStarted) / 1000);
        playersStore.setKey(player.id, {
          ...player,
          totalTime: player.totalTime + shiftDuration,
          lastShiftStarted: undefined
        });
      }
    });
  } else {
    // When resuming, start a new shift for all on-ice players
    Object.values(players).forEach(player => {
      if (player.isOnIce) {
        playersStore.setKey(player.id, {
          ...player,
          lastShiftStarted: now
        });
      }
    });
  }
}

export function swapPosition(position: Position) {
  const players = playersStore.get();
  const now = Date.now();
  const paused = isPaused.get();

  Object.values(players).forEach(player => {
    if (player.position === position) {
      const wasOnIce = player.isOnIce;
      const newIsOnIce = !wasOnIce;
      
      const updatedPlayer = { ...player, isOnIce: newIsOnIce };
      
      if (!paused) {
        if (newIsOnIce) {
          updatedPlayer.lastShiftStarted = now;
        } else if (wasOnIce && player.lastShiftStarted) {
          const shiftDuration = Math.floor((now - player.lastShiftStarted) / 1000);
          updatedPlayer.totalTime += shiftDuration;
          updatedPlayer.lastShiftStarted = undefined;
        }
      }
      
      playersStore.setKey(player.id, updatedPlayer);
    }
  });
}
