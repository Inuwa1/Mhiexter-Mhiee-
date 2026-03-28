import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MonitorPlay, Mic, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LiveSession({ onClose }: { onClose: () => void }) {
  const [showRules, setShowRules] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([{role: 'model', text: 'How can I help you today?'}]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const sendFrame = () => {
    if (!isLive || !canvasRef.current || !videoRef.current || !sessionRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw the current camera frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Convert to a small, fast JPEG (quality 0.4 for speed)
    const base64Frame = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];

    // 3. Send to Gemini Live session
    sessionRef.current.sendRealtimeInput({ video: { data: base64Frame, mimeType: 'image/jpeg' } });

    // 4. SET TO 25% OF A SECOND (250ms)
    setTimeout(sendFrame, 250); 
  };

  const sendMessage = () => {
    if (chatInput.trim() && sessionRef.current) {
      sessionRef.current.sendRealtimeInput({ text: chatInput });
      setMessages(prev => [...prev, { role: 'user', text: chatInput }]);
      setChatInput('');
    }
  };

  const startLiveSession = async (mode: 'user' | 'environment' = 'user') => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Camera access is not supported in this environment.");
      return;
    }

    try {
      let stream;
      try {
        // Attempt 1: Requested facingMode with strict audio constraints
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: mode }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      } catch (err) {
        console.warn(`Failed to start camera with mode: ${mode} and strict audio, trying fallback...`, err);
        try {
          // Attempt 2: Default camera with basic audio
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true
          });
        } catch (err2) {
          console.error("All camera access attempts failed.", err2);
          throw err2; // Rethrow to be caught by the outer catch
        }
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: async () => {
            console.log("Live session connected");
            setIsLive(true);
            const session = sessionRef.current;
            if (!session) return;
            
            // Start streaming video using sendFrame
            sendFrame();

            // Start streaming audio using Web Audio API for low latency
            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) {
              console.error("No audio track found");
              return;
            }
            const audioContext = new AudioContext({ sampleRate: 16000 });
            await audioContext.resume();
            const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert to PCM 16-bit
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = inputData[i] * 32767;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              session.sendRealtimeInput({ audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
              console.log("Audio data sent to session");
            };

            audioContextRef.current = audioContext;
            processorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log("Message received from model:", message);
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const audioContext = audioContextRef.current;
              await audioContext.resume();
              const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
              
              // Convert PCM 16-bit to Float32
              const pcm16 = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768;
              }

              const audioBuffer = audioContext.createBuffer(1, float32.length, 16000);
              audioBuffer.copyToChannel(float32, 0);
              
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              source.start();
            }
          },
          onerror: (err) => console.error("Live session error:", err),
          onclose: () => {
            setIsLive(false);
            stream.getTracks().forEach(track => track.stop());
            if (audioContextRef.current) {
              audioContextRef.current.close();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Mhiee, a helpful assistant. You are in a real-time voice and video chat with the user. You can see them through their camera.",
        },
      });
      sessionRef.current = session;
      
    } catch (err) {
      console.error("Error starting live session:", err);
      if (err instanceof Error) {
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
      }
      alert(`Could not start camera: ${err instanceof Error ? err.message : 'Unknown error'}. Please ensure you have granted camera permissions and that no other application is using the camera.`);
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
