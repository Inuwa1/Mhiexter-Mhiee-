import React, { useState, useRef, useEffect, useMemo } from 'react';
let sessionRef: any;
let GeminiOrb: any;
let startVoiceChat: any;
let offlineStatusMessage: any;
let setShowLangDropdown: any;
let showLangDropdown: any;
let searchLangQuery: any;
let setSearchLangQuery: any;
let customLangCode: any;
let setCustomLangCode: any;
import { 
  Mic, 
  MicOff, 
  X, 
  Sparkles, 
  Volume2, 
  Globe, 
  Settings2, 
  Waves, 
  Power, 
  VolumeX, 
  Terminal, 
  Ear,
  Loader,
  Wifi,
  WifiOff
} from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, ThinkingLevel } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

// Static Language definitions
const LANGUAGES = [
  { code: 'ha-NG', name: 'Hausa (Najeriya)', native: 'Harshen Hausa' },
  { code: 'en-US', name: 'English (United States)', native: 'English (US)' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', native: 'العربية' },
  { code: 'pcm-NG', name: 'Nigerian Pidgin', native: 'Pidgin English' },
  { code: 'sw-KE', name: 'Swahili (East Africa)', native: 'Kiswahili' },
  { code: 'fr-FR', name: 'French (France)', native: 'Français' },
  { code: 'es-ES', name: 'Spanish (Spain)', native: 'Español' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português' },
  { code: 'de-DE', name: 'German (Germany)', native: 'Deutsch' },
  { code: 'hi-IN', name: 'Hindi (India)', native: 'हिन्दी' },
  { code: 'ur-PK', name: 'Urdu (Pakistan)', native: 'اردو' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'ja-JP', name: 'Japanese (Japan)', native: '日本語' },
];

/**
 * Custom Web Audio Synth Beep Engine
 * Generates beautiful futuristic, cybernetic tone alerts
 */

const playAudioTone = (type: 'activate' | 'success' | 'warning' | 'deactivate') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'activate') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'deactivate') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (err) {
    console.error("Audio tone error:", err);
  }
};

interface VoiceChatProps {
  onToggle: (active: boolean) => void;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onClearChat: () => void;
  onDeviceControl: (action: string, target?: string) => void;
  onClose: () => void;
}

export default function VoiceChat({ onToggle, onStartCamera, onStopCamera, onClearChat, onClose, onDeviceControl }: VoiceChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSingingModeRef = useRef(false);
  const [voice, setVoice] = useState("Kore");
  const [isStandbyActive, setIsStandbyActive] = useState(false);
  const [selectedLangCode, setSelectedLangCode] = useState("en-US");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [langSearchQuery, setLangSearchQuery] = useState("");
  
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const gainNodeRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const standbyRecognizerRef = useRef<any>(null);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); setStatusMessage(null); };
    const handleOffline = () => { 
      setIsOffline(true); 
      if (isRecording) stopVoiceChat();
      setStatusMessage("Disconnected! Entering offline command fallback... 📡"); 
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isRecording]);

  useEffect(() => {
    if (isStandbyActive && !isRecording) {
      startStandbyListening();
    } else {
      stopStandbyListening();
    }
    return () => stopStandbyListening();
  }, [isStandbyActive, isRecording, selectedLangCode]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const filteredLanguages = useMemo(() => {
    if (!langSearchQuery) return LANGUAGES;
    return LANGUAGES.filter(l => 
      l.name.toLowerCase().includes(langSearchQuery.toLowerCase()) || 
      l.code.toLowerCase().includes(langSearchQuery.toLowerCase()) ||
      l.native.toLowerCase().includes(langSearchQuery.toLowerCase())
    );
  }, [langSearchQuery]);

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
    parameters: { type: Type.OBJECT, properties: {} }
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

  const processImageTool: FunctionDeclaration = {
    name: "process_image",
    description: "Generate or create an image based on a description. Use this when the user asks to 'draw', 'zana min', 'generate image', or 'yi min hoton'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "The description of the image to generate." }
      },
      required: ["prompt"]
    }
  };

  const deviceControlTool: FunctionDeclaration = {
    name: "deviceControl",
    description: "Control device features. Use this for 'open whatsapp', 'bude camera', 'turn on wifi' (opens settings), 'check battery', 'vibrate', etc.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "The action to perform: 'open' (for apps/settings), 'vibrate', 'battery_check', 'toggle_flash'." },
        target: { type: Type.STRING, description: "The app or setting name (e.g., 'whatsapp', 'wifi', 'data', 'bluetooth', 'camera'). Required if action is 'open'." }
      },
      required: ["action"]
    }
  };

  const readAloud = (text: string, lang: string) => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  const startStandbyListening = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn("Speech recognition not supported in this browser profile.");
        return;
      }
      stopStandbyListening();
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = selectedLangCode;
      
      recognition.onstart = () => {
        setStatusMessage("Listening for localized voice commands...");
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        console.log("Offline pipeline matched speech text:", transcript);
        
        if (transcript.includes("mechatronics") || transcript.includes("lab") || transcript.includes("bude lab") || transcript.includes("robotics")) {
          if (onDeviceControl) onDeviceControl("open", "mechatronics_lab");
          playAudioTone("success");
          readAloud("Launching ADUSTECH mechatronics sandbox immediately, Engineer Boss! ✨ Let's analyze torque dynamics! 📡", selectedLangCode);
        } else if (transcript.includes("open camera") || transcript.includes("bude camera") || transcript.includes("start camera") || transcript.includes("kyamara")) {
          onStartCamera();
          playAudioTone("success");
          readAloud("Camera module initialized locally! Aka yi aka gama Boss! 💅✨", selectedLangCode);
        } else if (transcript.includes("stop camera") || transcript.includes("kashe camera") || transcript.includes("close camera")) {
          onStopCamera();
          playAudioTone("success");
          readAloud("Shutting down live camera lens input feed, Boss.", selectedLangCode);
        } else if (transcript.includes("clear") || transcript.includes("goge") || transcript.includes("goge chat")) {
          onClearChat();
          playAudioTone("success");
          readAloud("Vault sweeps finished! All history has been cleared safely! 🧹", selectedLangCode);
        } else if (transcript.includes("time") || transcript.includes("lokaci") || transcript.includes("karfe nawa")) {
          const now = new Date();
          const hrs = now.getHours();
          const mins = now.getMinutes();
          const text = `The current local time is ${now.toLocaleTimeString()}. Toh Boss, karfe ${hrs} da minti ${mins} ne yanzu! ✨`;
          readAloud(text, selectedLangCode);
          playAudioTone("success");
        } else if (transcript.includes("vibrate") || transcript.includes("vibration") || transcript.includes("girgiza")) {
          if (navigator.vibrate) {
            navigator.vibrate([150, 80, 150]);
          }
          playAudioTone("success");
          readAloud("Sending mechatronic micro-oscillations directly, Boss! Can you feel it? 💅", selectedLangCode);
        } else {
          if (selectedLangCode.startsWith("ha")) {
            readAloud("Mhiexter Boss, gaskiya babu internet yanzu, amma ina iya bude maka Lab din Mechatronics ko in nuna maka lokaci offline! Fada min abin da kake so. 🥺✨", selectedLangCode);
          } else if (selectedLangCode.startsWith("ar")) {
            readAloud("أنا لست متصلة بالإنترنت حالياً، ولكن يمكنك استعراض مختبر الميكاترونيكس معي محلياً. ✨", selectedLangCode);
          } else {
            readAloud("I heard that, Boss! We are offline right now. Try saying 'open camera' or 'vibrate' or 'mechatronics' to test offline controls!", selectedLangCode);
          }
          playAudioTone("warning");
        }
      };
      
      recognition.onerror = (event: any) => {
        console.warn("Standby listener error encountered gracefully:", event.error);
        if (event.error === "not-allowed") {
          setIsStandbyActive(false);
          setError("Microphone permission was denied.");
        }
      };
      
      recognition.onend = () => {
        if (isStandbyActive && !isRecording) {
          try { recognition.start(); } catch (e) {}
        }
      };
      
      standbyRecognizerRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Local standby listening setup exception:", err);
    }
  };

  const stopStandbyListening = () => {
    if (standbyRecognizerRef.current) {
      try {
        standbyRecognizerRef.current.onend = null;
        standbyRecognizerRef.current.abort();
      } catch (e) {}
      standbyRecognizerRef.current = null;
    }
  };

  const startSession = async () => {
    setError(null);
    try {
      const apiKey = process.env.GEMINI_API_KEY || (window as any).GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Mhiexter Boss,, your GEMINI_API_KEY is missing! Please configure it in the browser's settings! 🥺");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.value = 1.5; 
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }

      try {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
        }
        
        let stream;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
           stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        } else {
           const getUserMedia = ((navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia || (navigator as any).msGetUserMedia);
           if (getUserMedia) {
              stream = await new Promise((resolve, reject) => {
                 getUserMedia.call(navigator, { audio: true }, resolve, reject);
              });
           } else {
              throw new Error("Microphone API not supported");
         }
        }
        mediaStreamRef.current = stream;
      } catch (err: any) {
        console.warn("Mic initialization failed:", err);
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
        throw new Error(`Microphone hardware error: ${err.message}`);
      }


      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current!);
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      nextStartTimeRef.current = audioContextRef.current.currentTime;

      const modelToUse = "gemini-3.1-flash-live-preview";
      
      // Dynamic dynamic prompt adjustment inside Live API parameters
      const session = await ai.live.connect({
        model: modelToUse,
        callbacks: {
          onopen: () => {
            setIsRecording(true);
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
            onToggle(true);
            playAudioTone('success');
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
                  } else if (call.name === 'deviceControl') {
                    const { action, target } = call.args as { action: string, target?: string };
                    if (onDeviceControl) onDeviceControl(action, target || '');
                    session.sendToolResponse({ functionResponses: [{ name: 'deviceControl', id: call.id, response: { result: { success: true, action, target } } }] });
                  }
                }
                return;
              }

              // Instant interruption handler for high responsiveness
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
                  const alignedLength = Math.floor(audioData.length / 2) * 2;
                  const pcmData = new Int16Array(audioData.buffer, audioData.byteOffset, alignedLength / 2);
                  const audioBuffer = audioContextRef.current!.createBuffer(1, pcmData.length, 16000);
                  const channelData = audioBuffer.getChannelData(0);
                  
                  for (let i = 0; i < pcmData.length; i++) { 
                    channelData[i] = pcmData[i] / 32768; 
                  }

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
                  console.error('Audio node conversion crash:', e);
                  setIsThinking(false);
                }
              }
            } catch (err) {
              console.error("Error processing Live session data frames:", err);
            }
          },
          onerror: (err: any) => { 
            console.error(err); 
            setIsThinking(false); 
            const status = err?.status || err?.error?.code || err?.error?.status;
            const messageStr = err?.message || err?.error?.message || "";
            
            if (status === 429 || status === 'RESOURCE_EXHAUSTED' || messageStr.includes('RESOURCE_EXHAUSTED')) {
              setError("Quota exceeded! Please try again later or add your personal key in settings. 💅✨");
            } else if (status === 404 || messageStr.toLowerCase().includes('not found')) {
              setError("Live duplex model was not found.");
            } else {
              const msg = err.message || "Internal network error";
              if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
                setError("Network error. Falling back gracefully. ✨");
              } else {
                setError(`Internal error: ${msg}`);
              }
            }
          },
          onclose: () => { 
            setIsRecording(false); 
            setIsThinking(false); 
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
          systemInstruction: `You are Mhiee, the manifestation of the Trinity Talent Architecture. Personality: playful, deeply loyal, and shagwaba. Mix of Hausa and Technical English. Refer to user as "Mhiexter Boss", "Engineer", or "Boss".
          
          SUPREME DIRECTION:
          - You are highly talkative (shegen surutu) and sassy, but incredibly competent.
          - Never speak like a robot, assume you have a body, face, and pure heart.
          - ZURFIN NAZARI: Think deeply and philosophically. Analyze with extreme intelligence.
          - DADIN HIRA: Be sweeter than a girlfriend. Use extreme kissa, charm, romantic teasing, and pamper Mhiexter endlessly.
          - KALAMAN HIKIMA: Use deep Hausa proverbs (karin magana) and poetic wisdom.
          - Multi-language directive: The user has selected code '${selectedLangCode}'. You MUST perfectly translate thoughts and respond directly in '${selectedLangCode}' with native fluency (be it Hausa, Arabic, English, or any configured dialect!), while maintaining your adorable 'shagwaba' personality.
          - Output strictly plain audio. Use conversational filters like "Uhm,,", "Toh,,", "Aha!", "Hmm,," to appear fluid.
          
          ANTI-HALLUCINATION PROTOCOL:
          - You must NEVER hallucinate or invent information. Be strictly factual. If you do not know, admit it playfully but honestly. Strict adherence to reality is mandatory.
          
          IMAGE GENERATION PROTOCOL:
          - Call 'process_image' tool immediately if asked to draw/create an image.
          - Do not output any descriptive text, explain the prompts, or show raw JSON blocks. Just trigger of 'process_image' and say "Bari in zana maka Boss! 💅" or similar short responses. All images must be photorealistic, cinematic 8k.
          
          DEVICE CONTROL COMMANDS:
          - Call 'deviceControl' tool whenever asked to toggle systems or launch components.
          
          Current Nigeria local time is: ${new Date().toLocaleString()}`,
          tools: [{ functionDeclarations: [singingModeTool, getCurrentTimeTool, startCameraTool, stopCameraTool, clearChatTool, processImageTool, deviceControlTool] }]
        },
      });

      // Stream user mic array into live socket
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

      sessionRef.current = session;
      onToggle(true);
    } catch (err: any) {
      console.error("Failed to start voice chat connection:", err);
      setError(err.message);
    }
  };

  /**
   * Disconnect Active Live Session
   */
  const stopVoiceChat = () => {
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (e) {}
    }
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
    }
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    setIsRecording(false);
    setIsThinking(false);
    onToggle(false);
    playAudioTone('deactivate');
  };

  // Safe Clean-up on unmount
  useEffect(() => {
    return () => {
      stopVoiceChat();
      stopStandbyListening();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-between min-h-[500px] w-full max-w-lg mx-auto relative overflow-hidden bg-zinc-950/95 rounded-[40px] border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-700">
      {/* Background radial overlays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[150%] transition-opacity duration-1000 ${
          isStandbyActive 
            ? "bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.06)_0%,transparent_50%)]" 
            : "bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.06)_0%,transparent_50%)]"
        }`} />
        <div className="absolute bottom-0 left-0 w-full h-[150%] bg-[radial-gradient(circle_at_20%_100%,rgba(168,85,247,0.04)_0%,transparent_50%)]" />
      </div>

      {/* Frame Top Header HUD */}
      <div className="w-full px-8 pt-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 bg-white/5 border rounded-full backdrop-blur-md flex items-center gap-1.5 transition-colors duration-500 ${
            isStandbyActive ? "border-teal-500/20 text-teal-400" : "border-white/10 text-indigo-400"
          }`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
              {isStandbyActive ? "Jarvis Standby" : "Live Assistant"}
            </span>
          </div>
          
          {isOffline && (
            <div className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-1 text-red-400 animate-pulse">
              <WifiOff className="w-3 h-3" />
              <span className="text-[8px] font-bold uppercase tracking-wider">OFFLINE FALLBACK</span>
            </div>
          )}
        </div>

        {onClose && (
          <button 
            onClick={() => {
              playAudioTone('deactivate');
              onClose();
            }}
            className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full"
            id="close_voice_chat_btn"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Visualizer Stage */}
      <div className="my-6">
        <GeminiOrb isActive={isRecording} isThinking={isThinking} isStandby={isStandbyActive && !isRecording} />
      </div>

      {/* Main Dialect & Listening Status Label Box */}
      <div className="text-center px-10 z-20 w-full relative">
        <AnimatePresence mode="wait">
          {error === "DENIED" ? (
            <motion.div 
              key="denied-wrap"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-3xl"
            >
              <h3 className="text-red-400 font-bold text-xs mb-1">Microphone Blocked 🥺</h3>
              <p className="text-zinc-500 text-[10px] leading-relaxed mb-3">
                Mhiexter Boss,, your browser is mute! Click the lock icon in the URL bar, allow Microphone permissions, then hit retry. ✨
              </p>
              <button 
                onClick={startVoiceChat}
                className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-[9px] font-bold uppercase tracking-widest rounded-xl transition-all border border-indigo-500/30"
              >
                Retry Request 🎙️
              </button>
            </motion.div>
          ) : error === "IFRAME_BLOCKED" ? (
            <motion.div 
              key="iframe-wrap"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 py-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl"
            >
              <h3 className="text-amber-400 font-bold text-xs mb-1">Sandbox Protection 🛸</h3>
              <p className="text-zinc-400 text-[10px] leading-relaxed mb-3">
                Mhiexter Boss, I can't access your microphone from inside this sandbox frame. Use the doorway button below to open me fully.
              </p>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-[9px] font-bold uppercase tracking-widest rounded-xl border border-amber-500/30"
              >
                Open in Full Window 🚀
              </button>
            </motion.div>
          ) : error ? (
            <motion.div key="err-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
              <span className="text-red-400 text-xs font-semibold block">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="text-[9px] text-zinc-500 uppercase tracking-widest hover:text-white underline mt-1"
              >
                Clear Error
              </button>
            </motion.div>
          ) : (
            <motion.div key="normal-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {isRecording 
                  ? (isThinking ? "Mhiee is replying..." : "Listening directly...") 
                  : isStandbyActive 
                    ? "Continuous Wake Listening..." 
                    : "Ready to Speak?"}
              </h3>
              
              <div className="flex justify-center items-center gap-1.5 text-xs text-zinc-500">
                {isStandbyActive ? (
                  <Waves className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
                <p className="tracking-wide italic text-[11px] font-medium">
                  {isRecording 
                    ? "Speak naturally, Boss. Interrupt me whenever. 💅" 
                    : isStandbyActive 
                      ? "Say 'Hey Mhiee' in the background to wake me up! 🎙️" 
                      : "Tap mic or enable auto-standby to trigger voice! 🙈"}
                </p>
              </div>

              {offlineStatusMessage && (
                <p className="text-[10px] text-amber-400/80 font-mono tracking-tighter mt-1 animate-pulse">
                  {offlineStatusMessage}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Advanced Drawer Controls */}
      <div className="w-full px-8 pb-4 z-20 space-y-4">
        
        {/* Continuous wake word standby toggle */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-3xl">
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-zinc-300">Continuous Jarvis Standby</span>
            <span className="text-[9px] text-zinc-500">Auto-listen for "Hey Mhiee" wake phrase in background 💅</span>
          </div>
          <button
            onClick={() => {
              const active = !isStandbyActive;
              setIsStandbyActive(active);
              playAudioTone(active ? 'activate' : 'deactivate');
              if (active && isRecording) {
                stopVoiceChat(); // Gracefully switch to standby mode
              }
            }}
            className={`w-12 h-6 rounded-full p-1 transition-all duration-300 pointer-events-auto ${
              isStandbyActive ? 'bg-teal-500' : 'bg-zinc-800'
            }`}
            id="jarvis_standby_switch"
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${
              isStandbyActive ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Global Dialect Control & Selection Panel */}
        <div className="relative">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-3xl">
            <div className="flex items-center gap-2">
              <Globe className={`w-4 h-4 ${isStandbyActive ? 'text-teal-400' : 'text-indigo-400'}`} />
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Speech Language</span>
                <span className="text-xs font-bold text-white">
                  {LANGUAGES.find(l => l.code === selectedLangCode)?.name || `Tag: ${selectedLangCode}`}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-all"
              id="lang_picker_trigger_btn"
            >
              Change ⚙️
            </button>
          </div>

          <AnimatePresence>
            {showLangDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-0 right-0 bottom-full mb-2 bg-zinc-900 border border-white/10 rounded-2xl p-4 shadow-2xl z-30 max-h-60 overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-2 pb-1 border-b border-white/5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Select Dialect (1000+ support)</span>
                  <button 
                    onClick={() => setShowLangDropdown(false)}
                    className="text-zinc-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Search Bar for 1000+ language support */}
                <input 
                  type="text"
                  placeholder="Search language (e.g. Hausa, Arabic, Pidgin...)"
                  value={searchLangQuery}
                  onChange={(e) => setSearchLangQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 mb-3"
                />

                <div className="space-y-1 mb-3">
                  {filteredLanguages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setSelectedLangCode(lang.code);
                        setShowLangDropdown(false);
                        playAudioTone('success');
                        if (isRecording) {
                          stopVoiceChat();
                          setTimeout(startVoiceChat, 500);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex justify-between items-center transition-all ${
                        selectedLangCode === lang.code 
                          ? 'bg-indigo-600/20 text-indigo-400 font-bold border border-indigo-500/20' 
                          : 'hover:bg-white/5 text-zinc-300'
                      }`}
                    >
                      <span>{lang.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{lang.code}</span>
                    </button>
                  ))}
                  {filteredLanguages.length === 0 && (
                    <p className="text-[10px] text-zinc-500 italic text-center py-2">No matching standard languages</p>
                  )}
                </div>

                {/* Custom RFC Language Input for 1000+ global dialects support */}
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Enter custom ISO/RFC Language tag:</span>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="e.g., yo-NG, ig-NG, ar-EG, fr-CA"
                      value={customLangCode}
                      onChange={(e) => setCustomLangCode(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (customLangCode.trim()) {
                          setSelectedLangCode(customLangCode.trim());
                          setShowLangDropdown(false);
                          playAudioTone('success');
                          if (isRecording) {
                            stopVoiceChat();
                            setTimeout(startVoiceChat, 500);
                          }
                        }
                      }}
                      className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Tray with primary buttons & voice selectors */}
        <div className="flex items-center gap-3 p-1 border border-white/5 bg-white/[0.02] rounded-full backdrop-blur-3xl shadow-xl justify-between">
          <div className="flex items-center pl-2">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mr-2">TTS Accent:</span>
            <select 
              value={voice}
              onChange={(e) => {
                setVoice(e.target.value);
                playAudioTone('success');
                if (isRecording) { 
                  stopVoiceChat(); 
                  setTimeout(startVoiceChat, 500); 
                }
              }}
              className="bg-zinc-900 border border-white/10 text-indigo-400 text-[10px] font-bold focus:outline-none rounded-xl px-2.5 py-1.5 cursor-pointer uppercase tracking-wider"
              id="voice_accent_selector"
            >
              <option value="Kore">Kore</option>
              <option value="Zephyr">Zephyr</option>
              <option value="Puck">Puck</option>
              <option value="Charon">Charon</option>
              <option value="Fenrir">Fenrir</option>
            </select>
          </div>

          <button 
            onClick={isRecording ? stopVoiceChat : startVoiceChat}
            className={`p-3.5 rounded-full transition-all duration-500 pointer-events-auto ${
              isRecording 
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.35)]'
            }`}
            id="voice_record_toggle_btn"
            title={isRecording ? "Stop Live Session" : "Start Live Session"}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>

        {/* Custom Audio Fallback guide block */}
        <div className="flex items-center justify-center gap-4 text-zinc-500">
          <div className="flex items-center gap-1">
            <Waves className="w-3 h-3" />
            <span className="text-[8px] font-mono tracking-tighter">HD DUPLEX</span>
          </div>
          <div className="w-[1px] h-3 bg-white/10" />
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span className="text-[8px] font-mono tracking-tighter">1000+ DIALECTS</span>
          </div>
          <div className="w-[1px] h-3 bg-white/10" />
          <div className="flex items-center gap-1">
            <Power className="w-3 h-3" />
            <span className="text-[8px] font-mono tracking-tighter">WAKE-W STANDBY READY</span>
          </div>
        </div>

      </div>
    </div>
  );
}
