import type { APIRoute } from 'astro';
import { API_ACTIONS } from '../../lib/shared/types';
import { GameRepository } from '../../lib/server/db';

export const GET: APIRoute = async ({ locals, url }) => {
  const { DB } = locals.runtime.env;
  const repo = new GameRepository(DB);

  const sinceParam = url.searchParams.get('since');
  const since = sinceParam ? parseInt(sinceParam) : 0;

  try {
    const start = Date.now();
    const timeout = 20000; // 20 seconds long-poll

    while (Date.now() / 1000 - start / 1000 < timeout / 1000) { // Compare in seconds
      if (since > 0) {
        const currentTs = await repo.getGameTimestamp();
        if (currentTs <= since) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
      }

      const gameState = await repo.getGameState(); // Fetches and calculates current_elapsed_time
      const players = await repo.getAllPlayers();
      return new Response(JSON.stringify({ 
        players, 
        gameState: {
          is_paused: gameState.is_paused,
          base_game_time: gameState.base_game_time,
          last_resume_time: gameState.last_resume_time,
          updated_at: gameState.updated_at,
          current_elapsed_time: gameState.current_elapsed_time // Return calculated elapsed time
        }, 
        serverTime: Date.now() / 1000 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Timeout reached
    const gameState = await repo.getGameState();
    const players = await repo.getAllPlayers();
    return new Response(JSON.stringify({ 
      players, 
      gameState: {
        is_paused: gameState.is_paused,
        base_game_time: gameState.base_game_time,
        last_resume_time: gameState.last_resume_time,
        updated_at: gameState.updated_at,
        current_elapsed_time: gameState.current_elapsed_time
      }, 
      serverTime: Date.now() / 1000 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

    } catch (e) {
      console.error('API Error:', e);
      // Fallback if DB is not initialized locally
      return new Response(JSON.stringify({ players: [], gameState: { is_paused: 1, base_game_time: 0, last_resume_time: 0, updated_at: 0, current_elapsed_time: 0 }, serverTime: Date.now() / 1000 }), { status: 200 });
    }
  };
export const POST: APIRoute = async ({ request, locals }) => {
  const { DB } = locals.runtime.env;
  const repo = new GameRepository(DB);

  try {
    const { action, payload } = await request.json();
    const now = Math.floor(Date.now() / 1000);

    switch (action) {
      case API_ACTIONS.SWITCH_LANE:
        await repo.switchLane(payload.lane, now);
        break;

      case API_ACTIONS.SWITCH_ALL:
        for (let lane = 0; lane < 5; lane++) {
          await repo.switchLane(lane, now);
        }
        break;

      case API_ACTIONS.TOGGLE_PAUSE:
        const { target } = payload;
        const current = (await repo.getGameState()).is_paused;
        const next = target !== undefined ? (target ? true : false) : !current;
        await repo.togglePause(next, now);
        break;

      case API_ACTIONS.MOVE_LANE:
        await repo.moveLane(payload.id, payload.lane, now);
        break;

      case API_ACTIONS.RESET_GAME:
        await repo.resetGame(now);
        break;

      case API_ACTIONS.SYNC_WALL_CLOCK: // New action for direct wall clock sync
        await repo.syncWallClock(payload.newTime, now);
        break;

      case API_ACTIONS.TOGGLE_PENALTY:
        await repo.togglePenalty(payload.id, now);
        break;
    }

    return new Response(JSON.stringify({ success: true, serverTime: Date.now() / 1000 }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, serverTime: Date.now() / 1000 }), { status: 500 });
  }
};