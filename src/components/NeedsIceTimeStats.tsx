import React, { use } from 'react';
import { useStore } from '@nanostores/react';
import { GameContext } from '../lib/client/context';
import type { Player } from '../lib/shared/types';

interface Props {
  players: Player[];
  isPaused: boolean;
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

export const NeedsIceTimeStats: React.FC<Props> = ({ players }) => {
  const { gameClockModel } = use(GameContext)!;
  const currentDisplayTime = useStore(gameClockModel.currentDisplayTime);

  const sortedPlayers = [...players]
    .map(p => {
      let currentTotal = p.total_time + (p.total_penalty_time || 0);
      if (typeof p.last_shift_started === 'number') {
        currentTotal += Math.max(0, currentDisplayTime - p.last_shift_started);
      }
      return { ...p, currentTotal };
    })
    // Filter out absent players (lane 7) who have no time
    .filter(p => !(p.lane === 7 && p.currentTotal === 0))
    // Sort ascending (lowest time first)
    .sort((a, b) => a.currentTotal - b.currentTotal)
    // Take top 5 lowest
    .slice(0, 5);

  return (
    <section className="mt-2 px-2">
      <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 border-b border-slate-900 pb-2">
        Needs Ice Time
      </h2>
      <div className="flex flex-col gap-2">
        {sortedPlayers.map(p => (
          <div key={p.id} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-slate-500 font-mono w-4 italic">#{p.number}</span>
              <span className="font-bold text-slate-300 truncate uppercase">{p.name}</span>
              {typeof p.last_shift_started === 'number' && (
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
