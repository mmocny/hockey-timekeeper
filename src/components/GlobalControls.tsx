import React, { use } from 'react';
import { GameContext } from '../lib/client/context';
import { Play, Pause, RefreshCcw } from 'lucide-react';

export const GlobalControls: React.FC = () => {
  const { isPaused, actions } = use(GameContext)!;

  return (
    <div className="flex gap-3 mb-6">
      {/* Master Game Clock Control */}
      <button
        onClick={() => actions.toggleGlobalPause()}
        className={`flex-1 py-6 rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] ${
          !isPaused
            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
            : 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/20'
        }`}
      >
        {!isPaused ? (
          <>
            <Pause className="w-8 h-8 fill-current" />
            <span className="text-xl font-black uppercase tracking-widest leading-none">Pause</span>
          </>
        ) : (
          <>
            <Play className="w-8 h-8 fill-current" />
            <span className="text-xl font-black uppercase tracking-widest leading-none">Resume</span>
          </>
        )}
      </button>

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
