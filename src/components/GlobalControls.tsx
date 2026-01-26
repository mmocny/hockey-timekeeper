import React from 'react';
import { useStore } from '@nanostores/react';
import { isPaused } from '../lib/client/store';
import { toggleGlobalPause, switchAll } from '../lib/client/actions';
import { Play, Pause, RefreshCcw } from 'lucide-react';

export const GlobalControls: React.FC = () => {
  const paused = useStore(isPaused);

  const handleToggle = () => {
    toggleGlobalPause(!paused);
  };

  const handleSwitchAll = async () => {
    await switchAll();
  };

  return (
    <div className="flex gap-3 mb-6">
      {/* Master Game Clock Control */}
      <button
        onClick={handleToggle}
        className={`flex-1 py-6 rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] ${
          paused
            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
            : 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/20'
        }`}
      >
        {paused ? (
          <>
            <Play className="w-8 h-8 fill-current" />
            <span className="text-xl font-black uppercase tracking-widest leading-none">Resume</span>
          </>
        ) : (
          <>
            <Pause className="w-8 h-8 fill-current" />
            <span className="text-xl font-black uppercase tracking-widest leading-none">Pause</span>
          </>
        )}
      </button>

      {/* Switch All Shifts */}
      <button
        onClick={handleSwitchAll}
        className="w-32 py-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] border border-slate-800 bg-slate-900 hover:bg-slate-800"
      >
        <RefreshCcw className="w-6 h-6 text-blue-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Switch All</span>
      </button>
    </div>
  );
};