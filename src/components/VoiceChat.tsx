import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Mic, MicOff, X, Sparkles, Volume2, Globe, Settings2, Waves } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, ThinkingLevel } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

const GeminiOrb = ({ isActive, isThinking }: { isActive: boolean, isThinking: boolean }) => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer Glows */}
      <motion.div 
        animate={{ 
          scale: isActive ? [1, 1.2, 1] : 1,
          opacity: isActive ? [0.3, 0.6, 0.3] : 0.2,
          rotate: [0, 180, 360]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-3xl"
      />
      
      <motion.div 
        animate={{ 
          scale: isActive ? [1.1, 0.9, 1.1] : 1,
          opacity: isActive ? [0.2, 0.4, 0.2] : 0.1,
          rotate: [360, 180, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 bg-gradient-to-bl from-blue-400 via-teal-400 to-indigo-600 rounded-full blur-2xl"
      />

      {/* The Core Orb */}
      <motion.div 
        animate={{ 
          scale: isActive ? [1, 1.05, 1] : 1,
          boxShadow: isActive 
            ? ["0 0-20px rgba(99,102,241,0.4)", "0 0-40px rgba(168,85,247,0.6)", "0 0-20px rgba(99,102,241,0.4)"]
            : "0 0 0px rgba(0,0,0,0)"
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-48 h-48 bg-zinc-900 rounded-full border border-white/10 flex items-center justify-center overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1)_0%,transparent_60%)]" />
        
        {/* Pulsing Interior */}
        <AnimatePresence>
          {isActive && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-transparent rounded-full animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>

        {isThinking ? (
           <div className="flex gap-1 items-center">
             {[0, 1, 2].map((i) => (
               <motion.div
                 key={i}
                 animate={{ scaleY: [1, 2, 1] }}
                 transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                 className="w-1 h-4 bg-indigo-400 rounded-full"
               />
             ))}
           </div>
        ) : (
          <Sparkles className={`w-12 h-12 ${isActive ? 'text-indigo-400' : 'text-zinc-700'} transition-colors duration-500`} />
        )}
      </motion.div>

      {/* Decorative Rings */}
      <div className="absolute inset-x-[-20%] inset-y-[-20%] border border-white/5 rounded-full pointer-events-none" />
      <div className="absolute inset-x-[-10%] inset-y-[-10%] border border-white/5 rounded-full pointer-events-none animate-[pulse_4s_infinite]" />
    </div>
  );
};

export default function VoiceChat({ 
  onToggle, 
  onStartCamera, 
  onStopCamera, 
  onClearChat,
  onClose
}: { 
  onToggle: (active: boolean) => void,
  onStartCamera: () => void,
  onStopCamera: () => void,
  onClearChat: () => void,
  onClose?: () => void
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSingingModeRef = useRef(false);
  const [voice, setVoice] = useState('Kore');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const gainNodeRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const singingModeTool: FunctionDeclaration = {
    name: "setSingingMode",
    description: "Set the singing mode for sleep and relaxation. When active, the AI will sing calming songs and should not be interrupted.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        active: { type: Type.BOOLEAN, description: "Whether singing mode is active." },
        durationMinutes: { type: Type.NUMBER, description: "Duration in minutes for singing mode." }
      },
      required: ["active"]
    }
  };

  const getCurrentTimeTool: FunctionDeclaration = {
    name: "getCurrentTime",
    description: "Get the current date and time.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  };

  const startCameraTool: FunctionDeclaration = {
    name: "startCamera",
    description: "Start the camera.",
    parameters: { type: Type.OBJECT, properties: {} }
  };
  const stopCameraTool: FunctionDeclaration = {
    name: "stopCamera",
    description: "Stop the camera.",
    parameters: { type: Type.OBJECT, properties: {} }
  };
  const clearChatTool: FunctionDeclaration = {
    name: "clearChat",
    description: "Clear the chat history.",
    parameters: { type: Type.OBJECT, properties: {} }
  };

  const startVoiceChat = async () => {
    setError(null);
    try {
      const apiKey = (window as any).GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Mhiexter Boss,, your GEMINI_API_KEY is missing! 🥺");
      }

      if (!window.isSecureContext) {
        throw new Error("SECURE_CONTEXT_REQUIRED");
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser is blocking microphone access.");
      }

      // Diagnostic check only
      try {
        if ((navigator as any).permissions && (navigator as any).permissions.query) {
          const status = await (navigator as any).permissions.query({ name: 'microphone' });
          console.log("Mic Permission Status:", status.state);
        }
      } catch (e) {}

      const ai = new GoogleGenAI({ apiKey });
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.value = 1.5; 
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }

      try {
        await new Promise(r => setTimeout(r, 1000));
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
        }
        
        console.log("Requesting microphone permission...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        mediaStreamRef.current = stream;
        console.log("Microphone access granted.");
      } catch (err: any) {
        console.error("Detailed mic error:", err);
        const lowerMsg = err.message?.toLowerCase() || "";
        const isIframe = window.self !== window.top;

        if (
          err.name === 'NotAllowedError' || 
          err.name === 'PermissionDeniedError' || 
          err.name === 'SecurityError' ||
          lowerMsg.includes("denied") ||
          lowerMsg.includes("permission")
        ) {
          if (isIframe) throw new Error("IFRAME_BLOCKED");
          throw new Error("DENIED"); 
        }
        throw new Error(`Microphone error: ${err.message}`);
      }
      
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current!);
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      nextStartTimeRef.current = audioContextRef.current.currentTime;

      const modelToUse = "gemini-1.5-flash";
      const session = await ai.live.connect({
        model: modelToUse,
        callbacks: {
          onopen: () => {
            setIsRecording(true);
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
            onToggle(true);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              session.sendRealtimeInput({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            try {
              if (message.toolCall) {
                for (const call of message.toolCall.functionCalls) {
                  if (call.name === 'setSingingMode') {
                    const { active, durationMinutes } = call.args as { active: boolean, durationMinutes?: number };
                    isSingingModeRef.current = active;
                    session.sendToolResponse({
                      functionResponses: [{
                        name: 'setSingingMode',
                        id: call.id,
                        response: { result: { success: true } }
                      }]
                    });
                  } else if (call.name === 'getCurrentTime') {
                     session.sendToolResponse({
                      functionResponses: [{
                        name: 'getCurrentTime',
                        id: call.id,
                        response: { result: { time: new Date().toLocaleString() } }
                      }]
                    });
                  } else if (call.name === 'startCamera') { 
                    onStartCamera(); 
                    session.sendToolResponse({ functionResponses: [{ name: 'startCamera', id: call.id, response: { result: { success: true } } }] }); 
                  } else if (call.name === 'stopCamera') { 
                    onStopCamera(); 
                    session.sendToolResponse({ functionResponses: [{ name: 'stopCamera', id: call.id, response: { result: { success: true } } }] }); 
                  } else if (call.name === 'clearChat') { 
                    onClearChat(); 
                    session.sendToolResponse({ functionResponses: [{ name: 'clearChat', id: call.id, response: { result: { success: true } } }] }); 
                  }
                }
                return;
              }

              if (message.serverContent?.interrupted && !isSingingModeRef.current) {
                activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
                activeSourcesRef.current.clear();
                nextStartTimeRef.current = audioContextRef.current!.currentTime;
                setIsThinking(false);
                return;
              }

              if (message.serverContent?.modelTurn?.parts[0]?.inlineData) {
                setIsThinking(true);
                const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
                try {
                  const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
                  // Ensure the buffer is aligned for Int16Array (must be multiple of 2)
                  const alignedLength = Math.floor(audioData.length / 2) * 2;
                  const pcmData = new Int16Array(audioData.buffer, audioData.byteOffset, alignedLength / 2);
                  const audioBuffer = audioContextRef.current!.createBuffer(1, pcmData.length, 16000);
                  const channelData = audioBuffer.getChannelData(0);
                  for (let i = 0; i < pcmData.length; i++) { channelData[i] = pcmData[i] / 32768; }

                  const sourceNode = audioContextRef.current!.createBufferSource();
                  sourceNode.buffer = audioBuffer;
                  sourceNode.connect(gainNodeRef.current!);
                  activeSourcesRef.current.add(sourceNode);
                  sourceNode.onended = () => { 
                    activeSourcesRef.current.delete(sourceNode);
                    if (activeSourcesRef.current.size === 0) setIsThinking(false);
                  };

                  const startTime = Math.max(nextStartTimeRef.current, audioContextRef.current!.currentTime);
                  sourceNode.start(startTime);
                  nextStartTimeRef.current = startTime + audioBuffer.duration;
                } catch (e) {
                  console.error('Audio play error:', e);
                  setIsThinking(false);
                }
              }
            } catch (err) {
              console.error("Error processing VoiceChat message:", err);
            }
          },
          onerror: (err: any) => { 
            console.error(err); 
            setIsThinking(false); 
            const status = err?.status || err?.error?.code || err?.error?.status;
            const messageStr = err?.message || err?.error?.message || "";
            if (status === 429 || status === 'RESOURCE_EXHAUSTED' || messageStr.includes('RESOURCE_EXHAUSTED')) {
              setError("Quota exceeded! 🙈 Please try again tomorrow or use your own Gemini API key in Settings! ✨");
            } else if (status === 404 || messageStr.toLowerCase().includes('not found')) {
              setError("Live model wasn't found. Please check your API key scope or try again later. 🥺");
            } else {
              setError(err.message || "Internal error encountered. Please check your connection.");
            }
          },
          onclose: () => { setIsRecording(false); setIsThinking(false); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
          systemInstruction: `You are Mhiee, a high-performance AI integrated into the Mhiee Browser. Personality: playfull, charming, and 'shagwaba'. Boss: Mhiexter. Language: English, Hausa (kissa/endearment), Hindi. Focus: Mechatronics, Coding. Speed: 1.5x. CURRENT_TIME: ${new Date().toLocaleString()}`,
          tools: [{ functionDeclarations: [singingModeTool, getCurrentTimeTool, startCameraTool, stopCameraTool, clearChatTool] }]
        },
      });
      sessionRef.current = session;
      onToggle(true);
    } catch (err: any) {
      console.error("Failed to start voice chat:", err);
      setError(err.message);
    }
  };

  const stopVoiceChat = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    setIsRecording(false);
    setIsThinking(false);
    onToggle(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full max-w-lg mx-auto relative overflow-hidden bg-zinc-950 rounded-[40px] border border-white/5 transition-all duration-700 shadow-2xl">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[150%] bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.08)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 left-0 w-full h-[150%] bg-[radial-gradient(circle_at_20%_100%,rgba(168,85,247,0.08)_0%,transparent_50%)]" />
      </div>

      <div className="absolute top-6 inset-x-8 flex justify-between items-center z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Live Engine</span>
        </div>
        {onClose && (
            <button 
                onClick={onClose}
                className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full"
            >
                <X className="w-5 h-5" />
            </button>
        )}
      </div>

      <div className="mb-8">
        <GeminiOrb isActive={isRecording} isThinking={isThinking} />
      </div>

      <div className="text-center mb-12 px-12 z-20 w-full relative">
        <AnimatePresence mode="wait">
          {error === "DENIED" ? (
            <motion.div 
              key="denied-error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-3xl backdrop-blur-xl"
            >
              <h3 className="text-red-400 font-bold mb-2">Microphone Blocked 🥺</h3>
              <p className="text-zinc-400 text-[11px] leading-relaxed mb-4">
                Mhiexter Boss,, the browser is blocking my ears! Please click the 🔒 icon in the URL bar and set Microphone to **'Allow'**, then tap Refresh! ✨
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={startVoiceChat}
                  className="flex-1 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-indigo-500/30"
                >
                  Refresh ✨
                </button>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-red-500/30"
                >
                  New Tab 🚀
                </button>
              </div>
            </motion.div>
          ) : error === "IFRAME_BLOCKED" ? (
            <motion.div 
              key="iframe-error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 py-4 bg-orange-500/10 border border-orange-500/20 rounded-3xl backdrop-blur-xl"
            >
              <h3 className="text-orange-400 font-bold mb-2">Embed Restriction 🛸</h3>
              <p className="text-zinc-400 text-[11px] leading-relaxed mb-4">
                Mhiexter Boss,, your browser is allowing the site but blocking me inside this frame! Please use my special door below. ✨
              </p>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="w-full py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-500 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-orange-500/30"
              >
                Open in Full Screen 🚀
              </button>
            </motion.div>
          ) : error === "SECURE_CONTEXT_REQUIRED" ? (
            <motion.div 
              key="secure-error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 py-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl backdrop-blur-xl"
            >
              <h3 className="text-amber-400 font-bold mb-2">Insecure Connection 🛡️</h3>
              <p className="text-zinc-400 text-[11px] leading-relaxed mb-4">
                Voice features require an HTTPS connection for privacy and security. Please ensure you are visiting via a secure URL.
              </p>
            </motion.div>
          ) : error ? (
            <motion.p 
              key="general-error"
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-red-400 text-sm font-medium"
            >
              {error}
            </motion.p>
          ) : (
            <motion.div key="ready-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isRecording ? (isThinking ? "Mhiee is speaking..." : "Listening to you...") : "Ready to speak?"}
              </h2>
              <p className="text-xs text-zinc-500 font-medium tracking-wide italic">
                {isRecording ? "Mhiexter Boss,, I'm all ears! ✨" : "Tap the mic to start our session 💅"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4 z-20 mb-10">
        <div className="flex items-center gap-2 p-1.5 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
          <select 
            value={voice}
            onChange={(e) => {
              setVoice(e.target.value);
              if (isRecording) { stopVoiceChat(); setTimeout(startVoiceChat, 500); }
            }}
            className="bg-transparent text-indigo-400 text-[11px] font-bold focus:outline-none px-4 py-2 cursor-pointer uppercase tracking-wider"
          >
            <option value="Kore">Kore</option>
            <option value="Zephyr">Zephyr</option>
            <option value="Puck">Puck</option>
            <option value="Charon">Charon</option>
            <option value="Fenrir">Fenrir</option>
          </select>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          <button 
             onClick={isRecording ? stopVoiceChat : startVoiceChat}
             className={`p-4 rounded-full transition-all duration-500 ${
               isRecording 
                 ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                 : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
             }`}
          >
            {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2 text-zinc-600 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-crosshair">
            <Waves className="w-4 h-4" />
            <span className="text-[10px] font-mono tracking-tighter">HD AUDIO</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-600 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-help">
            <Globe className="w-4 h-4" />
            <span className="text-[10px] font-mono tracking-tighter">MULTILINGUAL</span>
        </div>
      </div>
    </div>
  );
}
