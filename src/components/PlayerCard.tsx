import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { playersStore, togglePlayer, isPaused, cyclePosition } from '../lib/store';

interface Props {
  playerId: string;
}

export const PlayerCard: React.FC<Props> = ({ playerId }) => {
  const players = useStore(playersStore);
  const paused = useStore(isPaused);
  const player = players[playerId];
  
  const [currentShiftSeconds, setCurrentShiftSeconds] = useState(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const lastState = useRef(player?.is_on_ice);

  // Lockout logic: if state changed from outside, disable tap for 800ms
  useEffect(() => {
    if (player && lastState.current !== undefined && player.is_on_ice !== lastState.current) {
      setIsLocked(true);
      const timer = setTimeout(() => setIsLocked(false), 800);
      lastState.current = player.is_on_ice;
      return () => clearTimeout(timer);
    }
    lastState.current = player?.is_on_ice;
  }, [player?.is_on_ice]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (player?.is_on_ice && !paused && player.last_shift_started) {
      const update = () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const seconds = Math.max(0, nowSeconds - (player.last_shift_started || 0));
        setCurrentShiftSeconds(seconds);
      };
      update();
      interval = setInterval(update, 1000);
    } else {
      setCurrentShiftSeconds(0);
    }
    return () => clearInterval(interval);
  }, [player?.is_on_ice, paused, player?.last_shift_started]);

  if (!player) return <div className="w-full h-24 bg-slate-900 animate-pulse rounded-xl" />;

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTap = () => {
    if (isLocked) return;
    // Send explicit intent: if they are currently ON, move to OFF (target false)
    togglePlayer(playerId, !player.is_on_ice);
  };

  const handleStartPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (isLocked) return;
    setIsPressing(true);
    longPressTimer.current = setTimeout(() => {
      cyclePosition(playerId);
      setIsPressing(false);
      longPressTimer.current = null;
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 1000);
  };

  const handleEndPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      // If we released BEFORE the timer finished, it's a normal tap
      handleTap();
    }
    setIsPressing(false);
  };

  const totalTimeDisplay = player.is_on_ice && !paused 
    ? player.total_time + currentShiftSeconds 
    : player.total_time;

  return (
    <div
      onMouseDown={handleStartPress}
      onMouseUp={handleEndPress}
      onMouseLeave={handleEndPress}
      onTouchStart={handleStartPress}
      onTouchEnd={handleEndPress}
      onTouchMove={(e) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
          setIsPressing(false);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full p-4 rounded-xl border-2 transition-all duration-200 text-left cursor-pointer select-none active:scale-95 ${
        isLocked ? 'ring-2 ring-amber-500/50 opacity-80' : ''
      } ${
        player.is_on_ice
          ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-900/20'
          : 'bg-slate-900 border-slate-700 opacity-90'
      }`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className={`text-2xl font-black italic tracking-tighter ${
          player.is_on_ice ? 'text-blue-100' : 'text-slate-600'
        }`}>
          {player.number}
        </span>
        <div 
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${
            isPressing ? 'scale-150 bg-blue-500 text-white shadow-lg' : ''
          } ${
            player.is_on_ice ? 'bg-blue-400 text-blue-950 border-blue-300' : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {player.position}
        </div>
      </div>
      
      <h3 className={`text-base font-bold truncate leading-tight ${
        player.is_on_ice ? 'text-white' : 'text-slate-200'
      }`}>
        {player.name}
      </h3>

      <div className="mt-4 flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Shift</span>
          <span className={`text-xl font-mono leading-none ${
            player.is_on_ice ? 'text-white' : 'text-slate-400'
          }`}>
            {formatTime(currentShiftSeconds)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Total</span>
          <span className={`text-sm font-mono leading-none ${
            player.is_on_ice ? 'text-blue-200' : 'text-slate-400'
          }`}>
            {formatTime(totalTimeDisplay)}
          </span>
        </div>
      </div>
    </div>
  );
};