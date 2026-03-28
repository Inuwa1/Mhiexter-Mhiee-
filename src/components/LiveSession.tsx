import React, { useState } from 'react';
import { MonitorPlay, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveSession } from '../hooks/useLiveSession';

export default function LiveSession({ onClose }: { onClose: () => void }) {
  const [showRules, setShowRules] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([{role: 'model', text: 'How can I help you today?'}]);
  
  const { isLive, facingMode, videoRef, canvasRef, startLiveSession, sessionRef } = useLiveSession();

  const sendMessage = () => {
    if (chatInput.trim() && sessionRef.current) {
      sessionRef.current.sendRealtimeInput({ text: chatInput });
      setMessages(prev => [...prev, { role: 'user', text: chatInput }]);
      setChatInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      {showRules ? (
        <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-700 max-w-md text-center">
          <ShieldCheck className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Screen Sharing Rules</h2>
          <p className="text-zinc-400 mb-6">By allowing camera access, you agree to let Mhiee see your video feed to help solve problems. Your data is processed securely.</p>
          <div className="flex gap-2">
            <button 
              onClick={() => { setShowRules(false); startLiveSession('user'); }}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500"
            >
              Start (Front)
            </button>
            <button 
              onClick={() => { setShowRules(false); startLiveSession('environment'); }}
              className="flex-1 bg-zinc-700 text-white py-3 rounded-xl font-bold hover:bg-zinc-600"
            >
              Start (Rear)
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
          <canvas ref={canvasRef} width="640" height="480" className="hidden" />
          {isLive && (
            <div className="absolute top-4 left-4 bg-indigo-600/80 text-white px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-sm">
              <MonitorPlay className="w-4 h-4" />
              <span>Live with Mhiee...</span>
            </div>
          )}
          
          {/* Chat Overlay */}
          <div className="absolute bottom-4 left-4 right-4 bg-zinc-900/80 backdrop-blur-md rounded-2xl p-4 border border-zinc-700">
            <div className="text-sm text-zinc-400 mb-2">Live Chat</div>
            <div className="h-24 overflow-y-auto text-zinc-200 text-sm mb-2 space-y-1">
              {messages.map((msg, idx) => (
                <p key={idx}><span className="font-bold">{msg.role === 'user' ? 'You' : 'Mhiee'}:</span> {msg.text}</p>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Type a message..." 
                className="flex-1 bg-zinc-800 rounded-lg p-2 text-white" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-500">
                Send
              </button>
            </div>
          </div>

          <button onClick={onClose} className="absolute top-4 right-4 bg-zinc-800 p-2 rounded-full text-white">
            <X />
          </button>
        </div>
      )}
    </div>
  );
}
