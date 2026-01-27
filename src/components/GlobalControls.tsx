import React, { use, useState, useEffect } from 'react';
import { GameContext } from '../lib/client/context';
import { RefreshCcw, Clock, Plus, Minus } from 'lucide-react';

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

export const GlobalControls: React.FC = () => {
  const { isPaused, gameTime, updatedAt, clockSkew, actions } = use(GameContext)!;
  const [now, setNow] = useState(Date.now() / 1000);

  useEffect(() => {
    // Update more frequently for smooth second ticks if needed, but 1s is fine for display
    const interval = setInterval(() => {
      setNow(Date.now() / 1000);
    }, 200); // 200ms to avoid skipping seconds visually due to drift
    return () => clearInterval(interval);
  }, []);

  // If paused, time is static gameTime.
  // If active, time is gameTime + (adjustedNow - last_start_time).
  // adjustedNow = ClientNow - Skew.
  // updated_at is Server Time.
  const adjustedNow = now - clockSkew;
  const totalTime = isPaused ? gameTime : gameTime + Math.max(0, adjustedNow - updatedAt);

  return (
    <div className="flex gap-3 mb-4">
      {/* Game Clock Group */}
      <div className="flex-1 flex gap-1">
        <button
          onClick={() => actions.syncClock('down')}
          className="px-2 rounded-l-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center active:scale-95 transition-all"
        >
          <Minus className="w-4 h-4 text-slate-400" />
        </button>
        
        <button
          onClick={() => actions.toggleGlobalPause()}
          className={`flex-1 py-6 flex items-center justify-center gap-4 transition-all active:scale-[0.98] ${
            !isPaused
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
              : 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/20'
          }`}
        >
          <Clock className={`w-8 h-8 fill-current ${!isPaused ? 'animate-pulse' : ''}`} />
          <span className="text-3xl font-mono font-black tracking-widest leading-none">
            {formatTime(Math.round(totalTime))}
          </span>
        </button>

        <button
          onClick={() => actions.syncClock('up')}
          className="px-2 rounded-r-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Switch All Shifts */}
      <button
        onClick={() => actions.switchAll()}
        className="w-32 py-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] border border-slate-800 bg-slate-900 hover:bg-slate-800"
      >
        <RefreshCcw className="w-6 h-6 text-blue-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Switch All</span>
      </button>
    </div>
  );
};