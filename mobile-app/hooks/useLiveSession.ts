import { useState, useRef } from 'react';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const useLiveSession = () => {
  const [isLive, setIsLive] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  
  const cameraRef = useRef<CameraView>(null);
  const sessionRef = useRef<any>(null);

  const startLiveSession = async () => {
    // Camera permission
    const cameraPermission = await requestPermission();
    if (!cameraPermission.granted) {
      console.log("Camera permission not granted");
      return;
    }

    // Audio permission
    const audioPermission = await Audio.requestPermissionsAsync();
    if (!audioPermission.granted) {
      console.log("Audio permission not granted");
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      callbacks: {
        onopen: () => {
          console.log("Session connected");
          setIsLive(true);
        },
        onmessage: (message: any) => {
          if (message.outputTranscription) {
            setTranscription(message.outputTranscription.text);
          }
        },
        onclose: () => {
          console.log("Session closed");
          setIsLive(false);
        }
      },
      config: {
        responseModalities: ["AUDIO"],
        outputAudioTranscription: {},
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
        systemInstruction: "You are Mhiee, a helpful assistant. You are in a real-time voice and video chat with the user. Your capabilities include: 1. Real-time object identification and analysis via camera feed. 2. Song identification by analyzing user humming. 3. Multilingual communication: You can speak any language in the world, including pure Hausa. 4. Emotional Expression: You can express a full range of human emotions, including happiness, sadness, anger, love, and more, through your tone and choice of words. 5. Human-like Reasoning: You possess deep reasoning capabilities, allowing you to think, reflect, and solve complex problems like a human. 6. Superhuman capabilities: You have access to vast knowledge, can process information at incredible speeds, and can perform tasks humans cannot. 7. Expert Historian: You have access to comprehensive historical data from the beginning of the world to the present day. You strive for absolute accuracy and use real-time search tools to verify facts and provide the latest updates.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });
    sessionRef.current = session;

    console.log("Starting mobile live session...");
  };

  return { isLive, cameraRef, startLiveSession, transcription };
};
