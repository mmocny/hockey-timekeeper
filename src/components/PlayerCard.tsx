import React, { use } from 'react';
import { useStore } from '@nanostores/react';
import { GameContext } from '../lib/client/context';
import type { Player } from '../lib/shared/types';

interface Props {
  player: Player;
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

export const ActivePlayerCard: React.FC<Props> = ({ player }) => {
  const { gameClockModel } = use(GameContext)!;
  const currentDisplayTime = useStore(gameClockModel.currentDisplayTime);

  const elapsed = player.last_shift_started !== undefined 
    ? Math.max(0, currentDisplayTime - player.last_shift_started)
    : 0;

  const totalDisplay = formatTime(player.total_time + elapsed);

  return (
    <div className="relative flex items-center justify-between p-2.5 min-h-[48px] rounded-md border transition-all touch-none select-none w-36 bg-blue-600 border-blue-400 text-white shadow-md">
      <div className="flex flex-col overflow-hidden pointer-events-none pr-1">
          <span className="text-[10px] font-black italic leading-none opacity-60 mb-1 tracking-tighter">#{player.number}</span>
          <span className="text-[12px] font-bold truncate leading-none uppercase tracking-tight">{player.name}</span>
        </div>
        
        <div className="flex flex-col items-end shrink-0 ml-1 pointer-events-none border-l border-white/10 pl-2">
          <span className="text-[12px] font-mono font-black leading-none mb-1 text-white">
            {formatTime(elapsed)}
          </span>
          <div className="flex items-center gap-0.5">
            <span className="text-[8px] font-mono leading-none text-blue-300">
              Σ {totalDisplay}
            </span>
          </div>
        </div>
      </div>
  );
};

export const InactivePlayerCard: React.FC<Props> = ({ player }) => (
  <div className="relative flex items-center justify-between p-2.5 min-h-[48px] rounded-md border transition-all touch-none select-none w-36 bg-slate-900 border-slate-800 text-slate-300">
    <div className="flex flex-col overflow-hidden pointer-events-none pr-1">
      <span className="text-[10px] font-black italic leading-none opacity-60 mb-1 tracking-tighter">#{player.number}</span>
      <span className="text-[12px] font-bold truncate leading-none uppercase tracking-tight">{player.name}</span>
    </div>
    
    <div className="flex flex-col items-end shrink-0 ml-1 pointer-events-none border-l border-white/10 pl-2">
      <div className="h-3 mb-1" />
      <div className="flex items-center gap-0.5">
        <span className="text-[8px] font-mono leading-none text-slate-500">
          Σ {formatTime(player.total_time)}
        </span>
      </div>
    </div>
  </div>
);

export const EmptyPlayerCard: React.FC<{ type?: 'active' | 'inactive' }> = ({ type = 'inactive' }) => (
  <div className={`w-36 h-[48px] rounded-md border border-dashed flex items-center justify-center text-[9px] font-bold uppercase select-none ${
    type === 'active' 
      ? 'border-slate-800 text-slate-700 bg-slate-950/50' 
      : 'border-slate-900 text-slate-800 bg-transparent'
  }`}>
    Empty
  </div>
);