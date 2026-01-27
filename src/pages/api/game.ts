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

    while (Date.now() - start < timeout) {
      // If we are polling (since > 0), check timestamp first
      if (since > 0) {
        const currentTs = await repo.getGameTimestamp();
        if (currentTs <= since) {
          // No update yet, wait 500ms
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
      }

      // If we are here, either it's a fresh request (since=0) or we found an update
      const [players, gameState] = await Promise.all([
        repo.getAllPlayers(),
        repo.getGameState()
      ]);
      return new Response(JSON.stringify({ players, gameState }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Timeout reached, return empty 304 or just the current state?
    // Returning current state ensures eventual consistency even if we missed the edge trigger
    // But returning 304 Not Modified is cleaner for bandwidth.
    // Let's stick to returning JSON to simplify client logic (it just overwrites).
    // Or we can return a specific "no change" signal.
    // Simplest for now: Return the current state anyway. It's safer.
    
    const [players, gameState] = await Promise.all([
      repo.getAllPlayers(),
      repo.getGameState()
    ]);
    return new Response(JSON.stringify({ players, gameState }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    // Fallback if DB is not initialized locally
    return new Response(JSON.stringify({ players: [], gameState: { is_paused: 1, game_time: 0, updated_at: 0 } }), { status: 200 });
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

      case API_ACTIONS.SYNC_CLOCK:
        await repo.syncClock(payload.direction, now);
        break;
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};