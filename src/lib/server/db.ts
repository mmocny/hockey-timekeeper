import type { D1Database } from '@cloudflare/workers-types';
import type { Player, GameState } from '../shared/types';

export class GameRepository {
  constructor(private db: D1Database) {}

  async getAllPlayers(): Promise<Player[]> {
    const result = await this.db.prepare(
      "SELECT * FROM players ORDER BY lane ASC, queue_order ASC"
    ).all<Player>();
    return result.results || [];
  }

  async getGameState(): Promise<GameState> {
    const result = await this.db.prepare(
      "SELECT * FROM game_state WHERE id = 'active_game'"
    ).first<GameState>();
    return result || { is_paused: true, game_time: 0, updated_at: 0 };
  }

  async getGameTimestamp(): Promise<number> {
    const result = await this.db.prepare(
      "SELECT updated_at FROM game_state WHERE id = 'active_game'"
    ).first<{ updated_at: number }>();
    return result?.updated_at || 0;
  }

  async getLanePlayers(lane: number): Promise<Player[]> {
    const result = await this.db.prepare(
      "SELECT * FROM players WHERE lane = ? ORDER BY queue_order ASC"
    ).bind(lane).all<Player>();
    return result.results || [];
  }

  async updatePlayer(id: string, updates: Partial<Player>) {
    // Dynamically build update query
    const keys = Object.keys(updates).filter(k => k !== 'id');
    if (keys.length === 0) return;

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => {
      const val = (updates as any)[k];
      return val === undefined ? null : val;
    });

    await this.db.prepare(
      `UPDATE players SET ${setClause} WHERE id = ?`
    ).bind(...values, id).run();
  }

  async updateGameState(updates: Partial<GameState>, now: number) {
    const keys = Object.keys(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => {
      const val = (updates as any)[k];
      return val === undefined ? null : val;
    });

    // Always update updated_at
    const query = keys.length > 0 
      ? `UPDATE game_state SET ${setClause}, updated_at = ? WHERE id = 'active_game'`
      : `UPDATE game_state SET updated_at = ? WHERE id = 'active_game'`;

    await this.db.prepare(query).bind(...values, now).run();
  }

  async resetGame(now: number) {
    await this.db.prepare("UPDATE players SET total_time = 0, last_shift_started = NULL").run();
    await this.db.prepare(
      "UPDATE game_state SET is_paused = 1, game_time = 0, updated_at = ? WHERE id = 'active_game'"
    ).bind(now).run();
  }

  async normalizeLane(lane: number, now: number) {
    const players = await this.getLanePlayers(lane);
    const gameState = await this.getGameState();

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.queue_order !== i) {
        let lastShiftStarted = p.last_shift_started;
        // If moving TO 0 (On Ice) and game is active, start clock
        if (i === 0 && lane < 6 && !gameState.is_paused) {
           lastShiftStarted = now;
        }
        await this.db.prepare(
          "UPDATE players SET queue_order = ?, last_shift_started = ? WHERE id = ?"
        ).bind(i, lastShiftStarted, p.id).run();
      }
    }
  }

  async syncClock(direction: 'up' | 'down', now: number) {
    const gameState = await this.getGameState();
    
    // Calculate current total time
    let totalTime = gameState.game_time;
    if (!gameState.is_paused) {
      totalTime += (now - gameState.updated_at);
    }

    const seconds = totalTime % 60;
    let delta = 0;

    if (direction === 'down') {
      // Snap down to previous minute
      delta = seconds === 0 ? -60 : -seconds;
    } else {
      // Snap up to next minute
      delta = seconds === 0 ? 60 : (60 - seconds);
    }

    // Apply delta to game_time (base offset)
    // Ensure we don't go negative total time
    if (totalTime + delta < 0) {
      delta = -totalTime;
    }

    await this.updateGameState({ game_time: gameState.game_time + delta }, now);
  }

  async moveLane(id: string, lane: number, now: number) {
    const player = await this.db.prepare("SELECT * FROM players WHERE id = ?").bind(id).first<Player>();
    if (!player) return;

    const gameState = await this.getGameState();

    // Finalize time if active
    let newTotalTime = player.total_time;
    if (player.last_shift_started && !gameState.is_paused) {
      newTotalTime += (now - player.last_shift_started);
    }

    // Determine new order (append to end)
    const maxOrderResult = await this.db.prepare(
      "SELECT MAX(queue_order) as maxOrder FROM players WHERE lane = ?"
    ).bind(lane).first<{ maxOrder: number }>();
    const nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;
    
    // Check if moving to On Ice immediately (empty lane)
    let lastShiftStarted = null;
    if (nextOrder === 0 && lane < 6 && !gameState.is_paused) {
      lastShiftStarted = now;
    }

    await this.db.prepare(
      "UPDATE players SET lane = ?, queue_order = ?, total_time = ?, last_shift_started = ? WHERE id = ?"
    ).bind(lane, nextOrder, newTotalTime, lastShiftStarted, id).run();

    // Re-index the OLD lane to close gaps and promote next player to On Ice
    if (player.lane !== lane || nextOrder !== player.queue_order) {
       await this.normalizeLane(player.lane, now);
    }
    
    // If we moved within the same lane (drag to back), the normalizeLane above handles the gap.
    // Wait, if I moved to same lane, I appended to end (e.g. from 0 to 5).
    // The gap is at 0.
    // normalizeLane(lane) will see:
    // Old 1 -> New 0. (Starts clock).
    // Old 2 -> New 1.
    // ...
    // The moved player is at 5. It stays at 5 (matches i=5).
    // This seems correct.

    await this.updateGameState({}, now);
  }

  async switchLane(lane: number, now: number) {
    const players = await this.getLanePlayers(lane);
    if (players.length === 0) return;

    const gameState = await this.getGameState();
    const currentOnIce = players[0];

    // 1. Finalize time for the player coming OFF
    if (currentOnIce) {
      let newTotalTime = currentOnIce.total_time;
      if (currentOnIce.last_shift_started && !gameState.is_paused) {
        newTotalTime += (now - currentOnIce.last_shift_started);
      }
      // Move to back
      await this.updatePlayer(currentOnIce.id, {
        queue_order: players.length - 1,
        total_time: newTotalTime,
        last_shift_started: undefined // Will be converted to null
      });
    }

    // 2. Shift everyone else up
    for (let i = 1; i < players.length; i++) {
      const p = players[i];
      const newOrder = p.queue_order - 1;
      
      // If moving to 0 and game is active, start shift
      const lastShiftStarted = (newOrder === 0 && !gameState.is_paused) ? now : null;

      await this.db.prepare(
        "UPDATE players SET queue_order = ?, last_shift_started = ? WHERE id = ?"
      ).bind(newOrder, lastShiftStarted, p.id).run();
    }
    
    await this.updateGameState({}, now);
  }

  async togglePause(isPaused: boolean, now: number) {
    const gameState = await this.getGameState();
    if (gameState.is_paused === isPaused) return;

    if (isPaused) {
      // Pausing: Finalize time for all active players AND game clock
      const onIcePlayersResult = await this.db.prepare(
        "SELECT * FROM players WHERE queue_order = 0 AND lane < 6"
      ).all<Player>();
      
      for (const player of onIcePlayersResult.results) {
        if (player.last_shift_started) {
          const addedTime = now - player.last_shift_started;
          await this.db.prepare(
            "UPDATE players SET total_time = total_time + ?, last_shift_started = NULL WHERE id = ?"
          ).bind(addedTime, player.id).run();
        }
      }

      // Update game clock
      const sessionDuration = now - gameState.updated_at;
      await this.updateGameState({ is_paused: true, game_time: gameState.game_time + sessionDuration }, now);

    } else {
      // Resuming: Start clock for all active players
      await this.db.prepare(
        "UPDATE players SET last_shift_started = ? WHERE queue_order = 0 AND lane < 6"
      ).bind(now).run();
      
      // Update state (sets updated_at to now, which becomes the new start time)
      await this.updateGameState({ is_paused: false }, now);
    }
  }
}
