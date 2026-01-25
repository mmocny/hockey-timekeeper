import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { isPaused, toggleGlobalPause } from '../lib/store';
import { Play, Pause } from 'lucide-react';

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

  return (
    <div className="flex flex-col gap-4 mb-8">
      {/* Master Game Clock Control */}
      <button
        onClick={handleToggle}
        disabled={isLocked}
        className={`w-full py-6 rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] ${
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
            <span className="text-2xl font-black uppercase tracking-widest">Resume Game</span>
          </>
        ) : (
          <>
            <Pause className="w-8 h-8 fill-current" />
            <span className="text-2xl font-black uppercase tracking-widest">Pause (Whistle)</span>
          </>
        )}
      </button>
    </div>
  );
};