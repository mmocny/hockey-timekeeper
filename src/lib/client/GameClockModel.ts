import { atom } from 'nanostores';

interface GameStateFromServer {
  is_paused: boolean;
  base_game_time: number; // Server's base accumulated time
  last_resume_time: number; // Server's timestamp when last resumed
  current_elapsed_time: number; // Server's current calculated total elapsed time
}

// Global nanostore to hold the server's raw clock state (used to initialize GameClockModel)
export const serverClockState = atom({
  is_paused: true,
  base_game_time: 0,
  last_resume_time: 0,
  current_elapsed_time: 0,
});

export class GameClockModel {
  // Local state for smooth display, independent of server updates jitter
  private _localIsPaused: boolean;
  private _localBaseTime: number; // The time this clock is currently displaying when paused
  private _localLastResumeTime: number; // The client's adjusted timestamp when it last resumed
  private _clockSkew: number; // Offset: client_now - server_now
  private _displayInterval: ReturnType<typeof setInterval> | null = null;

  // Reactive store for UI to subscribe to
  public currentDisplayTime = atom(0);

  // Flag to indicate this client initiated a clock sync, so it ignores server updates for a bit
  private _isSyncInitiator: boolean = false;
  private _syncInitiatorTimeout: ReturnType<typeof setTimeout> | null = null;
  private _initiatorWallClockValue: number = 0; // The exact value typed by the user, if this client initiated sync

  constructor(initialServerState: GameStateFromServer, initialClockSkew: number) {
    this._localIsPaused = initialServerState.is_paused;
    this._localBaseTime = initialServerState.current_elapsed_time; // Initialize local clock to server's current time
    this._localLastResumeTime = Math.floor(Date.now() / 1000) - initialClockSkew; // Adjust to server time frame
    this._clockSkew = initialClockSkew;

    this.updateDisplayTime();
    this.startTicker();
  }

  // Exposed getters for current internal state (useful for context and actions)
  public getPausedState(): boolean { return this._localIsPaused; }
  public getClockSkew(): number { return this._clockSkew; }
  public getCurrentElapsed(): number { return this.currentDisplayTime.get(); } // Return current displayed time

  private startTicker() {
    if (this._displayInterval) return;
    this._displayInterval = setInterval(() => {
      this.updateDisplayTime();
    }, 200); // Update frequently for smooth visual second transitions
  }

  private stopTicker() {
    if (this._displayInterval) {
      clearInterval(this._displayInterval);
      this._displayInterval = null;
    }
  }

  private getAdjustedNow(): number {
    return Math.floor(Date.now() / 1000) - this._clockSkew;
  }

  private updateDisplayTime() {
    let newDisplayTime = this._localBaseTime;
    if (!this._localIsPaused) {
      newDisplayTime += (this.getAdjustedNow() - this._localLastResumeTime);
    }
    this.currentDisplayTime.set(Math.round(newDisplayTime));
  }

  // Called when user presses the Sync button
  public syncToWallClock(newWallClockTime: number) {
    this._initiatorWallClockValue = newWallClockTime;
    this._isSyncInitiator = true;
    this._localBaseTime = newWallClockTime; // Immediate visual update
    if (!this._localIsPaused) {
        this._localLastResumeTime = this.getAdjustedNow(); // Reset start time if running
    }
    this.updateDisplayTime(); // Force update

    // Clear initiator flag after a short period, assuming server has responded
    if (this._syncInitiatorTimeout) clearTimeout(this._syncInitiatorTimeout);
    this._syncInitiatorTimeout = setTimeout(() => {
      this._isSyncInitiator = false;
      this._syncInitiatorTimeout = null;
    }, 3000); // Give server 3s to respond and long-poll to catch up
  }

  // Called when server sends an update via long-polling or initial sync
  public onServerUpdate(serverState: GameStateFromServer, newClockSkew: number) {
    // Check if this client just initiated a sync. If so, ignore server update for base time.
    if (this._isSyncInitiator) {
      // If server's time matches our input, clear the initiator flag
      if (Math.abs(serverState.current_elapsed_time - this._initiatorWallClockValue) < 2) { // Allow minor drift
        this._isSyncInitiator = false;
        if (this._syncInitiatorTimeout) clearTimeout(this._syncInitiatorTimeout);
        this._syncInitiatorTimeout = null;
      } else {
        // If server's time is different and we're still initiator, ignore this server update
        return;
      }
    }

    // Update internal clock skew
    if (this._clockSkew === 0 || Math.abs(newClockSkew - this._clockSkew) > 1) { // Only update if significant drift
      this._clockSkew = newClockSkew;
    }

    // Update local clock state with server's authoritative values
    this._localIsPaused = serverState.is_paused;
    
    // Smooth adjustment: Only snap if server time drifts significantly from local display
    const currentLocalDisplayedTime = this.currentDisplayTime.get();
    if (Math.abs(serverState.current_elapsed_time - currentLocalDisplayedTime) > 1 || serverState.is_paused !== this._localIsPaused) {
      this._localBaseTime = serverState.current_elapsed_time;
      this._localLastResumeTime = this.getAdjustedNow(); // Always reset start time to current adjusted now if changing base
    }

    this.updateDisplayTime();
  }

  // Called when Play/Pause button is pressed
  public togglePause(isPaused: boolean) {
    this._localIsPaused = isPaused;
    if (isPaused) {
      // Pausing: Finalize current running time into base
      this._localBaseTime = this.currentDisplayTime.get();
      this._localLastResumeTime = 0; // Not running
    } else {
      // Resuming: Set new start time
      this._localLastResumeTime = this.getAdjustedNow();
    }
    this.updateDisplayTime();
  }

  public resetGame() {
    this._localBaseTime = 0;
    this._localLastResumeTime = 0;
    this._localIsPaused = true;
    this.updateDisplayTime();
  }

  public destroy() {
    this.stopTicker();
  }
}