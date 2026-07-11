import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Zap, Sparkles } from 'lucide-react';

interface Thought {
  id: string;
  step: string;
  isComplete: boolean;
}

export const ThoughtChainDisplay = ({ thoughts }: { thoughts: Thought[] }) => {
  return (
    <div className="flex flex-col gap-2 p-5 bg-zinc-950/80 backdrop-blur-2xl border border-white/5 rounded-[32px] w-full max-w-sm absolute right-4 bottom-24 z-[150] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <div className="flex items-center gap-2 text-indigo-400">
           <div className="p-1.5 bg-indigo-500/10 rounded-xl">
             <Brain className="w-5 h-5" />
           </div>
           <span className="font-bold text-xs uppercase tracking-[0.2em] text-zinc-300">Mhiee Bincike</span>
        </div>
        <div className="flex gap-1">
           <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
           <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
        </div>
      </div>
      
      <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {thoughts.map((thought, idx) => (
            <motion.div
              key={thought.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`text-[11px] p-3 rounded-2xl flex items-start gap-3 transition-all duration-500 border ${
                thought.isComplete 
                  ? 'text-indigo-200 bg-indigo-500/5 border-white/5' 
                  : 'text-zinc-500 bg-zinc-900/40 border-transparent italic'
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${thought.isComplete ? 'text-indigo-400' : 'text-zinc-700'}`}>
                {thought.isComplete ? <Sparkles className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 border-t-indigo-400 animate-spin" />}
              </div>
              <span className="leading-relaxed">{thought.step}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent rounded-full" />
    </div>
  );
};
