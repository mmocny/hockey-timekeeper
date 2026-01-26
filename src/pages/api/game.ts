import type { APIRoute } from 'astro';
import { API_ACTIONS } from '../../lib/shared/types';
import { GameRepository } from '../../lib/server/db';

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = locals.runtime.env;
  const repo = new GameRepository(DB);

  try {
    const [players, gameState] = await Promise.all([
      repo.getAllPlayers(),
      repo.getGameState()
    ]);
    return new Response(JSON.stringify({ players, gameState }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    // Fallback if DB is not initialized locally
    return new Response(JSON.stringify({ players: [], gameState: { is_paused: 1, game_time: 0 } }), { status: 200 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { DB } = locals.runtime.env;
  const repo = new GameRepository(DB);

  try {
    const { action, payload, timestamp } = await request.json();
    const now = timestamp ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000);

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
        await repo.moveLane(payload.id, payload.lane);
        break;

      case API_ACTIONS.RESET_GAME:
        await repo.resetGame(now);
        break;
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};