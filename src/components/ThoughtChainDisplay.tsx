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
    <div className="flex flex-col gap-2 p-4 bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-2xl w-full max-w-sm absolute right-4 bottom-24 z-[150]">
      <div className="flex items-center gap-2 text-indigo-400">
        <Brain className="w-5 h-5" />
        <span className="font-semibold text-sm tracking-wide">Mhiee Internal Reasoning</span>
      </div>
      <div className="flex flex-col gap-1 mt-2">
        <AnimatePresence>
          {thoughts.map((thought, idx) => (
            <motion.div
              key={thought.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`text-xs p-2 rounded-lg flex items-center gap-2 ${thought.isComplete ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 bg-zinc-800/20'}`}
            >
              {thought.isComplete ? <Sparkles className="w-3 h-3" /> : <Zap className="w-3 h-3 animate-pulse" />}
              {thought.step}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
