import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { isPaused, toggleGlobalPause, switchAll } from '../lib/store';
import { Play, Pause, RefreshCcw } from 'lucide-react';

export const GlobalControls: React.FC = () => {
  const paused = useStore(isPaused);
  const [isLocked, setIsLocked] = useState(false);
  const lastState = useRef(paused);

  useEffect(() => {
    if (lastState.current !== undefined && paused !== lastState.current) {
      setIsLocked(true);
      const timer = setTimeout(() => setIsLocked(false), 800);
      lastState.current = paused;
      return () => clearTimeout(timer);
    }
    lastState.current = paused;
  }, [paused]);

  const handleToggle = () => {
    if (isLocked) return;
    toggleGlobalPause(!paused);
  };

  const handleSwitchAll = async () => {
    if (isLocked) return;
    setIsLocked(true);
    await switchAll();
    setTimeout(() => setIsLocked(false), 800);
  };

  return (
    <div className="flex gap-3 mb-6">
      {/* Master Game Clock Control */}
      <button
        onClick={handleToggle}
        disabled={isLocked}
        className={`flex-1 py-6 rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] ${
          isLocked ? 'opacity-50 cursor-not-allowed grayscale' : ''
        } ${
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
        disabled={isLocked}
        className={`w-32 py-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] border border-slate-800 bg-slate-900 hover:bg-slate-800 ${
          isLocked ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <RefreshCcw className="w-6 h-6 text-blue-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Switch All</span>
      </button>
    </div>
  );
};