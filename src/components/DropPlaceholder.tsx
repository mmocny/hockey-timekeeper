import React from 'react';

export const DropPlaceholder: React.FC = () => (
  <div className="w-28 h-[48px] shrink-0 rounded-md border-2 border-dashed border-blue-500/50 bg-blue-500/10 flex items-center justify-center">
    <span className="text-[9px] font-bold text-blue-400 uppercase">Drop Here</span>
  </div>
);
