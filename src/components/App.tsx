import React, { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { playersStore, startPolling } from '../lib/client/store';
import { switchLane, moveLane, resetGame } from '../lib/client/actions';
import { CompactPlayer } from './CompactPlayer';
import { GlobalControls } from './GlobalControls';
import { RotateCcw, ChevronRight } from 'lucide-react';
import { LANE_NAMES } from '../lib/shared/types';

const LaneRow: React.FC<{ laneIdx: number; playerList: any[]; onNextShift: (idx: number) => void }> = ({ laneIdx, playerList, onNextShift }) => {
  const lanePlayers = playerList
    .filter(p => p.lane === laneIdx)
    .sort((a, b) => a.queue_order - b.queue_order);
  
  const onIce = lanePlayers[0]; // Index 0 is always active for active lanes
  const onDeck = lanePlayers[1];
  const tail = lanePlayers.slice(2);

  return (
    <div className="py-2 border-b border-slate-900 last:border-0">
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">{LANE_NAMES[laneIdx]}</span>
        <div className="h-px bg-slate-900 flex-1"></div>
      </div>

      <div className="flex items-center gap-2 min-h-[44px] px-1">
        {/* On Ice Slot */}
        <div className="w-28 shrink-0" onClick={() => onNextShift(laneIdx)}>
          {onIce ? <CompactPlayer player={{...onIce, is_on_ice: true}} /> : <div className="w-28 h-11 rounded border border-dashed border-slate-800 flex items-center justify-center text-[9px] text-slate-700 font-bold uppercase">Empty</div>}
        </div>

        <ChevronRight className="w-3 h-3 text-slate-800 shrink-0" />

        {/* On Deck Slot */}
        <div className="w-28 shrink-0" onClick={() => onNextShift(laneIdx)}>
          {onDeck ? <CompactPlayer player={{...onDeck, is_on_ice: false}} /> : <div className="w-28 h-11 bg-slate-950/50 rounded border border-slate-900 border-dashed" />}
        </div>

        <div className="w-px h-8 bg-slate-900 shrink-0 mx-1"></div>

        {/* Tail */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 flex-1">
          {tail.map(p => (
            <div key={p.id} className="shrink-0 grayscale opacity-40">
              <CompactPlayer player={{...p, is_on_ice: false}} />
            </div>
          ))}
          {tail.length === 0 && <div className="text-[8px] font-bold text-slate-800 uppercase italic self-center">Queue Empty</div>}
        </div>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  useEffect(() => {
    startPolling();
  }, []);

  const players = useStore(playersStore);
  const playerList = Object.values(players);

  if (playerList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium">Connecting...</p>
      </div>
    );
  }

  const benchPlayers = playerList
    .filter(p => p.lane === 5)
    .sort((a, b) => a.queue_order - b.queue_order);

  return (
    <div className="flex flex-col select-none">
      <GlobalControls />
      
      <div className="flex text-[9px] font-black uppercase text-slate-700 tracking-[0.2em] mb-3 px-3">
        <div className="w-28 mr-5">ON ICE</div>
        <div className="w-28 mr-4">NEXT</div>
        <div>QUEUE</div>
      </div>

      <div className="space-y-1">
        {[0, 1, 2, 3, 4].map(idx => (
          <LaneRow key={idx} laneIdx={idx} playerList={playerList} onNextShift={switchLane} />
        ))}
      </div>


      <section className="mt-8">
        <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-2">Bench / Unassigned</h2>
        <div className="p-2 min-h-[100px] border border-slate-900 border-dashed bg-slate-950/30 rounded-lg">
          <div className="flex flex-wrap gap-2">
            {benchPlayers.map(p => (
              <div 
                key={p.id} 
                onClick={() => {
                  const lane = prompt('Assign to lane (0:C, 1:LW, 2:RW, 3:LD, 4:RD)?');
                  if (lane !== null) moveLane(p.id, parseInt(lane));
                }}
              >
                <CompactPlayer player={p} />
              </div>
            ))}
            {benchPlayers.length === 0 && <span className="text-[10px] text-slate-700 font-bold uppercase p-2">Bench Empty</span>}
          </div>
        </div>
      </section>

      <div className="mt-12 mb-8 flex justify-center">
        <button onClick={resetGame} className="flex items-center gap-2 px-6 py-2 rounded-lg border border-rose-900/20 text-rose-500/50 text-[10px] font-bold uppercase tracking-widest active:scale-95">
          <RotateCcw className="w-3 h-3" />
          Reset Everything
        </button>
      </div>
    </div>
  );
};
