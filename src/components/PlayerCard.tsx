import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { playersStore, togglePlayer, isPaused, type Player } from '../lib/store';
import { Clock, User } from 'lucide-react';

interface Props {
  playerId: string;
}

export const PlayerCard: React.FC<Props> = ({ playerId }) => {
  const players = useStore(playersStore);
  const paused = useStore(isPaused);
  const player = players[playerId];
  
  const [currentShiftSeconds, setCurrentShiftSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (player.isOnIce && !paused && player.lastShiftStarted) {
      interval = setInterval(() => {
        const seconds = Math.floor((Date.now() - (player.lastShiftStarted || 0)) / 1000);
        setCurrentShiftSeconds(seconds);
      }, 1000);
    } else {
      setCurrentShiftSeconds(0);
    }
    return () => clearInterval(interval);
  }, [player.isOnIce, paused, player.lastShiftStarted]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalTimeDisplay = player.isOnIce && !paused 
    ? player.totalTime + currentShiftSeconds 
    : player.totalTime;

  return (
    <button
      onClick={() => togglePlayer(playerId)}
      className={`relative w-full p-4 rounded-xl border-2 transition-all duration-200 text-left active:scale-95 ${
        player.isOnIce
          ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-900/20'
          : 'bg-slate-900 border-slate-700 opacity-90'
      }`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className={`text-2xl font-black italic tracking-tighter ${
          player.isOnIce ? 'text-blue-100' : 'text-slate-600'
        }`}>
          {player.number}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
          player.isOnIce ? 'bg-blue-400 text-blue-950 border-blue-300' : 'bg-slate-800 text-slate-400 border-slate-700'
        }`}>
          {player.position}
        </span>
      </div>
      
      <h3 className={`text-base font-bold truncate leading-tight ${
        player.isOnIce ? 'text-white' : 'text-slate-200'
      }`}>
        {player.name}
      </h3>

      <div className="mt-4 flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Shift</span>
          <span className={`text-xl font-mono leading-none ${
            player.isOnIce ? 'text-white' : 'text-slate-400'
          }`}>
            {formatTime(currentShiftSeconds)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Total</span>
          <span className={`text-sm font-mono leading-none ${
            player.isOnIce ? 'text-blue-200' : 'text-slate-400'
          }`}>
            {formatTime(totalTimeDisplay)}
          </span>
        </div>
      </div>

      {player.isOnIce && !paused && (
        <div className="absolute top-2 right-2 flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
        </div>
      )}
    </button>
  );
};
