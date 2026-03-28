import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export const useLiveSession = () => {
  const [isLive, setIsLive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startLiveSession = async (mode: 'user' | 'environment' = 'user') => {
    setFacingMode(mode);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Camera access is not supported in this environment.");
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
            setIsLive(true);
            sendFrame();
            
            const audioTrack = stream.getAudioTracks()[0];
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
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data && audioContextRef.current) {
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
              
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              source.start();
            }
          },
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
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
          systemInstruction: "You are Mhiee, a helpful assistant.",
        },
      });
      sessionRef.current = session;
    } catch (err) {
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
    const base64Frame = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];
    sessionRef.current.sendRealtimeInput({ video: { data: base64Frame, mimeType: 'image/jpeg' } });
    setTimeout(sendFrame, 250); 
  };

  return { isLive, facingMode, videoRef, canvasRef, startLiveSession, sessionRef };
};
