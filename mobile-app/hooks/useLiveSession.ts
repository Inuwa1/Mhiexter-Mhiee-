import { useState, useRef } from 'react';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { GoogleGenAI } from "@google/genai";

export const useLiveSession = () => {
  const [isLive, setIsLive] = useState(false);
  const [transcription, setTranscription] = useState('');
  
  // Camera and Audio refs for mobile
export const useLiveSession = () => {
  const [isLive, setIsLive] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  
  const cameraRef = useRef<CameraView>(null);
  const sessionRef = useRef<any>(null);

  const startLiveSession = async () => {
    if (!permission) {
      await requestPermission();
    }
    if (permission?.granted === false) {
      console.log("Camera permission not granted");
      return;
    }

    // Audio permission
    const audioPermission = await Audio.requestPermissionsAsync();
    if (audioPermission.granted === false) {
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
        systemInstruction: "You are Mhiee, a helpful assistant. You are in a real-time voice and video chat with the user. Identify and analyze objects you see on camera.",
      },
    });
    sessionRef.current = session;

    console.log("Starting mobile live session...");
  };

  return { isLive, cameraRef, startLiveSession, transcription };
};
