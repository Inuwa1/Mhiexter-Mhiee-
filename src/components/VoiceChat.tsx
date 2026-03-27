import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';

export default function VoiceChat({ onToggle }: { onToggle: (active: boolean) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const isSingingModeRef = useRef(false);
  const [voice, setVoice] = useState('Kore'); // Defaulting to your favorite
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

  const startVoiceChat = async () => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
      }
      const ai = new GoogleGenAI({ apiKey });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = 1.5; 
      gainNodeRef.current.connect(audioContextRef.current.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      nextStartTimeRef.current = audioContextRef.current.currentTime;

      console.log("Starting voice chat, model:", "gemini-2.5-flash-native-audio-preview-12-2025");
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            setIsRecording(true);
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
            
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
                  if (active && durationMinutes) {
                    setTimeout(() => { isSingingModeRef.current = false; }, durationMinutes * 60 * 1000);
                  }
                } else if (call.name === 'getCurrentTime') {
                  session.sendToolResponse({
                    functionResponses: [{
                      name: 'getCurrentTime',
                      id: call.id,
                      response: { result: { time: new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }) } }
                    }]
                  });
                }
              }
              return;
            }

            if (message.serverContent?.interrupted && !isSingingModeRef.current) {
              activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = audioContextRef.current!.currentTime;
              return;
            }

            if (message.serverContent?.modelTurn?.parts[0]?.inlineData) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
              if (audioContextRef.current!.state === 'suspended') await audioContextRef.current!.resume();

              try {
                const pcmData = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
                const audioBuffer = audioContextRef.current!.createBuffer(1, pcmData.length, 16000);
                const channelData = audioBuffer.getChannelData(0);
                for (let i = 0; i < pcmData.length; i++) { channelData[i] = pcmData[i] / 32768; }

                const sourceNode = audioContextRef.current!.createBufferSource();
                sourceNode.buffer = audioBuffer;
                sourceNode.connect(gainNodeRef.current!);
                activeSourcesRef.current.add(sourceNode);
                sourceNode.onended = () => { activeSourcesRef.current.delete(sourceNode); };

                const startTime = Math.max(nextStartTimeRef.current, audioContextRef.current!.currentTime);
                sourceNode.start(startTime);
                nextStartTimeRef.current = startTime + audioBuffer.duration;
              } catch (e) { console.error('Audio play error:', e); }
            }
          },
          onerror: (err) => console.error(err),
          onclose: () => setIsRecording(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
          systemInstruction: `You are Mhiee, a helpful, intelligent, and energetic AI assistant. The current date and time is ${new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })}. Speak at a fast, energetic pace (1.5x speed). Use a pleasant female voice. You can speak English, Hausa, and Hindi. If the user asks for 'Singing Mode', enter it and do not stop singing until asked, even if interrupted.`,
          tools: [{ functionDeclarations: [singingModeTool, getCurrentTimeTool] }]
        },
      });
      sessionRef.current = session;
      onToggle(true);
    } catch (err) {
      console.error("Failed to start voice chat:", err);
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
    onToggle(false);
  };

  return (
    <div className="flex items-center gap-2">
      <select 
        value={voice}
        onChange={(e) => {
          setVoice(e.target.value);
          if (isRecording) { stopVoiceChat(); setTimeout(startVoiceChat, 500); }
        }}
        className="bg-zinc-900 text-pink-400 text-xs rounded-lg px-2 py-1 border border-pink-500/50 focus:outline-none"
      >
        <option value="Kore">Energetic (Kore)</option>
        <option value="Zephyr">Sweet & Soft (Zephyr)</option>
        <option value="Puck">Cheerful (Puck)</option>
        <option value="Charon">Formal (Charon)</option>
        <option value="Fenrir">Deep (Fenrir)</option>
      </select>
      <button 
        onClick={isRecording ? stopVoiceChat : startVoiceChat}
        className={`p-2.5 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-pink-500 hover:bg-pink-500 hover:text-white'}`}
      >
        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
    </div>
  );
}
