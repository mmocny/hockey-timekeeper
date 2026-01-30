import React, { useState, use } from 'react';
import { DndContext, type DragEndEvent, type DragStartEvent, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { GameContext } from '../lib/client/context';
import { ActivePlayerCard, InactivePlayerCard, EmptyPlayerCard } from './PlayerCard';
import { DraggablePlayer } from './DraggablePlayer';
import { DroppableLane } from './DroppableLane';
import { DropPlaceholder } from './DropPlaceholder';
import { GlobalControls } from './GlobalControls';
import { InstructionsModal } from './InstructionsModal';
import { Stats } from './Stats';
import { LANE_NAMES, type Player } from '../lib/shared/types';
import { RotateCcw, ChevronRight, Info } from 'lucide-react';

const LaneRow: React.FC<{ laneIdx: number }> = ({ laneIdx }) => {
  const { players, actions } = use(GameContext)!;

  const lanePlayers = players
    .filter(p => p.lane === laneIdx)
    .sort((a, b) => a.queue_order - b.queue_order);
  
  const onIce = lanePlayers[0];
  const onDeck = lanePlayers[1];
  const tail = lanePlayers.slice(2);

  return (
    <DroppableLane laneId={laneIdx} className={`py-1.5 border-b border-slate-900 last:border-0 ${laneIdx !== 5 ? 'cursor-pointer' : ''}`}>
      {({ isOver }) => {
        const showOnIcePlaceholder = isOver && lanePlayers.length === 0;
        const showOnDeckPlaceholder = isOver && lanePlayers.length === 1;
        const showQueuePlaceholder = isOver && lanePlayers.length >= 2;

        return (
          <div 
            onClick={() => laneIdx !== 5 && actions.switchLane(laneIdx)}
          >
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{LANE_NAMES[laneIdx]}</span>
              <div className="h-px bg-slate-900 flex-1"></div>
            </div>

            <div className="flex items-center gap-2 min-h-[44px] px-1">
              <div className="w-36 shrink-0">
                {onIce ? (
                  <DraggablePlayer id={onIce.id}>
                    <ActivePlayerCard key={onIce.id} player={onIce} />
                  </DraggablePlayer>
                ) : showOnIcePlaceholder ? (
                  <DropPlaceholder />
                ) : (
                  <div><EmptyPlayerCard type="active" /></div>
                )}
              </div>

              <ChevronRight className="w-3 h-3 text-slate-800 shrink-0" />

              <div className="flex gap-1.5 flex-1 items-center">
                {/* On Deck Slot */}
                <div className="shrink-0">
                  {onDeck ? (
                    <DraggablePlayer id={onDeck.id}>
                      <InactivePlayerCard key={onDeck.id} player={onDeck} />
                    </DraggablePlayer>
                  ) : showOnDeckPlaceholder ? (
                    <DropPlaceholder />
                  ) : (
                    <div><EmptyPlayerCard /></div>
                  )}
                </div>

                {/* Queue Tail */}
                {tail.map(p => (
                  <DraggablePlayer key={p.id} id={p.id}>
                    <div className="shrink-0 grayscale opacity-40">
                      <InactivePlayerCard player={p} />
                    </div>
                  </DraggablePlayer>
                ))}
                
                {/* Append Placeholder if Queue active */}
                {showQueuePlaceholder && <DropPlaceholder />}
                
                {/* Empty State Text (only if On Deck player exists but tail is empty) */}
                {!isOver && onDeck && tail.length === 0 && <div className="text-[8px] font-bold text-slate-800 uppercase italic self-center ml-2">Queue Empty</div>}
              </div>
            </div>
          </div>
        );
      }}
    </DroppableLane>
  );
};

const Bench: React.FC = () => {
  const { players, actions } = use(GameContext)!;
  const benchPlayers = players
    .filter(p => p.lane === 6 || p.lane === 7)
    .sort((a, b) => a.queue_order - b.queue_order);

  return (
    <section className="mt-2">
      <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-2">Bench / Absent</h2>
      <DroppableLane laneId={6} className="p-2 min-h-[100px] border border-slate-900 border-dashed bg-slate-950/30 rounded-lg">
        {({ isOver }) => (
          <div className="flex flex-wrap gap-2">
            {benchPlayers.map(p => (
              <DraggablePlayer key={p.id} id={p.id}>
                <div 
                  onClick={() => {
                    const lane = prompt('Assign to lane (0:C, 1:LW, 2:RW, 3:LD, 4:RD, 5:G, 6:Bench)?');
                    if (lane !== null) actions.moveLane(p.id, parseInt(lane));
                  }}
                >
                  <InactivePlayerCard player={p} />
                </div>
              </DraggablePlayer>            ))}
            {isOver && <DropPlaceholder />}
            {!isOver && benchPlayers.length === 0 && <span className="text-[10px] font-bold text-slate-700 font-bold uppercase p-2">Bench Empty</span>}
          </div>
        )}
      </DroppableLane>
    </section>
  );
};

export const GameLayout: React.FC<{ isPending: boolean, isLoading: boolean }> = ({ isPending, isLoading }) => {
  const { players, actions } = use(GameContext)!;
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [isInstructionsOpen, setInstructionsOpen] = useState(false);

  // Configure sensors for better mobile scrolling
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });
  
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  const handleDragStart = (event: DragStartEvent) => {
    const player = players.find(p => p.id === event.active.id);
    if (player) setActivePlayer(player);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);
    
    if (over && active.id !== over.id) {
      const playerId = active.id as string;
      const laneData = over.data.current as { laneIdx: number } | undefined;
      
      if (laneData !== undefined) {
        actions.moveLane(playerId, laneData.laneIdx);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium">Connecting...</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`flex flex-col select-none ${isPending ? 'cursor-progress' : ''}`}>
        <GlobalControls />
        
        <div className="overflow-x-auto pb-2 mb-2">
          <div className="space-y-1 min-w-full w-max">
            {[0, 1, 2, 3, 4, 5].map(idx => (
              <LaneRow key={idx} laneIdx={idx} />
            ))}
          </div>
        </div>

        <Bench />

        <Stats players={players} isPaused={false} />

        <div className="mt-8 mb-8 flex justify-center gap-4">
          <button 
            onClick={actions.resetGame}
            className="flex items-center gap-2 px-6 py-2 rounded-lg border border-rose-900/20 text-rose-500/50 text-[10px] font-bold uppercase tracking-widest active:scale-95 hover:bg-rose-950/10 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>

          <button 
            onClick={() => setInstructionsOpen(true)}
            className="flex items-center gap-2 px-6 py-2 rounded-lg border border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-widest active:scale-95 hover:bg-slate-800 transition-colors"
          >
            <Info className="w-3 h-3" />
            Help
          </button>
        </div>
      </div>
      <DragOverlay>
        {activePlayer ? (
          <div className="opacity-90 rotate-3 cursor-grabbing shadow-2xl">
            {(activePlayer.lane < 6 && activePlayer.queue_order === 0) ? (
              <ActivePlayerCard player={activePlayer} />
            ) : (
              <InactivePlayerCard player={activePlayer} />
            )}
          </div>
        ) : null}
      </DragOverlay>
      <InstructionsModal isOpen={isInstructionsOpen} onClose={() => setInstructionsOpen(false)} />
    </DndContext>
  );
};
