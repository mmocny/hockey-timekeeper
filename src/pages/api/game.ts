import type { APIRoute } from 'astro';

async function performShiftChange(DB: any, lane: number, now: number) {
  const players = await DB.prepare("SELECT * FROM players WHERE lane = ? ORDER BY queue_order ASC").bind(lane).all();
  const gameState = await DB.prepare("SELECT * FROM game_state WHERE id = 'active_game'").first();
  
  if (players.results.length === 0) return;

  const currentOnIce = players.results.find((p: any) => p.is_on_ice);
  const nextOnIce = players.results.find((p: any) => !p.is_on_ice);

  if (currentOnIce) {
    let newTotalTime = currentOnIce.total_time;
    if (currentOnIce.last_shift_started && !gameState.is_paused) {
      newTotalTime += (now - currentOnIce.last_shift_started);
    }
    const maxOrder = Math.max(...players.results.map((p: any) => p.queue_order));
    await DB.prepare("UPDATE players SET is_on_ice = 0, total_time = ?, last_shift_started = NULL, queue_order = ? WHERE id = ?")
      .bind(newTotalTime, maxOrder + 1, currentOnIce.id).run();
  }

  if (nextOnIce) {
    await DB.prepare("UPDATE players SET is_on_ice = 1, last_shift_started = ? WHERE id = ?")
      .bind(gameState.is_paused ? null : now, nextOnIce.id).run();
  }

  const updatedPlayers = await DB.prepare("SELECT id FROM players WHERE lane = ? ORDER BY queue_order ASC").bind(lane).all();
  for (let i = 0; i < updatedPlayers.results.length; i++) {
    await DB.prepare("UPDATE players SET queue_order = ? WHERE id = ?").bind(i, updatedPlayers.results[i].id).run();
  }
}

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = locals.runtime.env;
  try {
    const players = await DB.prepare("SELECT * FROM players ORDER BY lane ASC, queue_order ASC").all();
    const gameState = await DB.prepare("SELECT * FROM game_state WHERE id = 'active_game'").first();
    return new Response(JSON.stringify({ players: players.results, gameState }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ players: [], gameState: { is_paused: 1, game_time: 0 } }), { status: 200 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { DB } = locals.runtime.env;
  try {
    const { action, payload, timestamp } = await request.json();
    // Use client timestamp if provided (and reasonable), otherwise server time
    // We treat the client timestamp as the "truth" for when the button was clicked
    const now = timestamp ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000);

    if (action === 'next_shift') {
      const { lane } = payload;
      await performShiftChange(DB, lane, now);
    }

    if (action === 'switch_all') {
      for (let lane = 0; lane < 5; lane++) {
        await performShiftChange(DB, lane, now);
      }
    }

    if (action === 'toggle_pause') {
      const { target } = payload;
      const gameState = await DB.prepare("SELECT * FROM game_state WHERE id = 'active_game'").first();
      const newIsPaused = target !== undefined ? (target ? 1 : 0) : (gameState.is_paused ? 0 : 1);
      
      if (newIsPaused === gameState.is_paused) return new Response(JSON.stringify({ success: true }));
  
      if (newIsPaused) {
        const onIcePlayers = await DB.prepare("SELECT * FROM players WHERE is_on_ice = 1").all();
        for (const player of onIcePlayers.results) {
          if (player.last_shift_started) {
            const addedTime = now - player.last_shift_started;
            await DB.prepare("UPDATE players SET total_time = total_time + ?, last_shift_started = NULL WHERE id = ?").bind(addedTime, player.id).run();
          }
        }
      } else {
        await DB.prepare("UPDATE players SET last_shift_started = ? WHERE is_on_ice = 1").bind(now).run();
      }
      await DB.prepare("UPDATE game_state SET is_paused = ?, updated_at = ? WHERE id = 'active_game'").bind(newIsPaused, now).run();
    }

    if (action === 'move_lane') {
      const { id, lane } = payload;
      const maxOrderResult = await DB.prepare("SELECT MAX(queue_order) as maxOrder FROM players WHERE lane = ?").bind(lane).first();
      const nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;
      await DB.prepare("UPDATE players SET lane = ?, queue_order = ?, is_on_ice = 0 WHERE id = ?").bind(lane, nextOrder, id).run();
    }

    if (action === 'reset_game') {
      await DB.prepare("UPDATE players SET total_time = 0, is_on_ice = 0, last_shift_started = NULL").run();
      await DB.prepare("UPDATE game_state SET is_paused = 1, game_time = 0, updated_at = ? WHERE id = 'active_game'").bind(now).run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
