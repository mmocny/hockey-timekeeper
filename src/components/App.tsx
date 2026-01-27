import React, { useEffect, useOptimistic, useTransition, use, useState } from 'react';
import { useStore } from '@nanostores/react';
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { playersStore, isPaused as isPausedStore, gameTime as gameTimeStore, updatedAt as updatedAtStore, startPolling, abortPolling, commitLocalUpdate } from '../lib/client/store';
import * as serverActions from '../lib/client/actions';
import { ActivePlayerCard, InactivePlayerCard, EmptyPlayerCard } from './PlayerCard';
import { DraggablePlayer } from './DraggablePlayer';
import { DroppableLane } from './DroppableLane';
import { DropPlaceholder } from './DropPlaceholder';
import { GlobalControls } from './GlobalControls';
import { InstructionsModal } from './InstructionsModal';
import { Stats } from './Stats';
import { GameContext } from '../lib/client/context';
import { LANE_NAMES, type Player } from '../lib/shared/types';
import { RotateCcw, ChevronRight, Info } from 'lucide-react';

// --- Reducers for Optimistic State ---

type PlayerAction = 
  | { type: 'update_players'; updates: Record<string, Partial<Player>> }
  | { type: 'set_pause'; isPaused: boolean }
  | { type: 'reset_game' };

function playerReducer(state: Player[], action: PlayerAction): Player[] {
  switch (action.type) {
    case 'update_players': {
      return state.map(p => {
        const update = action.updates[p.id];
        return update ? { ...p, ...update } : p;
      });
    }
    case 'set_pause': {
      // Logic for pausing is handled by gameActions calculating the new state or just the flag
      // But we need to update last_shift_started if pausing/resuming?
      // Actually, if we use explicit 'update_players' for everything, we might not need this?
      // But toggle_pause affects ALL active players.
      // Let's keep it simple: toggle_pause logic can also be pre-calculated!
      // But wait, the hook 'optimisticPaused' is separate.
      // So this reducer is ONLY for players.
      // The pause state is handled by the other useOptimistic.
      // However, we DO need to update 'last_shift_started' on players when pausing.
      // So 'update_players' is sufficient!
      return state;
    }
    case 'reset_game': {
      return state.map(p => ({ ...p, total_time: 0, last_shift_started: undefined }));
    }
    default:
      return state;
  }
}

// --- Components ---

const LaneRow: React.FC<{ laneIdx: number }> = ({ laneIdx }) => {
  const { players, actions } = use(GameContext)!;

  const lanePlayers = players
    .filter(p => p.lane === laneIdx)
    .sort((a, b) => a.queue_order - b.queue_order);
  
  const onIce = lanePlayers[0];
  const onDeck = lanePlayers[1];
  const tail = lanePlayers.slice(2);

  return (
    <DroppableLane laneId={laneIdx} className="py-1.5 border-b border-slate-900 last:border-0 cursor-pointer">
      {({ isOver }) => {
        const showOnIcePlaceholder = isOver && lanePlayers.length === 0;
        const showOnDeckPlaceholder = isOver && lanePlayers.length === 1;
        const showQueuePlaceholder = isOver && lanePlayers.length >= 2;

        return (
          <div 
            onClick={() => actions.switchLane(laneIdx)}
          >
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">{LANE_NAMES[laneIdx]}</span>
              <div className="h-px bg-slate-900 flex-1"></div>
            </div>

            <div className="flex items-center gap-2 min-h-[44px] px-1 overflow-hidden">
              <div className="w-36 shrink-0">
                {onIce ? (
                  <DraggablePlayer id={onIce.id}>
                    <ActivePlayerCard key={onIce.id} player={onIce} />
                  </DraggablePlayer>
                ) : showOnIcePlaceholder ? (
                  <DropPlaceholder />
                ) : (
                  <div><EmptyPlayerCard type="active" /></div>
                )}
              </div>

              <ChevronRight className="w-3 h-3 text-slate-800 shrink-0" />

              <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 items-center">
                {/* On Deck Slot */}
                <div className="shrink-0">
                  {onDeck ? (
                    <DraggablePlayer id={onDeck.id}>
                      <InactivePlayerCard key={onDeck.id} player={onDeck} />
                    </DraggablePlayer>
                  ) : showOnDeckPlaceholder ? (
                    <DropPlaceholder />
                  ) : (
                    <div><EmptyPlayerCard /></div>
                  )}
                </div>

                {/* Queue Tail */}
                {tail.map(p => (
                  <DraggablePlayer key={p.id} id={p.id}>
                    <div className="shrink-0 grayscale opacity-40">
                      <InactivePlayerCard player={p} />
                    </div>
                  </DraggablePlayer>
                ))}
                
                {/* Append Placeholder if Queue active */}
                {showQueuePlaceholder && <DropPlaceholder />}
                
                {/* Empty State Text (only if On Deck player exists but tail is empty) */}
                {!isOver && onDeck && tail.length === 0 && <div className="text-[8px] font-bold text-slate-800 uppercase italic self-center ml-2">Queue Empty</div>}
              </div>
            </div>
          </div>
        );
      }}
    </DroppableLane>
  );
};

const Bench: React.FC = () => {
  const { players, actions } = use(GameContext)!;
  const benchPlayers = players
    .filter(p => p.lane === 6)
    .sort((a, b) => a.queue_order - b.queue_order);

  return (
    <section className="mt-4">
      <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2">Bench / Unassigned</h2>
      <DroppableLane laneId={6} className="p-2 min-h-[100px] border border-slate-900 border-dashed bg-slate-950/30 rounded-lg">
        {({ isOver }) => (
          <div className="flex flex-wrap gap-2">
            {benchPlayers.map(p => (
                          <DraggablePlayer key={p.id} id={p.id}>
                            <div 
                              onClick={() => {
                                const lane = prompt('Assign to lane (0:C, 1:LW, 2:RW, 3:LD, 4:RD, 5:G, 7:Absent)?');
                                if (lane !== null) actions.moveLane(p.id, parseInt(lane));
                              }}
                            >
                              <InactivePlayerCard player={p} />
                            </div>
                          </DraggablePlayer>            ))}
            {isOver && <DropPlaceholder />}
            {!isOver && benchPlayers.length === 0 && <span className="text-[10px] text-slate-700 font-bold uppercase p-2">Bench Empty</span>}
          </div>
        )}
      </DroppableLane>
    </section>
  );
};

const Absent: React.FC = () => {
  const { players, actions } = use(GameContext)!;
  const absentPlayers = players
    .filter(p => p.lane === 7)
    .sort((a, b) => a.queue_order - b.queue_order);

  return (
    <section className="mt-4 opacity-60 hover:opacity-100 transition-opacity">
      <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2">Absent / Scratched</h2>
      <DroppableLane laneId={7} className="p-2 min-h-[80px] border border-slate-900 border-dashed bg-slate-950/20 rounded-lg">
        {({ isOver }) => (
          <div className="flex flex-wrap gap-2">
            {absentPlayers.map(p => (
              <DraggablePlayer key={p.id} id={p.id}>
                <div 
                  onClick={() => {
                    const lane = prompt('Assign to lane (0:C, 1:LW, 2:RW, 3:LD, 4:RD, 5:G, 6:Bench)?');
                    if (lane !== null) actions.moveLane(p.id, parseInt(lane));
                  }}
                >
                  <InactivePlayerCard player={p} />
                </div>
              </DraggablePlayer>
            ))}
            {isOver && <DropPlaceholder />}
            {!isOver && absentPlayers.length === 0 && <span className="text-[10px] text-slate-700 font-bold uppercase p-2">No Absent Players</span>}
          </div>
        )}
      </DroppableLane>
    </section>
  );
};

// --- Main App ---

export const App: React.FC = () => {
  useEffect(() => { startPolling(); }, []);

  // Configure sensors for better mobile scrolling
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });
  
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  // 1. Read Server State
  const serverPlayers = useStore(playersStore);
  const serverPaused = useStore(isPausedStore);
  const serverGameTime = useStore(gameTimeStore);
  const serverUpdatedAt = useStore(updatedAtStore);
  const playerList = Object.values(serverPlayers);

  // 2. Setup Optimistic State
  const [optimisticPlayers, setOptimisticPlayers] = useOptimistic(
    playerList,
    playerReducer
  );
  
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(
    serverPaused,
    (state, newState: boolean) => newState
  );

  const [optimisticGameTime, setOptimisticGameTime] = useOptimistic(
    serverGameTime,
    (state, delta: number) => state + delta
  );

  // 3. Setup Transitions
  const [isPending, startTransition] = useTransition();
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [isInstructionsOpen, setInstructionsOpen] = useState(false);

  // 4. Define Actions
  const gameActions = {
    syncClock: (direction: 'up' | 'down') => {
      const now = Math.floor(Date.now() / 1000);
      const currentTotal = optimisticGameTime + (optimisticPaused ? 0 : now - serverUpdatedAt);
      const seconds = currentTotal % 60;
      let delta = 0;
      
      if (direction === 'down') delta = seconds === 0 ? -60 : -seconds;
      else delta = seconds === 0 ? 60 : (60 - seconds);

      if (currentTotal + delta < 0) delta = -currentTotal;
      
      const newGameTime = optimisticGameTime + delta;

      // 1. Kill stale poll
      abortPolling();
      // 2. Commit to local store (base state)
      commitLocalUpdate({}, { game_time: newGameTime });

      startTransition(async () => {
        // 3. Optimistic update (redundant but keeps UI consistent during transition)
        setOptimisticGameTime(delta);
        await serverActions.syncClock(direction);
      });
    },
    switchLane: (lane: number) => {
      const now = Math.floor(Date.now() / 1000);
      const lanePlayers = optimisticPlayers.filter(p => p.lane === lane).sort((a, b) => a.queue_order - b.queue_order);
      if (lanePlayers.length === 0) return;

      const current = lanePlayers[0];
      const maxOrder = Math.max(...lanePlayers.map(p => p.queue_order));
      const updates: Record<string, Partial<Player>> = {};

      lanePlayers.forEach(p => {
        if (p.id === current.id) {
          let newTotal = p.total_time;
          if (p.last_shift_started && !optimisticPaused) {
            newTotal += (now - p.last_shift_started);
          }
          updates[p.id] = { queue_order: maxOrder + 1, total_time: newTotal, last_shift_started: undefined };
        } else {
          const newOrder = p.queue_order - 1;
          const isNowActive = newOrder === 0 && !optimisticPaused;
          updates[p.id] = { 
            queue_order: newOrder, 
            last_shift_started: isNowActive ? now : undefined 
          };
        }
      });

      abortPolling();
      commitLocalUpdate(updates);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.switchLane(lane);
      });
    },
    switchAll: () => {
      const now = Math.floor(Date.now() / 1000);
      const updates: Record<string, Partial<Player>> = {};

      for (let lane = 0; lane < 5; lane++) {
        const lanePlayers = optimisticPlayers.filter(p => p.lane === lane).sort((a, b) => a.queue_order - b.queue_order);
        if (lanePlayers.length === 0) continue;

        const current = lanePlayers[0];
        const maxOrder = Math.max(...lanePlayers.map(p => p.queue_order));

        lanePlayers.forEach(p => {
          if (p.id === current.id) {
            let newTotal = p.total_time;
            if (p.last_shift_started && !optimisticPaused) {
              newTotal += (now - p.last_shift_started);
            }
            updates[p.id] = { ...updates[p.id], queue_order: maxOrder + 1, total_time: newTotal, last_shift_started: undefined };
          } else {
            const newOrder = p.queue_order - 1;
            const isNowActive = newOrder === 0 && !optimisticPaused;
            updates[p.id] = { 
              ...updates[p.id],
              queue_order: newOrder, 
              last_shift_started: isNowActive ? now : undefined 
            };
          }
        });
      }

      abortPolling();
      commitLocalUpdate(updates);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.switchAll();
      });
    },
    moveLane: (id: string, lane: number) => {
      const targetLanePlayers = optimisticPlayers.filter(p => p.lane === lane);
      const nextOrder = targetLanePlayers.length > 0 ? Math.max(...targetLanePlayers.map(p => p.queue_order)) + 1 : 0;
      
      const updates: Record<string, Partial<Player>> = {
        [id]: { lane, queue_order: nextOrder, last_shift_started: undefined }
      };

      abortPolling();
      commitLocalUpdate(updates);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.moveLane(id, lane);
      });
    },
    toggleGlobalPause: () => {
      const next = !optimisticPaused;
      const now = Math.floor(Date.now() / 1000);
      const updates: Record<string, Partial<Player>> = {};
      let gameTimeUpdate = optimisticGameTime;

      if (next) { // Pausing
        // Update Game Time
        gameTimeUpdate += (now - serverUpdatedAt);
      }

      optimisticPlayers.forEach(p => {
        const isOnIce = p.lane !== null && p.lane < 6 && p.queue_order === 0;
        if (!isOnIce) return;

        if (next) { // Pausing
          let newTotal = p.total_time;
          if (p.last_shift_started) {
            newTotal += (now - p.last_shift_started);
          }
          updates[p.id] = { total_time: newTotal, last_shift_started: undefined };
        } else { // Resuming
          updates[p.id] = { last_shift_started: now };
        }
      });

      abortPolling();
      commitLocalUpdate(updates, { is_paused: next, game_time: gameTimeUpdate, updated_at: now });

      startTransition(async () => {
        setOptimisticPaused(next);
        // Note: We don't have an optimisticGameTime setter for absolute value here easily?
        // Actually, we do: setOptimisticGameTime(delta).
        // Since we updated the base store, we don't strictly need to update optimisticGameTime if we pass 0?
        // Or better, we can update it.
        // But our reducer is `state + delta`.
        // If we update base, base changes.
        // `useOptimistic` resets.
        // So we don't need to do anything for gameTime in startTransition if we committed to store!
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.toggleGlobalPause(next);
      });
    },
    resetGame: async () => {
      if (!confirm('Are you sure you want to reset all game time?')) return;
      
      abortPolling();
      // Reset local store
      commitLocalUpdate({}, { is_paused: true, game_time: 0, updated_at: 0 });
      // Reset players (tricky to do partial update for all, better to let server refresh or loop all)
      // We can loop all optimisticPlayers
      const updates: Record<string, Partial<Player>> = {};
      optimisticPlayers.forEach(p => {
        updates[p.id] = { total_time: 0, last_shift_started: undefined };
      });
      commitLocalUpdate(updates);

      startTransition(async () => {
        setOptimisticPlayers({ type: 'reset_game' });
        setOptimisticPaused(true);
        setOptimisticGameTime(-optimisticGameTime); // Reset to 0
        await serverActions.resetGame();
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const player = optimisticPlayers.find(p => p.id === event.active.id);
    if (player) setActivePlayer(player);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);
    
    if (over && active.id !== over.id) {
      const playerId = active.id as string;
      const laneData = over.data.current as { laneIdx: number } | undefined;
      
      if (laneData !== undefined) {
        gameActions.moveLane(playerId, laneData.laneIdx);
      }
    }
  };

  if (playerList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium">Connecting...</p>
      </div>
    );
  }

  return (
    <GameContext.Provider value={{ players: optimisticPlayers, isPaused: optimisticPaused, gameTime: optimisticGameTime, updatedAt: serverUpdatedAt, actions: gameActions }}>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={`flex flex-col select-none ${isPending ? 'cursor-progress' : ''}`}>
                  <GlobalControls />
                  
                  <div className="space-y-1">            {[0, 1, 2, 3, 4, 5].map(idx => (
              <LaneRow key={idx} laneIdx={idx} />
            ))}
          </div>

          <Bench />
          <Absent />

          <Stats players={optimisticPlayers} isPaused={optimisticPaused} />

          <div className="mt-8 mb-8 flex justify-center gap-4">
            <button 
              onClick={gameActions.resetGame}
              className="flex items-center gap-2 px-6 py-2 rounded-lg border border-rose-900/20 text-rose-500/50 text-[10px] font-bold uppercase tracking-widest active:scale-95 hover:bg-rose-950/10 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>

            <button 
              onClick={() => setInstructionsOpen(true)}
              className="flex items-center gap-2 px-6 py-2 rounded-lg border border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-widest active:scale-95 hover:bg-slate-800 transition-colors"
            >
              <Info className="w-3 h-3" />
              Help
            </button>
          </div>
        </div>
        <DragOverlay>
          {activePlayer ? (
            <div className="opacity-90 rotate-3 cursor-grabbing shadow-2xl">
              {(activePlayer.lane < 6 && activePlayer.queue_order === 0) ? (
                <ActivePlayerCard player={activePlayer} />
              ) : (
                <InactivePlayerCard player={activePlayer} />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <InstructionsModal isOpen={isInstructionsOpen} onClose={() => setInstructionsOpen(false)} />
    </GameContext.Provider>
  );
};