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
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Game Controls</h3>
            <p>Use the large buttons at the top to <strong>Start/Pause</strong> the game clock or <strong>Switch All Lines</strong> at once.</p>
          </section>

          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Managing Lines</h3>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Tap a Row:</strong> Shifts the "On Deck" player onto the ice and moves the current player to the back of the queue.</li>
              <li><strong>Drag & Drop:</strong> Drag any player card to move them between lines or reorder them within the bench.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Time Tracking</h3>
            <p>Player clocks run automatically when they are in the first "On Ice" slot while the game is active. The dashboard shows current shift time and total game time (Σ).</p>
          </section>

          <section>
            <h3 className="text-slate-200 font-bold mb-2 uppercase text-xs tracking-wider">Bench</h3>
            <p>Players not assigned to a specific line sit on the Bench. Drag them into a lane to assign them.</p>
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
