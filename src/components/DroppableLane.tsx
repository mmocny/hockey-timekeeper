import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface Props {
  laneId: number;
  children: React.ReactNode | ((args: { isOver: boolean }) => React.ReactNode);
  className?: string;
}

export const DroppableLane: React.FC<Props> = ({ laneId, children, className }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${laneId}`,
    data: { laneIdx: laneId },
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`${className || ''} relative group rounded-lg isolate`}
    >
      {/* Visual Overlay for Drop State */}
      <div 
        className={`absolute inset-0 rounded-lg pointer-events-none transition-all duration-200 border-2 ${
          isOver 
            ? 'border-blue-500/50 bg-slate-800/80 z-0' 
            : 'border-transparent bg-transparent -z-10'
        }`} 
      />
      
      {/* Content */}
      <div className="relative z-10">
        {typeof children === 'function' ? children({ isOver }) : children}
      </div>
    </div>
  );
};
