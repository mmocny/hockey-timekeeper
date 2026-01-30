import React from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InstructionsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">How to Use</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-slate-400 text-sm leading-relaxed overflow-y-auto max-h-[70vh]">
          
          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Game Clock</h3>
            <p>Tap the large clock to <strong>Start/Pause</strong>. Use the <strong>+ / -</strong> buttons to adjust seconds manually. The clock state is synchronized across all devices.</p>
          </section>

          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Line Changes</h3>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Switch Lane:</strong> Tap any lane row (e.g., "CENTER") to rotate the "On Deck" player onto the ice.</li>
              <li><strong>Switch All:</strong> Tap the big refresh button at the top to rotate all skating lines simultaneously.</li>
              <li><span className="text-red-400 font-bold">Note:</span> Lines with a player serving a penalty are locked and will not rotate.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Drag & Drop</h3>
            <p>You can drag any player card to move them between lines, to the bench, or to reorder the queue. The entire list scrolls horizontally to accommodate long lines.</p>
          </section>

          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Penalties</h3>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Start Penalty:</strong> Drag an "On Ice" player to the red <strong>"Drag Here for Penalty"</strong> box (next to the Goalie).</li>
              <li>The player card will turn <strong className="text-red-400">RED</strong> and start accumulating Penalty Minutes (PIM).</li>
              <li><strong>End Penalty:</strong> Tap the red player card to return them to normal play.</li>
              <li><strong>Move:</strong> Dragging a penalty player to another lane (like the Bench) will clear the penalty.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Goalie</h3>
            <p>To swap goalies, simply drag a new player onto the <strong>Goalie</strong> slot. The existing goalie will automatically move to the Bench.</p>
          </section>

          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Bench & Absent</h3>
            <p>Players not currently in a lineup sit in the <strong>Bench / Absent</strong> area at the bottom. They do not accumulate time.</p>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 text-center">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};