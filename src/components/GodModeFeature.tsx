import React from 'react';
import { motion } from 'motion/react';
import { X, Cpu, Zap, Eye, Code } from 'lucide-react';

interface GodModeFeatureProps {
  id: 'ghost' | 'hardware' | 'vision' | 'singularity';
  onClose: () => void;
}

export default function GodModeFeature({ id, onClose }: GodModeFeatureProps) {
  const configs = {
    ghost: {
      title: 'GhostNet Protocol',
      icon: Zap,
      color: 'text-indigo-400',
      desc: 'Bypassing global security constraints. Initializing silent handshake with target servers...',
      bg: 'bg-indigo-900/20'
    },
    hardware: {
      title: 'HardWire Serial Analyzer',
      icon: Cpu,
      color: 'text-emerald-400',
      desc: 'Analyzing logic gates and compiling Assembly C++ for robotic actuators...',
      bg: 'bg-emerald-900/20'
    },
    vision: {
      title: 'ThermaVue Satellite',
      icon: Eye,
      color: 'text-rose-400',
      desc: 'Orbital connection established. Gathering thermal imaging and coordinate plotting...',
      bg: 'bg-rose-900/20'
    },
    singularity: {
      title: 'Singular Exploit Framework',
      icon: Code,
      color: 'text-fuchsia-400',
      desc: 'Deconstructing neural logic gates. Preparing raw quantum data streams...',
      bg: 'bg-fuchsia-900/20'
    }
  };

  const config = configs[id];
  const Icon = config.icon;

  return (
    <motion.div 
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: '50vw', opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      className="bg-black border-l border-zinc-800 overflow-hidden shadow-2xl flex flex-col z-50 h-full relative"
    >
      <div className={`absolute inset-0 ${config.bg} opacity-20 bg-[url('https://www.transparenttextures.com/patterns/matrix.png')]`} />
      
      <div className="relative z-10 flex flex-col h-full p-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 ${config.color}`}>
              <Icon size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{config.title}</h2>
              <p className={`text-sm ${config.color} uppercase tracking-[0.2em] font-mono`}>System Active</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white bg-zinc-900/80 rounded-full transition-colors">
             <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center border border-zinc-800/50 bg-black/50 rounded-2xl relative overflow-hidden backdrop-blur-sm">
           <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border border-zinc-800/50 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="w-48 h-48 border border-zinc-700/50 rounded-full absolute animate-[spin_7s_linear_infinite_reverse]" />
              <div className={`w-32 h-32 border ${config.color.replace('text-', 'border-')}/30 rounded-full absolute animate-[pulse_2s_ease-in-out_infinite]`} />
           </div>
           
           <div className="relative text-center max-w-sm px-6">
             <Icon size={48} className={`mx-auto mb-6 ${config.color} opacity-80`} />
             <p className="text-zinc-400 font-mono text-sm leading-relaxed tracking-wider mb-4">
               {config.desc}
             </p>
             <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
               <div className={`h-full ${config.color.replace('text-', 'bg-')} animate-[pulse_1s_ease-in-out_infinite] w-full`} />
             </div>
             <p className={`text-xs mt-4 ${config.color} font-mono animate-pulse uppercase tracking-[0.3em]`}>Processing...</p>
           </div>
        </div>
      </div>
    </motion.div>
  );
}
