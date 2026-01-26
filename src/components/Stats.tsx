import React, { useState, useEffect } from 'react';
import type { Player } from '../lib/shared/types';

interface Props {
  players: Player[];
  isPaused: boolean;
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

export const Stats: React.FC<Props> = ({ players, isPaused }) => {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const sortedPlayers = [...players].map(p => {
    let currentTotal = p.total_time;
    if (p.last_shift_started && !isPaused) {
      currentTotal += Math.max(0, now - p.last_shift_started);
    }
    return { ...p, currentTotal };
  }).sort((a, b) => b.currentTotal - a.currentTotal);

  return (
    <section className="mt-12 px-2">
      <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4 border-b border-slate-900 pb-2">
        Ice Time Leaderboard
      </h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        {sortedPlayers.map(p => (
          <div key={p.id} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-slate-500 font-mono w-4 italic">#{p.number}</span>
              <span className="font-bold text-slate-300 truncate uppercase">{p.name}</span>
              {p.last_shift_started && !isPaused && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="On Ice" />
              )}
            </div>
            <span className="font-mono text-slate-400 tabular-nums">
              {formatTime(p.currentTotal)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
