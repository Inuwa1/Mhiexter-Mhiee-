import React, { useState } from 'react';
import { MonitorPlay, X, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function LiveSession({ onClose }: { onClose: () => void }) {
  const [showRules, setShowRules] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      {showRules ? (
        <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-700 max-w-md text-center">
          <ShieldCheck className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Live Session Rules</h2>
          <p className="text-zinc-400 mb-6">By allowing camera access, you agree to let Mhiee see your video feed to help solve problems. Your data is processed securely.</p>
          <button 
            onClick={() => setShowRules(false)}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500"
          >
            I Understand, Start
          </button>
        </div>
      ) : (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <div className="text-white text-xl">Live Session Active (Web Placeholder)</div>
          <button onClick={onClose} className="absolute top-4 right-4 bg-zinc-800 p-2 rounded-full text-white">
            <X />
          </button>
        </div>
      )}
    </div>
  );
}
