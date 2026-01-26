import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { isPaused, type Player } from '../lib/client/store';

interface Props {
  player: Player;
}

export const CompactPlayer: React.FC<Props> = ({ player }) => {
  const paused = useStore(isPaused);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (player.is_on_ice && !paused && player.last_shift_started) {
      const update = () => {
        setElapsed(Math.max(0, Math.floor(Date.now() / 1000) - player.last_shift_started!));
      };
      update();
      interval = setInterval(update, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [player.is_on_ice, paused, player.last_shift_started]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div
      className={`relative flex items-center justify-between p-2.5 min-h-[48px] rounded-md border transition-all touch-none select-none w-28 ${
        player.is_on_ice 
          ? 'bg-blue-600 border-blue-400 text-white shadow-md' 
          : 'bg-slate-900 border-slate-800 text-slate-300'
      }`}
    >
      <div className="flex flex-col overflow-hidden pointer-events-none pr-1">
        <span className="text-[10px] font-black italic leading-none opacity-60 mb-1 tracking-tighter">#{player.number}</span>
        <span className="text-[12px] font-bold truncate leading-none uppercase tracking-tight">{player.name}</span>
      </div>
      
      <div className="flex flex-col items-end shrink-0 ml-1 pointer-events-none border-l border-white/10 pl-2">
        {player.is_on_ice ? (
          <span className="text-[12px] font-mono font-black leading-none mb-1 text-white">
            {formatTime(elapsed)}
          </span>
        ) : (
          <div className="h-3 mb-1" /> // Spacer for non-active players
        )}
        <div className="flex items-center gap-0.5">
          <span className={`text-[8px] font-mono leading-none ${player.is_on_ice ? 'text-blue-300' : 'text-slate-500'}`}>
            Σ {formatTime(player.total_time + (player.is_on_ice && !paused ? elapsed : 0))}
          </span>
        </div>
      </div>
    </div>
  );
};
