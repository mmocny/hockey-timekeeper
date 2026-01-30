import type { D1Database } from '@cloudflare/workers-types';
import type { Player, GameState } from '../shared/types';

export class GameRepository {
  constructor(private db: D1Database) {}

  private _calculateGameTime(gameState: GameState, now: number): number {
    if (gameState.is_paused) {
      return gameState.base_game_time;
    }
    return gameState.base_game_time + (now - gameState.last_resume_time);
  }

  async getAllPlayers(): Promise<Player[]> {
    const result = await this.db.prepare(
      "SELECT * FROM players ORDER BY lane ASC, queue_order ASC"
    ).all<Player>();
    return result.results || [];
  }

  async getGameState(): Promise<GameState & { current_elapsed_time?: number }> {
    const result = await this.db.prepare(
      "SELECT * FROM game_state WHERE id = 'active_game'"
    ).first<GameState>();
    
    if (!result) return { is_paused: true, base_game_time: 0, last_resume_time: 0, updated_at: 0, current_elapsed_time: 0 };
    
    // Calculate current_elapsed_time
    let current_elapsed_time = result.base_game_time;
    if (!result.is_paused) {
      current_elapsed_time += (Math.floor(Date.now() / 1000) - result.last_resume_time);
    }

    return { ...result, current_elapsed_time };
  }

  // Used for long-polling check
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

    const query = keys.length > 0 
      ? `UPDATE game_state SET ${setClause}, updated_at = ? WHERE id = 'active_game'`
      : `UPDATE game_state SET updated_at = ? WHERE id = 'active_game'`;

    await this.db.prepare(query).bind(...values, now).run();
  }

  async resetGame(now: number) {
    await this.db.prepare("UPDATE players SET total_time = 0, total_penalty_time = 0, is_serving_penalty = 0, last_shift_started = NULL").run();
    await this.db.prepare(
      "UPDATE game_state SET is_paused = 1, base_game_time = 0, last_resume_time = 0, updated_at = ? WHERE id = 'active_game'"
    ).bind(now).run();
  }

  async normalizeLane(lane: number, now: number) {
    const players = await this.getLanePlayers(lane);
    const gameState = await this.getGameState();
    const gameTime = this._calculateGameTime(gameState, now);

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      // Standard sequential ordering
      const newOrder = i;
      
      // Determine Active Status
      // Lane 8 (Legacy Penalty) - treat as active if we still use it, but we are moving away.
      // Lanes 0-5 active if order is 0.
      // Additionally, if is_serving_penalty is true, they are active (timer running).
      // But we generally only allow penalty on active players (order 0).
      // So checking order 0 is sufficient for "Is this the active slot".
      // Then is_serving_penalty determines WHICH bucket it counts to.
      
      // But wait, if we have [PenaltyPlayer, Player B] in lane.
      // PenaltyPlayer is order 0.
      // Player B is order 1.
      // PenaltyPlayer is active (Penalty Timer).
      // Player B is NOT active.
      
      const isActive = (newOrder === 0 && lane < 6);
      
      let lastShiftStarted = p.last_shift_started;
      if (isActive) {
         if (lastShiftStarted === null || lastShiftStarted === undefined) {
            lastShiftStarted = gameTime;
         }
      } else {
         lastShiftStarted = null;
      }

      if (p.queue_order !== newOrder || p.last_shift_started !== lastShiftStarted) {
        await this.db.prepare(
          "UPDATE players SET queue_order = ?, last_shift_started = ? WHERE id = ?"
        ).bind(newOrder, lastShiftStarted, p.id).run();
      }
    }
  }

  async syncWallClock(newElapsedTime: number, now: number) {
    const gameState = await this.getGameState();
    const currentElapsedTime = this._calculateGameTime(gameState, now);
    const delta = newElapsedTime - currentElapsedTime;

    await this.db.prepare(
      "UPDATE players SET last_shift_started = last_shift_started + ? WHERE last_shift_started IS NOT NULL"
    ).bind(delta).run();

    let newBaseTime = newElapsedTime;
    if (!gameState.is_paused) {
      newBaseTime = newElapsedTime - (now - gameState.last_resume_time);
    }

    await this.updateGameState({ base_game_time: newBaseTime }, now);
  }

  async togglePenalty(id: string, now: number) {
    const player = await this.db.prepare("SELECT * FROM players WHERE id = ?").bind(id).first<Player>();
    if (!player) return;

    const gameState = await this.getGameState();
    const gameTime = this._calculateGameTime(gameState, now);

    let nextTotalTime = player.total_time;
    let nextTotalPenalty = player.total_penalty_time || 0;

    // Accumulate time for current state
    if (player.last_shift_started !== null && player.last_shift_started !== undefined) {
      const elapsed = gameTime - player.last_shift_started;
      if (player.is_serving_penalty) {
        nextTotalPenalty += elapsed;
      } else {
        nextTotalTime += elapsed;
      }
    }

    const nextIsServing = !player.is_serving_penalty;
    
    // Determine if timer should be running
    // Player must be "On Ice" (Order 0, Lane < 6) to have a running timer in either state.
    // Even if paused, we set start time to current GameTime so elapsed is 0.
    const isActive = (player.queue_order === 0 && player.lane < 6);
    const lastShiftStarted = isActive ? gameTime : null;

    await this.db.prepare(
      "UPDATE players SET total_time = ?, total_penalty_time = ?, is_serving_penalty = ?, last_shift_started = ? WHERE id = ?"
    ).bind(nextTotalTime, nextTotalPenalty, nextIsServing ? 1 : 0, lastShiftStarted, id).run();
    
    await this.updateGameState({}, now);
  }

  async moveLane(id: string, lane: number, now: number) {
    const player = await this.db.prepare("SELECT * FROM players WHERE id = ?").bind(id).first<Player>();
    if (!player) return;

    const gameState = await this.getGameState();
    const gameTime = this._calculateGameTime(gameState, now);

    let nextTotalTime = player.total_time;
    let nextTotalPenalty = player.total_penalty_time || 0;

    if (player.last_shift_started !== null && player.last_shift_started !== undefined) {
      const elapsed = gameTime - player.last_shift_started;
      if (player.is_serving_penalty) {
        nextTotalPenalty += elapsed;
      } else {
        nextTotalTime += elapsed;
      }
    }

    const maxOrderResult = await this.db.prepare(
      "SELECT MAX(queue_order) as maxOrder FROM players WHERE lane = ?"
    ).bind(lane).first<{ maxOrder: number }>();
    const nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;
    
    const isActive = (nextOrder === 0 && lane < 6);
    const lastShiftStarted = isActive ? gameTime : null;

    // When moving, clear penalty status? Usually yes.
    // If dragging to Bench, clears penalty.
    // If dragging to another line, clears penalty (fresh start).
    const nextIsServing = 0;

    await this.db.prepare(
      "UPDATE players SET lane = ?, queue_order = ?, total_time = ?, total_penalty_time = ?, is_serving_penalty = ?, last_shift_started = ? WHERE id = ?"
    ).bind(lane, nextOrder, nextTotalTime, nextTotalPenalty, nextIsServing, lastShiftStarted, id).run();

    if (player.lane !== lane || nextOrder !== player.queue_order) {
       await this.normalizeLane(player.lane, now);
    }
    
    await this.updateGameState({}, now);
  }

  async switchLane(lane: number, now: number) {
    const players = await this.getLanePlayers(lane);
    if (players.length === 0) return;

    // Check for Penalty - Lock the line
    if (players.some(p => p.is_serving_penalty)) {
        return;
    }

    const gameState = await this.getGameState();
    const gameTime = this._calculateGameTime(gameState, now);
    const currentOnIce = players[0];

    if (currentOnIce) {
      let newTotalTime = currentOnIce.total_time;
      if (currentOnIce.last_shift_started !== null && currentOnIce.last_shift_started !== undefined) {
        newTotalTime += (gameTime - currentOnIce.last_shift_started);
      }
      await this.updatePlayer(currentOnIce.id, {
        queue_order: players.length - 1,
        total_time: newTotalTime,
        last_shift_started: undefined 
      });
    }

    for (let i = 1; i < players.length; i++) {
      const p = players[i];
      const newOrder = p.queue_order - 1;
      const lastShiftStarted = (newOrder === 0) ? gameTime : null;

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
      // Pausing
      // No player updates needed! Shifts are defined by GameTime start.
      // GameTime stops progressing, so shift duration stops increasing.
      
      const sessionDuration = now - gameState.last_resume_time;
      await this.updateGameState({ is_paused: true, base_game_time: gameState.base_game_time + sessionDuration }, now);

    } else {
      // Resuming
      // If we are resuming after a reset (or any state where active players have NULL start time),
      // we must anchor them to the current game time so they start accumulating.
      const gameTime = gameState.base_game_time;
      await this.db.prepare(
        "UPDATE players SET last_shift_started = ? WHERE last_shift_started IS NULL AND ((queue_order = 0 AND lane < 6) OR is_serving_penalty = 1)"
      ).bind(gameTime).run();
      
      await this.updateGameState({ is_paused: false, last_resume_time: now }, now);
    }
  }
}
