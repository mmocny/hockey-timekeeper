import React from 'react';
import { swapPosition, type Position } from '../lib/store';
import { RefreshCw } from 'lucide-react';

interface Props {
  position: Position;
  label: string;
}

export const SwapButton: React.FC<Props> = ({ position, label }) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        swapPosition(position);
      }}
      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-xs font-bold text-blue-400 active:scale-95"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      <span>Swap {label}</span>
    </button>
  );
};
