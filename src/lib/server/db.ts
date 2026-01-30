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
    await this.db.prepare("UPDATE players SET total_time = 0, last_shift_started = NULL").run();
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
      if (p.queue_order !== i) {
        let lastShiftStarted = p.last_shift_started;
        if (i === 0 && lane < 6) {
           // If becoming active (0), set start time to current GAME time if not already set?
           // Actually, if we are normalizing, we assume shift starts NOW if it wasn't already active?
           // This is tricky. normalizeLane usually runs after a move.
           // If moved to pos 0, shift starts.
           lastShiftStarted = gameTime;
        }
        await this.db.prepare(
          "UPDATE players SET queue_order = ?, last_shift_started = ? WHERE id = ?"
        ).bind(i, lastShiftStarted, p.id).run();
      }
    }
  }

  async syncWallClock(newElapsedTime: number, now: number) {
    const gameState = await this.getGameState();

    // If game is paused, newElapsedTime is just the accumulated base
    let newBaseTime = newElapsedTime;
    
    // If game is active, newElapsedTime = base + (now - resume).
    // So base = newElapsedTime - (now - resume).
    if (!gameState.is_paused) {
      newBaseTime = newElapsedTime - (now - gameState.last_resume_time);
    }

    await this.updateGameState({ base_game_time: newBaseTime }, now);
  }

  async moveLane(id: string, lane: number, now: number) {
    const player = await this.db.prepare("SELECT * FROM players WHERE id = ?").bind(id).first<Player>();
    if (!player) return;

    const gameState = await this.getGameState();
    const gameTime = this._calculateGameTime(gameState, now);

    let newTotalTime = player.total_time;
    if (player.last_shift_started !== null && player.last_shift_started !== undefined) {
      newTotalTime += (gameTime - player.last_shift_started);
    }

    const maxOrderResult = await this.db.prepare(
      "SELECT MAX(queue_order) as maxOrder FROM players WHERE lane = ?"
    ).bind(lane).first<{ maxOrder: number }>();
    const nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;
    
    let lastShiftStarted = null;
    if (nextOrder === 0 && lane < 6) {
      lastShiftStarted = gameTime;
    }

    await this.db.prepare(
      "UPDATE players SET lane = ?, queue_order = ?, total_time = ?, last_shift_started = ? WHERE id = ?"
    ).bind(lane, nextOrder, newTotalTime, lastShiftStarted, id).run();

    if (player.lane !== lane || nextOrder !== player.queue_order) {
       await this.normalizeLane(player.lane, now);
    }
    
    await this.updateGameState({}, now);
  }

  async switchLane(lane: number, now: number) {
    const players = await this.getLanePlayers(lane);
    if (players.length === 0) return;

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
      // No player updates needed!
      
      await this.updateGameState({ is_paused: false, last_resume_time: now }, now);
    }
  }
}
