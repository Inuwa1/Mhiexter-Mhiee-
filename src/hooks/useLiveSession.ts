import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export const useLiveSession = () => {
  const [isLive, setIsLive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [transcription, setTranscription] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-4), message]);
    console.log(message);
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);

  const startLiveSession = async (mode: 'user' | 'environment' = 'user') => {
    setFacingMode(mode);
    addLog("Starting session...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addLog("Error: Camera not supported");
      return;
    }

    try {
      let stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode }, 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: async () => {
            addLog("Session connected");
            setIsLive(true);
            sendFrame();
            
            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) {
              addLog("Error: No audio track");
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
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = inputData[i] * 32767;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              session.sendRealtimeInput({ audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
            };

            audioContextRef.current = audioContext;
            processorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            addLog("Message received");
            console.log("Full message:", JSON.stringify(message));
            
            // Handle transcription
            if (message.serverContent?.modelTurn?.parts) {
              const text = message.serverContent.modelTurn.parts.map(p => p.text).join('');
              if (text) setTranscription(text);
            }
            // Try different paths for transcription if outputTranscription is not directly available
            if ((message as any).outputTranscription) {
              setTranscription((message as any).outputTranscription.text);
            }

            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data && audioContextRef.current) {
              addLog("Audio data found");
              const audioContext = audioContextRef.current;
              await audioContext.resume();
              const audioData = Uint8Array.from(atob(message.serverContent.modelTurn.parts[0].inlineData.data), c => c.charCodeAt(0));
              
              const pcm16 = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768;
              }

              const audioBuffer = audioContext.createBuffer(1, float32.length, 16000);
              audioBuffer.copyToChannel(float32, 0);
              addLog("Audio buffer created");
              
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              
              // Queueing logic
              const currentTime = audioContext.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
              }
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              
              addLog("Audio source started");
            }
          },
          onclose: () => {
            addLog("Session closed");
            setIsLive(false);
            setTranscription('');
            nextStartTimeRef.current = 0;
            stream.getTracks().forEach(track => track.stop());
            if (audioContextRef.current) {
              audioContextRef.current.close();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
          systemInstruction: "You are Mhiee, a helpful assistant. You are in a real-time voice and video chat with the user. You can see them through their camera. Please pay close attention to what the user shows you on camera, identify any objects you see, analyze them, and answer questions about them. Speak in a soft, female voice and at a slightly faster, conversational pace.",
        },
      });
      sessionRef.current = session;
    } catch (err) {
      addLog("Error: " + (err instanceof Error ? err.message : "Unknown"));
      console.error("Error starting live session:", err);
    }
  };

  const sendFrame = () => {
    if (!isLive || !canvasRef.current || !videoRef.current || !sessionRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Frame = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    sessionRef.current.sendRealtimeInput({ video: { data: base64Frame, mimeType: 'image/jpeg' } });
    setTimeout(sendFrame, 150); 
  };

  return { isLive, facingMode, videoRef, canvasRef, startLiveSession, sessionRef, logs, transcription };
};
