import React, { useEffect, useOptimistic, useTransition, use } from 'react';
import { useStore } from '@nanostores/react';
import { playersStore, isPaused as isPausedStore, startPolling } from '../lib/client/store';
import * as serverActions from '../lib/client/actions';
import { ActivePlayerCard, InactivePlayerCard, EmptyPlayerCard } from './PlayerCard';
import { GlobalControls } from './GlobalControls';
import { Stats } from './Stats';
import { GameContext } from '../lib/client/context';
import { LANE_NAMES, type Player } from '../lib/shared/types';
import { RotateCcw, ChevronRight } from 'lucide-react';

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
    <div 
      onClick={() => actions.switchLane(laneIdx)}
      className="py-2 border-b border-slate-900 last:border-0 cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">{LANE_NAMES[laneIdx]}</span>
        <div className="h-px bg-slate-900 flex-1"></div>
      </div>

      <div className="flex items-center gap-2 min-h-[44px] px-1">
        <div className="w-28 shrink-0">
          {onIce ? (
            <ActivePlayerCard key={onIce.id} player={onIce} />
          ) : (
            <div><EmptyPlayerCard type="active" /></div>
          )}
        </div>

        <ChevronRight className="w-3 h-3 text-slate-800 shrink-0" />

        <div className="w-28 shrink-0">
          {onDeck ? (
            <InactivePlayerCard key={onDeck.id} player={onDeck} />
          ) : (
            <div><EmptyPlayerCard /></div>
          )}
        </div>

        <div className="w-px h-8 bg-slate-900 shrink-0 mx-1"></div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 flex-1">
          {tail.map(p => (
            <div key={p.id} className="shrink-0 grayscale opacity-40">
              <InactivePlayerCard player={p} />
            </div>
          ))}
          {tail.length === 0 && <div className="text-[8px] font-bold text-slate-800 uppercase italic self-center">Queue Empty</div>}
        </div>
      </div>
    </div>
  );
};

const Bench: React.FC = () => {
  const { players, actions } = use(GameContext)!;
  const benchPlayers = players
    .filter(p => p.lane === 5)
    .sort((a, b) => a.queue_order - b.queue_order);

  return (
    <section className="mt-8">
      <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2">Bench / Unassigned</h2>
      <div className="p-2 min-h-[100px] border border-slate-900 border-dashed bg-slate-950/30 rounded-lg">
        <div className="flex flex-wrap gap-2">
          {benchPlayers.map(p => (
            <div 
              key={p.id} 
              onClick={() => {
                const lane = prompt('Assign to lane (0:C, 1:LW, 2:RW, 3:LD, 4:RD)?');
                if (lane !== null) actions.moveLane(p.id, parseInt(lane));
              }}
            >
              <InactivePlayerCard player={p} />
            </div>
          ))}
          {benchPlayers.length === 0 && <span className="text-[10px] text-slate-700 font-bold uppercase p-2">Bench Empty</span>}
        </div>
      </div>
    </section>
  );
};

// --- Main App ---

export const App: React.FC = () => {
  useEffect(() => { startPolling(); }, []);

  // 1. Read Server State
  const serverPlayers = useStore(playersStore);
  const serverPaused = useStore(isPausedStore);
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

  // 3. Setup Transitions
  const [isPending, startTransition] = useTransition();

  // 4. Define Actions
  const gameActions = {
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

      startTransition(async () => {
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.moveLane(id, lane);
      });
    },
    toggleGlobalPause: () => {
      const next = !optimisticPaused;
      const now = Math.floor(Date.now() / 1000);
      const updates: Record<string, Partial<Player>> = {};

      optimisticPlayers.forEach(p => {
        const isOnIce = p.lane !== null && p.lane < 5 && p.queue_order === 0;
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

      startTransition(async () => {
        setOptimisticPaused(next);
        setOptimisticPlayers({ type: 'update_players', updates });
        await serverActions.toggleGlobalPause(next);
      });
    },
    resetGame: async () => {
      if (!confirm('Are you sure you want to reset all game time?')) return;
      startTransition(async () => {
        setOptimisticPlayers({ type: 'reset_game' });
        setOptimisticPaused(true);
        await serverActions.resetGame();
      });
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
    <GameContext.Provider value={{ players: optimisticPlayers, isPaused: optimisticPaused, actions: gameActions }}>
      <div className={`flex flex-col select-none ${isPending ? 'cursor-progress' : ''}`}>
        <GlobalControls />
        
        <div className="flex text-[9px] font-black uppercase text-slate-700 tracking-[0.2em] mb-3 px-3">
          <div className="w-28 mr-5">ON ICE</div>
          <div className="w-28 mr-4">NEXT</div>
          <div>QUEUE</div>
        </div>

        <div className="space-y-1">
          {[0, 1, 2, 3, 4].map(idx => (
            <LaneRow key={idx} laneIdx={idx} />
          ))}
        </div>

        <Bench />

        <Stats players={optimisticPlayers} isPaused={optimisticPaused} />

        <div className="mt-12 mb-8 flex justify-center">
          <button 
            onClick={gameActions.resetGame}
            className="flex items-center gap-2 px-6 py-2 rounded-lg border border-rose-900/20 text-rose-500/50 text-[10px] font-bold uppercase tracking-widest active:scale-95"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Everything
          </button>
        </div>
      </div>
    </GameContext.Provider>
  );
};