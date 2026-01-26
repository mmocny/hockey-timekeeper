import React, { useEffect, useOptimistic, useTransition, use } from 'react';
import { useStore } from '@nanostores/react';
import { playersStore, isPaused as isPausedStore, startPolling } from '../lib/client/store';
import * as serverActions from '../lib/client/actions';
import { PlayerCard } from './PlayerCard';
import { GlobalControls } from './GlobalControls';
import { GameContext } from '../lib/client/context';
import { LANE_NAMES, type Player } from '../lib/shared/types';
import { RotateCcw, ChevronRight } from 'lucide-react';

// --- Reducers for Optimistic State ---

type PlayerAction = 
  | { type: 'switch_lane'; lane: number }
  | { type: 'switch_all' }
  | { type: 'move_lane'; id: string; lane: number }
  | { type: 'reset_game' };

function playerReducer(state: Player[], action: PlayerAction): Player[] {
  const now = Math.floor(Date.now() / 1000);
  const nextState = [...state];

  switch (action.type) {
    case 'switch_lane': {
      const lanePlayers = nextState.filter(p => p.lane === action.lane).sort((a, b) => a.queue_order - b.queue_order);
      if (lanePlayers.length === 0) return state;
      
      // Move 0 to end
      const current = lanePlayers[0];
      const maxOrder = Math.max(...lanePlayers.map(p => p.queue_order));
      
      const updatedPlayers = lanePlayers.map((p, idx) => {
        if (p.id === current.id) {
          return { ...p, queue_order: maxOrder + 1, is_on_ice: false, last_shift_started: undefined };
        }
        // Shift up
        const newOrder = p.queue_order - 1;
        const isNowActive = newOrder === 0;
        return { 
          ...p, 
          queue_order: newOrder, 
          is_on_ice: isNowActive, 
          last_shift_started: isNowActive ? now : undefined 
        };
      });

      return nextState.map(p => updatedPlayers.find(up => up.id === p.id) || p);
    }
    case 'switch_all': {
      // Simplistic approach: Apply switch_lane logic to all lanes 0-4
      let tempState = nextState;
      for (let i = 0; i < 5; i++) {
        tempState = playerReducer(tempState, { type: 'switch_lane', lane: i });
      }
      return tempState;
    }
    case 'move_lane': {
      const { id, lane } = action;
      const targetLanePlayers = nextState.filter(p => p.lane === lane);
      const nextOrder = targetLanePlayers.length > 0 ? Math.max(...targetLanePlayers.map(p => p.queue_order)) + 1 : 0;
      return nextState.map(p => p.id === id ? { ...p, lane, queue_order: nextOrder, is_on_ice: false, last_shift_started: undefined } : p);
    }
    case 'reset_game': {
      return nextState.map(p => ({ ...p, total_time: 0, is_on_ice: false, last_shift_started: undefined }));
    }
    default:
      return state;
  }
}

// --- Components ---

const LaneRow: React.FC<{ laneIdx: number }> = ({ laneIdx }) => {
  // Read from Context using React 19 'use' API
  const { players, actions } = use(GameContext)!;

  const lanePlayers = players
    .filter(p => p.lane === laneIdx)
    .sort((a, b) => a.queue_order - b.queue_order);
  
  const onIce = lanePlayers[0];
  const onDeck = lanePlayers[1];
  const tail = lanePlayers.slice(2);

  return (
    <div className="py-2 border-b border-slate-900 last:border-0">
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">{LANE_NAMES[laneIdx]}</span>
        <div className="h-px bg-slate-900 flex-1"></div>
      </div>

      <div className="flex items-center gap-2 min-h-[44px] px-1">
        <div className="w-28 shrink-0" onClick={() => actions.switchLane(laneIdx)}>
          {onIce ? <PlayerCard player={{...onIce, is_on_ice: true}} /> : <div className="w-28 h-11 rounded border border-dashed border-slate-800 flex items-center justify-center text-[9px] text-slate-700 font-bold uppercase">Empty</div>}
        </div>
        <ChevronRight className="w-3 h-3 text-slate-800 shrink-0" />
        <div className="w-28 shrink-0" onClick={() => actions.switchLane(laneIdx)}>
          {onDeck ? <PlayerCard player={{...onDeck, is_on_ice: false}} /> : <div className="w-28 h-11 bg-slate-950/50 rounded border border-slate-900 border-dashed" />}
        </div>
        <div className="w-px h-8 bg-slate-900 shrink-0 mx-1"></div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 flex-1">
          {tail.map(p => (
            <div key={p.id} className="shrink-0 grayscale opacity-40">
              <PlayerCard player={{...p, is_on_ice: false}} />
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
              <PlayerCard player={p} />
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
      startTransition(async () => {
        setOptimisticPlayers({ type: 'switch_lane', lane });
        await serverActions.switchLane(lane);
      });
    },
    switchAll: () => {
      startTransition(async () => {
        setOptimisticPlayers({ type: 'switch_all' });
        await serverActions.switchAll();
      });
    },
    moveLane: (id: string, lane: number) => {
      startTransition(async () => {
        setOptimisticPlayers({ type: 'move_lane', id, lane });
        await serverActions.moveLane(id, lane);
      });
    },
    toggleGlobalPause: () => {
      startTransition(async () => {
        const next = !optimisticPaused;
        setOptimisticPaused(next);
        await serverActions.toggleGlobalPause(next);
      });
    },
    resetGame: () => {
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