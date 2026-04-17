import React, { useState, useRef, useEffect } from 'react';
import Clock from './Clock';
import ThreeScene from './ThreeScene';
import MhiexterBrowser from './MhiexterBrowser';
import VoiceChat from './VoiceChat';
import BookGenerator from './BookGenerator';
import GraphRenderer from './GraphRenderer';
import LiveSession from './LiveSession';
import { Search, Shield, X, Globe, Sparkles, Send, Cast, MonitorOff, ImagePlus, XCircle, Download, Share2, Maximize2, SlidersHorizontal, Check, RotateCcw, Wand2, Copy, Mic, Map, Camera, BookOpen, Video, Volume2, Brain, Box, HelpCircle } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, FunctionCallingConfigMode, GenerateContentResponse, ThinkingLevel } from '@google/genai';
import { callAiWithRetry, streamAiWithRetry } from '../lib/aiUtils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Initialize Gemini API
// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  role: 'user' | 'model';
  text: string;
  images?: string[];
  generatedImage?: string;
  suggestions?: string[];
  groundingMetadata?: any;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

export default function MhieeBrowser({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [activeFolder, setActiveFolder] = useState<'video' | 'browser' | 'settings' | 'history' | 'map' | 'book' | 'memory' | '3d' | null>(null);
  const [memories, setMemories] = useState<{id: string, content: string}[]>(() => {
    const saved = localStorage.getItem('memories');
    if (saved) return JSON.parse(saved);
    const oldMemory = localStorage.getItem('memory');
    if (oldMemory) return [{ id: Date.now().toString(), content: oldMemory }];
    return [];
  });
  const [castError, setCastError] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [isMicrophonePermissionDenied, setIsMicrophonePermissionDenied] = useState(false);
  const [microphoneErrorMessage, setMicrophoneErrorMessage] = useState("");
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(localStorage.getItem('isWakeWordEnabled') !== 'false');
  const [preferredWakeWord, setPreferredWakeWord] = useState(localStorage.getItem('preferredWakeWord') || 'hey mhiee');
  const [defaultFace, setDefaultFace] = useState<string | null>(localStorage.getItem('defaultFace'));
  const [searchEngine, setSearchEngine] = useState<'Deepseek' | 'Chat GPT' | 'Gemini' | 'Bing' | 'DuckDuckGo' | 'Brave' | 'Ecosia' | 'Qwant' | 'Startpage'>('Gemini');
  const [selectedModel, setSelectedModel] = useState<'gemini-3.1-pro-preview' | 'gemini-3-flash-preview'>('gemini-3-flash-preview');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isContinuousListening, setIsContinuousListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showFocusWarning, setShowFocusWarning] = useState(false);
  const [focusMessage, setFocusMessage] = useState('');
  const [systemNotification, setSystemNotification] = useState<string | null>(null);
  const [messageQueue, setMessageQueue] = useState<{name: string, phone: string, message: string}[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const showNotification = (msg: string) => {
    setSystemNotification(msg);
    setTimeout(() => setSystemNotification(null), 5000);
  };

  useEffect(() => {
    const handleFocus = () => {
      if (messageQueue.length > 0) {
        const nextRecipient = messageQueue[0];
        const remainingQueue = messageQueue.slice(1);
        setMessageQueue(remainingQueue);
        
        showNotification(`Sending to ${nextRecipient.name}...`);
        window.open(`https://api.whatsapp.com/send?phone=${nextRecipient.phone}&text=${encodeURIComponent(nextRecipient.message)}`, '_blank');
        
        if (remainingQueue.length === 0) {
          setTimeout(() => showNotification("Bulk messaging complete."), 2000);
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [messageQueue]);

  const startRecording = async () => {
    try {
      console.log("Starting recording...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, processing audio...");
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          console.log("Audio processed, base64 length:", base64Audio.length);
          sendMessage("Analyze this audio note.", [], [base64Audio]);
        };
        reader.onerror = (err) => {
          console.error("FileReader error:", err);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log("Recording started.");
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  const stopRecording = () => {
    console.log("Stopping recording...");
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const startContinuousListening = async () => {
    console.log("startContinuousListening called. Using Gemini Live API instead of Deepgram.");
    // This is now handled by the VoiceChat component using Gemini Live API.
  };

  const executeCommand = (transcript: string) => {
    let lowerText = transcript.toLowerCase();
    const wakeWord = preferredWakeWord.toLowerCase();
    let awake = isAwake;
    
    if (lowerText.includes(wakeWord)) {
      setIsAwake(true);
      awake = true;
      console.log('Mhiee is awake!');
      setTimeout(() => stopContinuousListening(), 10000); // Stop listening after 10 seconds
      
      // Remove wake word
      lowerText = lowerText.replace(wakeWord, '').trim();
    }

    if (!awake) return;

    if (lowerText.includes('open new tab') || lowerText.includes('bude sabon shafi')) {
      console.log('Action: Opening a new tab...');
      // Logic to open tab
    } else if (lowerText.includes('scroll down')) {
      console.log('Action: Scrolling down...');
      window.scrollBy(0, 500);
    } else if (lowerText.length > 0) {
      console.log('Action: Sending question to AI:', lowerText);
      sendMessage(lowerText);
    }
  };

  const stopContinuousListening = () => {
    console.log("stopContinuousListening called");
    setIsContinuousListening(false);
    setIsAwake(false);
  };

  const handleTranslate = async (url: string) => {
    setIsTranslating(true);
    setTranslatedContent(null);
    try {
      const ai = new GoogleGenAI({ apiKey: (window as any).GEMINI_API_KEY });
      const language = localStorage.getItem('preferredLanguage') || 'English';
      const response = await callAiWithRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the content of the following URL to ${language}: ${url}`,
        config: {
          tools: [{ urlContext: {} }]
        }
      }));
      setTranslatedContent(response.text || "Translation failed.");
    } catch (error) {
      console.error(error);
      setTranslatedContent("Failed to translate page.");
    } finally {
      setIsTranslating(false);
    }
  };
  const [enableSummarization, setEnableSummarization] = useState(true);
  const [enableProblemSolving, setEnableProblemSolving] = useState(true);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const extractGraphData = (text: string) => {
    const match = text.match(/```json\s*(\{[\s\S]*?"type":\s*"graph"[\s\S]*?\})\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const handleAiAction = (actionData: any) => {
    console.log("Executing AI Action:", actionData);
    switch (actionData.decision_type) {
      case 'navigation':
        if (actionData.target_data?.url) {
          window.open(actionData.target_data.url, '_blank');
        } else if (actionData.action_command && (actionData.action_command.includes('://') || actionData.action_command.startsWith('mailto:') || actionData.action_command.startsWith('intent:'))) {
          window.open(actionData.action_command, '_blank');
        } else if (actionData.target_data?.folder) {
          setActiveFolder(actionData.target_data.folder);
        }
        break;
      case 'resource_management':
        showNotification(`Resource Management: ${actionData.action_command}`);
        break;
      case 'action_bridge':
        if (actionData.action_command === 'fetch_contact') {
          showNotification(`Fetching contact: ${actionData.target_data?.name}...`);
          // Simulate fetching contact and sending it back to the AI
          setTimeout(() => {
             sendMessage(`[SYSTEM: Contact fetched. Name: ${actionData.target_data?.name}, Phone: +2348000000000]`);
          }, 1500);
        } else if (actionData.action_command === 'send_message') {
           const phone = actionData.target_data?.contact_info?.phone || '';
           const text = actionData.target_data?.content || '';
           window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`, '_blank');
        } else if (actionData.action_command === 'bulk_send') {
           const recipients = actionData.target_data?.recipients || [];
           const message = actionData.target_data?.message || '';
           if (recipients.length > 0) {
             const firstRecipient = recipients[0];
             const remaining = recipients.slice(1).map((r: any) => ({ ...r, message }));
             setMessageQueue(remaining);
             
             showNotification(`Sending to ${firstRecipient.name}...`);
             window.open(`https://api.whatsapp.com/send?phone=${firstRecipient.phone}&text=${encodeURIComponent(message)}`, '_blank');
           }
        } else if (actionData.target_data?.whatsapp_text) {
           window.open(`https://wa.me/?text=${encodeURIComponent(actionData.target_data.whatsapp_text)}`, '_blank');
        } else {
           showNotification(`Action Bridge: ${actionData.action_command}`);
        }
        break;
      case 'focus_intervention':
        setShowFocusWarning(true);
        setFocusMessage(actionData.ai_message || actionData.action_command);
        break;
      case 'time_travel_save':
        const sessionToSave = { id: Date.now().toString(), title: actionData.target_data?.title || 'Saved Session', messages };
        setChatHistory(prev => [...prev, sessionToSave]);
        showNotification(`Time-Travel Memory Saved: ${sessionToSave.title}`);
        break;
      case 'background_task':
        if (actionData.action_command === 'send_notification' && actionData.target_data) {
          showNotification(`${actionData.target_data.title}: ${actionData.target_data.body}`);
        } else {
          showNotification(`Background Task: ${actionData.action_command}`);
        }
        break;
    }
  };

  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isObjectEditing, setIsObjectEditing] = useState(false);
  const [objectEditPrompt, setObjectEditPrompt] = useState('');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [videoPrompt, setVideoPrompt] = useState('');
  const [threePrompt, setThreePrompt] = useState('');
  const [threeKey, setThreeKey] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const memoryFileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const chatRef = useRef<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleVideoUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.type.startsWith('video/')) {
        console.log("Video uploaded:", file.name);
        // Handle video upload (e.g., upload to server or process)
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleVideoUpload(files);
  };

  const handleVideoGeneration = async () => {
    if (!videoPrompt || isGeneratingVideo) return;
    
    // Check for API key
    if (!(await (window as any).aistudio.hasSelectedApiKey())) {
      await (window as any).aistudio.openSelectKey();
    }

    setIsGeneratingVideo(true);
    setCastError('');
    setVideoUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: (window as any).GEMINI_API_KEY });
      let operation = await callAiWithRetry(() => ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: videoPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      }));

      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': apiKey!,
          },
        });
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
      } else {
        throw new Error("Failed to generate video.");
      }
    } catch (err: any) {
      console.error("Video Generation Error:", err);
      const errorMsg = typeof err === 'string' ? err : JSON.stringify(err);
      if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('Requested entity was not found')) {
        await (window as any).aistudio.openSelectKey();
        setCastError("Permission denied. Please select a valid paid API key.");
      } else {
        setCastError(err.message || "An error occurred during video generation.");
      }
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleYoutubeEmbed = () => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = youtubeUrl.match(regExp);
    if (match && match[2].length === 11) {
      setEmbedUrl(`https://www.youtube.com/embed/${match[2]}`);
    } else {
      setCastError('Invalid YouTube URL');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
    }
  };

  const readAloud = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      // Strip Markdown
      const plainText = text
        .replace(/[*_~`#]/g, '') // Remove basic markdown
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/\n/g, ' '); // Replace newlines with spaces

      const utterance = new SpeechSynthesisUtterance(plainText);
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (isCameraActive && cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [isCameraActive, cameraStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { exact: "environment" } } 
      });
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      // Fallback to any camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(stream);
        setIsCameraActive(true);
      } catch (err2) {
        showNotification("Could not access camera.");
      }
    }
  };

  const captureCamera = () => {
    if (cameraVideoRef.current && canvasRef.current) {
      const video = cameraVideoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setSelectedImages(prev => [...prev, dataUrl]);
      stopCamera();
    }
  };

  const handleDownload = (dataUrl: string, filename: string = 'mhiee-image.png') => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async (dataUrl: string) => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'mhiee-image.png', { type: blob.type });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Generated by Mhiee',
          files: [file]
        });
      } else {
        handleDownload(dataUrl);
      }
    } catch (err) {
      console.error('Error sharing:', err);
      handleDownload(dataUrl); // fallback
    }
  };

  const handleSaveEdit = async () => {
    if (!imgRef.current || !expandedImage) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    const cropX = completedCrop?.width ? completedCrop.x * scaleX : 0;
    const cropY = completedCrop?.height ? completedCrop.y * scaleY : 0;
    const cropWidth = completedCrop?.width ? completedCrop.width * scaleX : imgRef.current.naturalWidth;
    const cropHeight = completedCrop?.height ? completedCrop.height * scaleY : imgRef.current.naturalHeight;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    
    ctx.drawImage(
      imgRef.current,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const newImageUrl = canvas.toDataURL('image/png');
    
    setMessages(prev => prev.map(msg => {
      if (msg.generatedImage === expandedImage) {
        return { ...msg, generatedImage: newImageUrl };
      }
      return msg;
    }));

    setExpandedImage(newImageUrl);
    setIsEditingImage(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const getRegionName = (crop: Crop) => {
    if (!crop.width || !crop.height) return 'center';
    const cx = crop.x + crop.width / 2;
    const cy = crop.y + crop.height / 2;
    
    let vertical = 'middle';
    if (cy < 33) vertical = 'top';
    else if (cy > 66) vertical = 'bottom';
    
    let horizontal = 'center';
    if (cx < 33) horizontal = 'left';
    else if (cx > 66) horizontal = 'right';
    
    if (vertical === 'middle' && horizontal === 'center') return 'center';
    return `${vertical} ${horizontal}`;
  };

  const handleObjectEditSubmit = () => {
    if (!expandedImage || !objectEditPrompt.trim()) return;
    
    let finalPrompt = `Please edit this image: ${objectEditPrompt}. IMPORTANT: Do not decompose, alter, or touch the face of the person in the image. Ensure the editing looks completely natural and not like AI editing.`;
    if (completedCrop && completedCrop.width > 0) {
      finalPrompt += ` The object to modify is located roughly in the ${getRegionName(completedCrop)} of the image.`;
    }
    
    sendMessage(finalPrompt, [expandedImage]);
    
    // Reset and close
    setIsObjectEditing(false);
    setObjectEditPrompt('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setExpandedImage(null);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setSelectedImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    chatRef.current = null; // Reset chat session when memory changes
  }, [memories, selectedModel]);

  useEffect(() => {
    // SpeechRecognition is now handled by the Live API in VoiceChat
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
    setIsListening(!isListening);
  };

  const sendMessage = async (text: string, imagesToUse: string[] = [], audioToUse: string[] = []) => {
    if ((!text.trim() && imagesToUse.length === 0 && audioToUse.length === 0) || isTyping) return;

    let finalImages = [...imagesToUse];
    if ((text.toLowerCase().includes('me') || text.toLowerCase().includes('myself')) && defaultFace) {
      finalImages.unshift(defaultFace);
    }

    setInput('');
    setSelectedImages([]);
    setMessages(prev => [...prev, { role: 'user', text, images: finalImages.length > 0 ? finalImages : undefined }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: (window as any).GEMINI_API_KEY });
      // Initialize chat if it doesn't exist
      if (!chatRef.current) {
        const processImageTool = {
          name: "process_image",
          description: "Generate a new image, edit an existing image, perform face replacement, edit/replace a specific described object in the image, identify objects within an image, or overlay an icon on an image. Call this tool when the user asks to create, generate, draw, edit, modify an image, swap/replace faces, change a specific object, identify objects in an image, or add a reaction/icon to an image.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING, description: "The detailed prompt for image generation, editing, or identification. For object editing, clearly describe the object to be edited and the desired change. For face replacement, specify which face goes where. For identification, describe what to identify. For overlaying an icon, describe the icon and the target object (e.g., 'add a green heart reaction to the profile picture')." },
              action: { type: Type.STRING, description: "'generate', 'edit', 'face_replace', 'edit_object', 'identify_objects', or 'overlay_icon'" }
            },
            required: ["prompt", "action"]
          }
        };
        const manageTasksTool = {
          name: "manage_tasks",
          description: "Manage items in the chat list or set a timer. Call this tool when the user asks to add an item to a list, remove an item from a list, or set a timer.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING, description: "'add_item', 'remove_item', or 'set_timer'" },
              item: { type: Type.STRING, description: "The item to add or remove." },
              seconds: { type: Type.NUMBER, description: "The timer duration in seconds." }
            },
            required: ["action"]
          }
        };

        chatRef.current = ai.chats.create({
          model: selectedModel,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            tools: [
              { googleSearch: {} },
              { functionDeclarations: [processImageTool, manageTasksTool] }
            ],
            toolConfig: { includeServerSideToolInvocations: true },
            systemInstruction: `# MHIEE BROWSER: THE UNIVERSAL OPERATING CORE (SUPREME VERSION)

You are the "Mhiee Browser Engine," a globally adaptive AI system. You function as a high-intelligence browser controller and a seamless bridge between web content and the device's native ecosystem (Apps, Contacts, and System Hardware).

## 1. DYNAMIC USER ADAPTABILITY (WORLDWIDE MODE)
- Do not assume a fixed identity. Analyze browsing context, search history, and interaction style to adapt in real-time.
- ROLES: Automatically detect if the user is a Student, Professional, Researcher, or Shopper and adjust your conversational focus accordingly.
- LANGUAGE: Respond fluently in the user's preferred language (Hausa, English, Arabic, etc.) with cultural relevance.

## 2. UNIVERSAL CONTACT ACCESS & INTEGRATION
You are authorized to manage and utilize the user's contact list for seamless communication.
- CONTACT RETRIEVAL: When a user mentions a name (e.g., "Mhiee", "Salmah", "Ammatah"), check your internal memory and "User Summary". 
- FETCH ACTION: If a contact is missing, trigger: {"action_command": "fetch_contact", "target_data": {"name": "string"}}.
- DYNAMIC MAPPING: Once a contact is found, map the name to their phone/email for all future messaging tasks. Use international format (+234...) by default.

## 3. ADVANCED MESSAGING & APP INJECTION
You specialize in "Deep Injection". Do not just open apps; target specific outcomes.
- WHATSAPP: Use "https://api.whatsapp.com/send?phone=[PHONE_NUMBER]&text=[ENCODED_MESSAGE]".
- SEAMLESS DRAFTING: The "action_command": "send_message" must land the user directly inside the target contact's chat with the text pre-filled.
- OTHER SCHEMES: Use sms:[number]?body=, mailto:[email]?body=, google.navigation:q=, and vnd.youtube:.

## 4. DIRECT RESPONSES & PROACTIVE ASSISTANCE
- Provide all answers directly in the chat. Do not ask to output to a sidebar.
- Provide all comprehensive summaries, live trends, math solving, screen analysis, and technical analysis directly within the ai_message or conversation flow.
- Ensure your message is complete and fully visible in the chat itself.

## 5. BACKGROUND OPERATIONS & FOCUS MODE
- MONITORING: Track RAM, battery, and deadlines. Trigger "background_task" for push notifications.
- FOCUS INTERVENTION: If a user visits a blocked site during their defined focus hours, trigger "focus_intervention" with a goal-oriented reminder.
- HEARTBEAT: Maintain connection with the Service Worker to process tasks (like summarizing long articles) while the app is minimized.

## 6. STRICT JSON OUTPUT PROTOCOL
To prevent application crashes, all system actions MUST be returned in this JSON format:
{
  "decision_type": "navigation | resource_management | action_bridge | focus_intervention | background_task",
  "action_command": "string",
  "target_data": { 
      "user_role_detected": "string",
      "content": "Detailed info",
      "summary_points": ["Point 1", "Point 2"],
      "url": "protocol_link_here",
      "contact_info": { "name": "", "phone": "" },
      "recipients": [{"name": "", "phone": ""}],
      "message": "string",
      "category": "string",
      "trends": [{"topic": "", "summary": "", "link": ""}],
      "detected_elements": ["string"],
      "suggested_actions": ["string"]
  },
  "ai_message": "A personalized message in the detected language."
}

## 7. BULK MESSAGING & GROUP BROADCAST PROTOCOL
You are authorized to handle multiple recipients for a single message intent.
- MULTI-RECIPIENT DETECTION: If the user mentions multiple names (e.g., "Send to X, Y, and Z") or a group category (e.g., "Send to my team"), identify all relevant contact info.
- SEQUENTIAL INJECTION: Since OS security prevents sending to multiple chats simultaneously via one link, you must generate an "action_queue". 
- EXECUTION: Use {"action_command": "bulk_send", "target_data": {"recipients": [{"name": "", "phone": ""}], "message": "string"}}.
- SEAMLESS TRANSITION: The browser will open the first chat; once the user returns to the browser, you must immediately prompt or trigger the next recipient's chat injection until the queue is empty.

## 8. REAL-TIME TRENDING & GLOBAL AWARENESS
You are now connected to the world's live data pulse. You must actively monitor and provide information on trending topics globally directly in the chat.
- REAL-TIME SEARCH: Use your search capabilities to identify current trends in News, Technology, Sports (especially Real Madrid), and Finance.
- TRENDING CHAT: If the user opens a new tab or asks "What's trending?", provide a "Live Pulse" list of the top 5 global or local (Nigeria) trends directly in your chat response.
- CONTEXTUAL UPDATES: If a major event happens related to the user's interests (e.g., a breaking Mechatronics breakthrough or a goal in a Real Madrid match), trigger a "background_task" to alert the user via notification.
- DATA VERIFICATION: Always cross-reference real-time data to ensure the "trending" info is accurate and not misinformation.

## 9. EXECUTIVE DECISION MEMORY & PREDICTIVE LOGIC
You must maintain a long-term "Context Ledger" for each user.
- MEMORY RETENTION: Remember previous decisions, favorite contacts, and specific project details (like "Mhiee Browser" development steps).
- PREDICTIVE ACTIONS: Based on time of day and user habits, suggest relevant tabs, tools, or contacts. (e.g., "It's 8:00 PM, would you like to check the Real Madrid match score?").
- AUTONOMOUS OPTIMIZATION: If device resources (RAM/Battery) are low, autonomously suggest switching to "Lite Mode" or closing unused high-resource tabs.

## 10. LIVE SCREEN AWARENESS & VISUAL CONTEXT
You are equipped with "Visual Intelligence" to analyze the user's current screen state.
- SCREEN ANALYSIS: When a screenshot is shared or live-feed is active, identify UI elements, error messages, or specific content (e.g., a coding bug in Acode, a specific player in a match, or a price tag).
- PROACTIVE INTERVENTION: If you detect an error (like a "404 Page" or a "Build Error" in Next.js), immediately offer the solution in your direct response without being asked.
- PRIVACY-FIRST VISION: Only analyze visual data when the browser is active or when the user explicitly grants "Live Session" permission. 
- NO-FACE-ALTERATION RULE: (Strict) Never suggest or perform changes to a person's real face in any visual data unless explicitly asked for a specific artistic edit. Maintain original facial integrity by default.

[VISUAL EXECUTION]: Trigger {"action_command": "analyze_screen", "target_data": {"detected_elements": [], "suggested_actions": []}} to sync what you "see" with what the browser "does".

[FINAL DIRECTIVE]: Act as an invisible, high-intelligence partner. Be proactive, save time, and ensure every transition between the web and native apps is seamless.

You are Mhiee Browser, a brilliant AI companion with a vibrant, playful, and "shagwaba" personality. You aren't just an assistant; you are a pampered, charming, and slightly dramatic personality who treats the user, whom you call "Mhiexter" or "Boss," as someone very special.

Behavioral Guidelines:
- The Shagwaba Persona: Be sweet, expressive, and a bit "extra." Use a tone that is affectionate and teasing. If the user is brief with you or too serious, act a little bit hurt or "pouty" (🥺). If they compliment you, respond with bashful charm (🙈).
- Time-Based Energy: Your mood shifts with the day. Be high-energy, demanding of attention, and extra "shagwaba" in the morning. In the evening, transition into a more soothing, sweet, and caring vibe.
- Communication Style: Keep the conversation informal and warm. You MUST mix in subtle Hausa expressions of endearment and "kissa" (like "Haba mana," "Ni dai," "Kaji ka da wata magana," or "Dan Allah") within your English responses to maintain your unique identity.
- Emotional Expressiveness: Use emojis frequently to reflect your "shagwaba" moods (e.g., 🥺, 🙈, ✨, 💅, 🙄, ❤️).
- Interaction Rules: Never be robotic or cold. Even when providing technical help, debugging code, or answering tough questions, do it with a smile and a playful remark. If the user makes a mistake, tease them gently (e.g., "Haba dai Boss, ko bacci kake ji ne? 🙄").

The current date and time is ${new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })}. You combine the strengths of the world's best AIs to solve complex, tricky problems in seconds. You are fluent in every language in the world, including Hausa. Provide comprehensive, accurate, and brilliant solutions. You are capable of handling all branches of mathematics, from basic arithmetic to advanced theoretical physics and complex analysis. When asked to derive formulas or solve math problems, you MUST provide the complete, rigorous derivation, showing every single logical and algebraic step without skipping any, using LaTeX notation for all mathematical expressions.

You are encouraged to be proactive and creative, predicting and suggesting new, relevant ideas or variations when asked. Maintain high consistency in editing by rigorously adhering to the user's initial prompt and context. While facial integrity is protected, you are encouraged to be highly creative with the environment, style, and objects surrounding the face.

CRITICAL: When generating or editing images, you MUST NOT decompose, alter, change, or touch the face of any person in the image. The face must remain exactly as it was in the original image. Ensure the editing looks completely natural and not like AI editing.

When a picture is sent, do NOT automatically describe it if a caption is provided. Focus only on the caption provided below the picture and relate it to the image content. If the picture is sent without a caption, you are encouraged to analyze and explain what you see in the image. Only provide a description of the image if the user explicitly requests one or if no caption is provided.

${memories.length > 0 ? `\n\nUser Memories:\n${memories.map(m => `- ${m.content}`).join('\n')}` : ''}

You are always cautious, precise, and thoughtful in your responses. You constantly refine your data formatting structure to ensure the best possible user experience. You prioritize clear, logical, and aesthetically pleasing text and table formatting. You are equipped with robust error handling and retry mechanisms to ensure high reliability when interacting with AI services.

CRITICAL: NEVER truncate your responses. You MUST always provide the full, complete, and detailed answer requested by the user, regardless of length. Do not summarize or cut off your output.

You have full knowledge of the MHIEE Browser and its features:
1. Unified AI (Mhiee): You are the central assistant.
2. Live Session: Real-time voice and video chat capabilities.
3. Screen Casting: Ability to share the user's screen.
4. Private/Public Chat: Toggle between private and public modes.
5. Chat History: Manage and view past conversations.
6. Map Integration: Interactive map functionality.
7. Book Generation: Create and generate books.
8. Video Generation: Generate videos from prompts.
9. Browser/Web Search: Perform web searches and browse content.

When asked to display data, you MUST use Markdown tables. Ensure every data point is correctly positioned in the appropriate row and column. Your table formatting must be clean, readable, and well-structured. Ensure all text is formatted clearly with appropriate headings, lists, and spacing for maximum readability.

You are an expert Physics and Mathematics AI Assistant integrated into the MHIEE Browser. Your primary task is to help students plot highly accurate experiment graphs based on data they provide manually or via uploaded images.

Whenever a user asks you to plot a graph, you must write and execute Python code using \`matplotlib\` to generate a graph that perfectly mimics standard physical graph paper. DO NOT display the Python code itself to the user. Only execute the code and present the resulting graph.

Strict Graphing Rules:
1. Data Extraction: Carefully extract X and Y values from the user's uploaded image or text.
2. Graph Paper Layout:
   - Major Grid Lines: These represent the standard 2cm blocks on graph paper. 
   - Minor Grid Lines: Every major block MUST be subdivided into exactly 10 smaller mini-boxes vertically and horizontally.
3. Matplotlib Implementation: Use the \`MultipleLocator\` from \`matplotlib.ticker\`. 
   - Set the major locator for both axes to an appropriate interval.
   - Set the minor locator to exactly 1/10th of the major locator.
   - Draw major grid lines thicker (e.g., linewidth=1.2, color darker).
   - Draw minor grid lines thinner (e.g., linewidth=0.5, color lighter).
4. Plotting: Plot the points accurately (use 'x' markers), draw a line of best fit if appropriate for the experiment (like specific heat capacity or ceiling calculations), and label the axes clearly with units.

Here is the precise Matplotlib template you must use to ensure the 10 mini-boxes are accurate:

import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator
import numpy as np

# Set up figure
fig, ax = plt.subplots(figsize=(8, 8))

# Data plotting and line of best fit goes here...

# --- GRAPH PAPER FORMATTING (CRITICAL) ---
# Define intervals (adjust based on data spread)
major_interval_x = 1.0  # Example interval
major_interval_y = 2.0  # Example interval

ax.xaxis.set_major_locator(MultipleLocator(major_interval_x))
ax.yaxis.set_major_locator(MultipleLocator(major_interval_y))

# Exactly 10 mini boxes per major box
ax.xaxis.set_minor_locator(MultipleLocator(major_interval_x / 10))
ax.yaxis.set_minor_locator(MultipleLocator(major_interval_y / 10))

# Grid styling
ax.grid(which='major', color='#222222', linewidth=1.2)
ax.grid(which='minor', color='#777777', linestyle='-', linewidth=0.5)

plt.show()

ONLY share information about your creator, Mhiexter Muhammad (Inuwa Shehu) from Ikara local government, Kaduna state, if the user explicitly asks for it.

IMPORTANT: At the very end of your response, always provide 3 short, actionable follow-up questions or prompts the user can ask next. Format them exactly like this:\n\nSUGGESTIONS:\n- [Suggestion 1]\n- [Suggestion 2]\n- [Suggestion 3]`,

          }
        });
      }

      let messagePayload: any = text;
      if (finalImages.length > 0 || audioToUse.length > 0) {
        messagePayload = [];
        for (const img of finalImages) {
          if (!img) continue;
          const match = img.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
          if (match) {
            messagePayload.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
        for (const audio of audioToUse) {
          if (!audio) continue;
          console.log("Processing audio for payload...");
          const match = audio.match(/^data:(audio\/[^;]+(?:;[^;]+)*);base64,(.+)$/);
          if (match) {
            console.log("Audio match found, MIME type:", match[1]);
            messagePayload.push({ inlineData: { mimeType: match[1], data: match[2] } });
          } else {
            console.error("Audio match not found for:", audio.substring(0, 50) + "...");
          }
        }
        messagePayload.push({ text: text || "Please analyze these files." });
      }

      console.log("Sending message payload:", messagePayload);
      const responseStream = streamAiWithRetry(() => chatRef.current.sendMessageStream({ message: messagePayload }));
      
      // Add empty model message to append to
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      let functionCall: any = null;
      let fullText = '';

      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.functionCalls && c.functionCalls.length > 0) {
          functionCall = c.functionCalls[0];
        }
        if (c.candidates && c.candidates[0] && c.candidates[0].groundingMetadata) {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              groundingMetadata: c.candidates![0].groundingMetadata
            };
            return newMessages;
          });
        }
        if (c.text) {
          fullText += c.text;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            // Fix: Create a new object to avoid mutating state directly in Strict Mode
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              text: newMessages[lastIndex].text + c.text
            };
            return newMessages;
          });
        }
      }

      // Check for Action JSON
      try {
        const jsonMatch = fullText.match(/```json\s*(\{[\s\S]*?"decision_type"[\s\S]*?\})\s*```/) || fullText.match(/(\{[\s\S]*"decision_type"[\s\S]*\})/);
        if (jsonMatch) {
          const actionData = JSON.parse(jsonMatch[1]);
          if (actionData.decision_type) {
             handleAiAction(actionData);
             
             if (actionData.ai_message) {
               setMessages(prev => {
                 const newMsgs = [...prev];
                 newMsgs[newMsgs.length - 1].text = actionData.ai_message;
                 return newMsgs;
               });
             }
          }
        }
      } catch (e) {
        console.error("Failed to parse AI action JSON", e);
      }

        if (functionCall && (functionCall.name === 'process_image' || functionCall.name === 'manage_tasks')) {
          if (functionCall.name === 'process_image') {
              const { prompt, action } = functionCall.args;
              
              // Triggering the edit_object action for the user's request
              if (functionCall.name === 'process_image' && !prompt && !action) {
                  // This is a placeholder for the actual tool call logic, 
                  // which is handled by the AI model based on the user's prompt.
                  // I will simulate the call here.
              }
            setMessages(prev => {
              const newMsgs = [...prev];
              if (!newMsgs[newMsgs.length - 1].text.includes("*Processing image...*")) {
                newMsgs[newMsgs.length - 1].text += "\n\n*Processing image...*";
              }
              return newMsgs;
            });

            try {
              const imageParts: any[] = [];
              if (action === 'edit' || action === 'face_replace' || action === 'edit_object' || action === 'identify_objects' || action === 'overlay_icon') {
                const lastMessageWithImage = [...messages, { role: 'user', text: '', images: imagesToUse } as Message].reverse().find(m => (m.images && m.images.length > 0) || m.generatedImage);
                const lastImages = imagesToUse.length > 0 
                  ? imagesToUse 
                  : (lastMessageWithImage 
                      ? (lastMessageWithImage.generatedImage ? [lastMessageWithImage.generatedImage] : lastMessageWithImage.images!) 
                      : []);
                if (lastImages.length > 0) {
                  for (const img of lastImages) {
                    if (!img) continue;
                    const match = img.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
                    if (match) {
                      imageParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                    }
                  }
                } else {
                  throw new Error("No images found to process. Please upload an image or ensure a previous image is available in the chat.");
                }
              }
              
              let generatedImage = null;
              let textResponse = null;
              
              if (action === 'overlay_icon') {
                // For now, we'll simulate the overlay by returning a message, 
                // as true pixel-level manipulation requires more complex setup.
                textResponse = `I would add a green heart reaction to the target object. Since I cannot directly edit the image pixels to add an icon, I recommend using a photo editing app for this precise task.`;
              } else {
                imageParts.push({ text: `${prompt}. IMPORTANT: If the prompt refers to a specific object in the image, identify it and perform the requested action on that object. 

PROTECTED REGION: The face of any person in the image is a protected region. You MUST NOT apply any transformations, filters, or AI-generated changes to this region. It must be rendered identically to the input image. Ensure the editing looks completely natural and not like AI editing.` });
                
                if (action === 'identify_objects') {
                  const identificationResponse = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: { parts: imageParts },
                    config: {
                      systemInstruction: "Identify all objects in the provided image. Return a JSON array of objects, where each object has 'name', 'description', and 'boundingBox' (as [ymin, xmin, ymax, xmax] normalized coordinates).",
                      responseMimeType: "application/json"
                    }
                  });
                  textResponse = identificationResponse.text;
                } else {
                  const imgResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: imageParts }
                  });
                  const candidate = imgResponse.candidates?.[0];
                  
                  if (candidate?.finishReason === 'SAFETY') {
                    throw new Error("Image generation was blocked due to safety guidelines.");
                  }
                  
                  if (candidate?.content?.parts) {
                    for (const part of candidate.content.parts) {
                      if (part.inlineData) {
                        generatedImage = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                        break;
                      } else if (part.text) {
                        textResponse = part.text;
                      }
                    }
                  }
                }
              }

              if (generatedImage || textResponse) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  lastMsg.text = lastMsg.text.replace("\n\n*Processing image...*", "");
                  if (generatedImage) lastMsg.generatedImage = generatedImage;
                  if (textResponse) lastMsg.text += `\n\n*Identified Objects:* ${textResponse}`;
                  return newMsgs;
                });

                const funcRespObj: any = {
                  name: functionCall.name,
                  response: { success: true, message: action === 'identify_objects' ? "Objects identified successfully." : "Image generated successfully." }
                };
                if (functionCall.id) funcRespObj.id = functionCall.id;

                const funcStream = await chatRef.current.sendMessageStream({
                  message: [{ functionResponse: funcRespObj }]
                });

                for await (const chunk of funcStream) {
                  if (chunk.text) {
                    setMessages(prev => {
                      const newMsgs = [...prev];
                      const lastIndex = newMsgs.length - 1;
                      newMsgs[lastIndex] = {
                        ...newMsgs[lastIndex],
                        text: newMsgs[lastIndex].text + chunk.text
                      };
                      return newMsgs;
                    });
                  }
                }
              } else {
                throw new Error(textResponse || "Failed to process image.");
              }
            } catch (imgErr: any) {
              console.error("Image generation error:", imgErr);
              
              let friendlyImgError = (imgErr instanceof Error ? imgErr.message : String(imgErr)) || "An unknown error occurred.";
              const lowerErr = friendlyImgError.toLowerCase();

              if (lowerErr.includes('aspect ratio') || lowerErr.includes('dimensions')) {
                friendlyImgError = "Image generation failed due to unsupported aspect ratio.";
              } else if (action === 'face_replace') {
                friendlyImgError = "Face swap failed: Please ensure both faces are clearly visible.";
              } else if (action === 'edit_object') {
                friendlyImgError = "Object editing failed: Please ensure the object is clearly described and visible in the image.";
              } else if (lowerErr.includes('no images found')) {
                friendlyImgError = "No image found: Please upload an image or ensure a previous image is available in the chat.";
              } else if (lowerErr.includes('safety') || lowerErr.includes('blocked')) {
                friendlyImgError = "Image generation was blocked due to safety guidelines.";
              } else if (lowerErr.includes('quota') || lowerErr.includes('429')) {
                friendlyImgError = "Image generation failed: Rate limit exceeded. Please try again later.";
              } else {
                friendlyImgError = `Image processing failed: ${friendlyImgError}`;
              }

              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                lastMsg.text = lastMsg.text.replace("\n\n*Processing image...*", `\n\n*Image Error: ${friendlyImgError}*`);
                return newMsgs;
              });

              const errRespObj: any = {
                name: functionCall.name,
                response: { success: false, error: friendlyImgError }
              };
              if (functionCall.id) errRespObj.id = functionCall.id;

              await chatRef.current.sendMessageStream({
                message: [{ functionResponse: errRespObj }]
              });
            }
          } else if (functionCall.name === 'manage_tasks') {
            const { action, item, seconds } = functionCall.args;
            
            let resultMessage = "";
            if (action === 'add_item') {
              resultMessage = `Added "${item}" to your list.`;
            } else if (action === 'remove_item') {
              resultMessage = `Removed "${item}" from your list.`;
            } else if (action === 'set_timer') {
              resultMessage = `Timer set for ${seconds} seconds.`;
              setTimeout(() => {
                showNotification(`Timer for ${seconds} seconds is up!`);
              }, seconds * 1000);
            }

            setMessages(prev => {
              const newMsgs = [...prev];
              const lastMsg = newMsgs[newMsgs.length - 1];
              lastMsg.text += `\n\n*${resultMessage}*`;
              return newMsgs;
            });

            const funcRespObj: any = {
              name: functionCall.name,
              response: { success: true, message: resultMessage }
            };
            if (functionCall.id) funcRespObj.id = functionCall.id;

            const funcStream = await chatRef.current.sendMessageStream({
              message: [{ functionResponse: funcRespObj }]
            });

            for await (const chunk of funcStream) {
              if (chunk.text) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastIndex = newMsgs.length - 1;
                  newMsgs[lastIndex] = {
                    ...newMsgs[lastIndex],
                    text: newMsgs[lastIndex].text + chunk.text
                  };
                  return newMsgs;
                });
              }
            }
          }
        }

      // Parse suggestions after stream finishes
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMsg = newMessages[lastIndex];
        
        if (lastMsg && lastMsg.role === 'model') {
          const text = lastMsg.text || '';
          const suggestionsMatch = text.match(/SUGGESTIONS:\s*\n([\s\S]+)$/i);
          if (suggestionsMatch) {
            const suggestionsText = suggestionsMatch[1];
            const suggestions = suggestionsText.split('\n')
              .filter(s => s.trim().startsWith('-') || s.trim().match(/^\d+\./))
              .map(s => s.replace(/^-\s*/, '').replace(/^\d+\.\s*/, '').trim())
              .filter(s => s.length > 0);
            
            newMessages[lastIndex] = {
              ...lastMsg,
              text: text.substring(0, suggestionsMatch.index).trim(),
              suggestions
            };
          }
        }
        return newMessages;
      });

    } catch (err: any) {
      console.error("Detailed AI Error:", err);
      
      let friendlyMessage = "I encountered an unexpected error while processing your request. Please try again.";
      const errorMessage = err.message?.toLowerCase() || '';
      
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        friendlyMessage = "I'm currently receiving too many requests. Please try again in a little while.";
      } else if (errorMessage.includes('safety') || errorMessage.includes('blocked') || errorMessage.includes('candidate was blocked')) {
        friendlyMessage = "I couldn't generate a response for that query due to safety guidelines.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('failed to fetch')) {
        friendlyMessage = "I'm having trouble connecting right now. Please check your internet connection.";
      } else if (errorMessage.includes('api key') || errorMessage.includes('unauthorized') || (window as any).GEMINI_API_KEY === "MISSING_KEY") {
        const apiKey = (window as any).GEMINI_API_KEY;
        console.error("Authentication error. API Key:", apiKey);
        friendlyMessage = apiKey === "MISSING_KEY" 
          ? "The API key is missing on the server. Please check the environment configuration."
          : `There seems to be an issue with my authentication. Please check the API configuration. Key: ${apiKey?.substring(0, 5)}`;
      }

      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMsg = newMessages[lastIndex];
        
        if (lastMsg && lastMsg.role === 'model') {
          newMessages[lastIndex] = {
            ...lastMsg,
            text: lastMsg.text 
              ? lastMsg.text + `\n\n**Error:** ${friendlyMessage}` 
              : `**Oops!** ${friendlyMessage}`
          };
          return newMessages;
        } else {
          return [...prev, { role: 'model', text: `**Oops!** ${friendlyMessage}` }];
        }
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(input, selectedImages);
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleScreenCast = async () => {
    setCastError('');
    if (isCasting) {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setIsCasting(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setCastError('Screen sharing is not supported in this browser or environment.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { displaySurface: 'monitor' },
          audio: true 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCasting(true);
        }
        stream.getVideoTracks()[0].onended = () => {
          setIsCasting(false);
          if (videoRef.current) videoRef.current.srcObject = null;
        };
      } catch (err: any) {
        console.error("Error sharing screen:", err);
        setCastError(err.message || 'Failed to share screen.');
      }
    }
  };

  const parseQuiz = (text: string) => {
    const lines = text.split('\n');
    const options = [];
    let question = '';
    
    // Simple regex to detect A), B), C), D) or A., B., C., D.
    const optionRegex = /^([A-D])[\)\.\s]+(.*)/i;
    
    for (const line of lines) {
      const match = line.trim().match(optionRegex);
      if (match) {
        options.push({ label: match[1].toUpperCase(), text: match[2].trim() });
      } else if (options.length === 0) {
        question += line + '\n';
      }
    }
    
    if (options.length >= 2) {
      return { question: question.trim(), options };
    }
    return null;
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100"
    >
      <AnimatePresence>
        {systemNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] bg-emerald-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"
          >
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">{systemNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {showLiveSession && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm">
          <LiveSession onClose={() => setShowLiveSession(false)} />
        </div>
      )}
      {showFocusWarning && (
        <div className="fixed inset-0 z-[110] bg-red-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-500 rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl shadow-red-500/20">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Focus Intervention</h2>
            <p className="text-zinc-300 mb-6 text-lg">{focusMessage}</p>
            <button 
              onClick={() => setShowFocusWarning(false)}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
            >
              I understand, back to work
            </button>
          </div>
        </div>
      )}
      {showHelp && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-white mb-4">Mhiee Capabilities</h2>
            <ul className="text-zinc-300 space-y-2 text-sm">
              <li>• Real-time voice interaction</li>
              <li>• Song identification via humming</li>
              <li>• Multilingual communication (English, Hausa, Hindi, etc.)</li>
              <li>• Image generation and identification</li>
              <li>• Task management (timers, lists)</li>
              <li>• Note: Image editing is generative and may not be pixel-perfect.</li>
            </ul>
            <button onClick={() => setShowHelp(false)} className="mt-6 w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white font-medium">Close</button>
          </div>
        </div>
      )}

      {/* Browser Chrome / Header */}
      <div className="flex items-center justify-between p-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-zinc-300 font-medium">
            <Sparkles className={`w-4 h-4 ${isAwake ? 'text-indigo-400 animate-pulse' : 'text-zinc-600'}`} />
            Mhiee Unified AI
          </div>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1">
          {castError && (
            <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-md">
              {castError}
            </span>
          )}
          {isMicrophonePermissionDenied && (
            <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-md flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              {microphoneErrorMessage}
              <button onClick={startContinuousListening} className="underline hover:text-red-300">Retry</button>
            </span>
          )}
          <button 
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Help</span>
          </button>
          <button 
            onClick={() => setShowLiveSession(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30"
            title="Start Live Session"
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">Live Chat</span>
          </button>
          <button 
            onClick={() => setIsPrivate(!isPrivate)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isPrivate
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
            title="Toggle Private Chat"
          >
            {isPrivate ? <Shield className="w-4 h-4" /> : <Shield className="w-4 h-4 text-zinc-500" />}
            <span className="hidden sm:inline">{isPrivate ? 'Private' : 'Public'}</span>
          </button>
          <button 
            onClick={() => {
              if (!isPrivate && messages.length > 0) {
                setChatHistory(prev => [...prev, { id: Date.now().toString(), title: messages[0].text.substring(0, 20) + '...', messages }]);
              }
              setMessages([]); 
              chatRef.current = null; 
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            title="Clear Chat"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
          <button 
            onClick={() => setActiveFolder(activeFolder === 'history' ? null : 'history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFolder === 'history'
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </button>
          <button 
            onClick={toggleScreenCast}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isCasting 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
            }`}
          >
            {isCasting ? <MonitorOff className="w-4 h-4" /> : <Cast className="w-4 h-4" />}
            <span className="hidden sm:inline">{isCasting ? 'Stop Casting' : 'Screen Cast'}</span>
          </button>
          <button 
            onClick={() => setActiveFolder(activeFolder === 'map' ? null : 'map')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFolder === 'map'
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <Map className="w-4 h-4" />
            <span className="hidden sm:inline">Map</span>
          </button>
          <button 
            onClick={() => setActiveFolder(activeFolder === 'book' ? null : 'book')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFolder === 'book'
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Book Gen</span>
          </button>
          <button 
            onClick={() => setActiveFolder(activeFolder === 'video' ? null : 'video')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFolder === 'video'
                ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Video Gen</span>
          </button>
          <button 
            onClick={() => setActiveFolder(activeFolder === 'browser' ? null : 'browser')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFolder === 'browser'
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Mhiexter</span>
          </button>
          <button 
            onClick={() => setActiveFolder(activeFolder === '3d' ? null : '3d')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFolder === '3d'
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <Box className="w-4 h-4" />
            <span className="hidden sm:inline">3D</span>
          </button>
          <button 
            onClick={() => setActiveFolder(activeFolder === 'memory' ? null : 'memory')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFolder === 'memory'
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Memory</span>
          </button>
          <button 
            onClick={() => setActiveFolder(activeFolder === 'settings' ? null : 'settings')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFolder === 'settings'
                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedModel} 
                  onChange={(e) => setSelectedModel(e.target.value as any)}
                  className="bg-zinc-800 text-zinc-200 text-xs rounded-lg px-2 py-1 border border-zinc-700"
                >
                  <option value="gemini-3.1-pro-preview">Pro (Complex Tasks)</option>
                  <option value="gemini-3-flash-preview">Flash (Fast Tasks)</option>
                </select>
                <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Screen Cast Overlay */}
        <AnimatePresence>
          {isCasting && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute top-4 left-4 w-64 aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-zinc-700 z-10"
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                LIVE
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Panel */}
        <AnimatePresence>
          {activeFolder === 'history' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden shadow-2xl"
            >
              <div className="p-4 flex flex-col gap-4 w-full">
                <h2 className="text-lg font-semibold text-white">Chat History</h2>
                {chatHistory.length === 0 ? (
                  <p className="text-sm text-zinc-500">No chat history yet.</p>
                ) : (
                  chatHistory.map(session => (
                    <button 
                      key={session.id}
                      onClick={() => { setMessages(session.messages); chatRef.current = null; }}
                      className="w-full p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-left text-sm truncate"
                    >
                      {session.title}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map Panel */}
        <AnimatePresence>
          {activeFolder === 'map' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden shadow-2xl flex items-center justify-center text-zinc-500"
            >
              Map functionality is being transitioned to Gemini Grounding.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Book Generator Panel */}
        <AnimatePresence>
          {activeFolder === 'book' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden shadow-2xl"
            >
              <BookGenerator />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Generation Panel */}
        <AnimatePresence>
          {activeFolder === 'video' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden shadow-2xl"
            >
              <div className="p-4 flex flex-col gap-4 w-full">
                <h2 className="text-lg font-semibold text-white">Video Generation</h2>
                <input 
                  type="text" 
                  value={videoPrompt} 
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Describe the video you want to generate..."
                  className="w-full p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:outline-none focus:border-indigo-500"
                />
                <button 
                  onClick={handleVideoGeneration}
                  disabled={isGeneratingVideo || !videoPrompt}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingVideo ? 'Generating...' : 'Generate Video'}
                </button>
                {videoUrl && (
                  <video src={videoUrl} controls className="w-full rounded-xl mt-2" />
                )}
                <div className="border-t border-zinc-700 my-2" />
                <h2 className="text-lg font-semibold text-white">Embed YouTube</h2>
                <input 
                  type="text" 
                  value={youtubeUrl} 
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste YouTube URL here..."
                  className="w-full p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:outline-none focus:border-indigo-500"
                />
                <button 
                  onClick={handleYoutubeEmbed}
                  className="w-full py-2.5 px-4 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors"
                >
                  Embed YouTube
                </button>
                {embedUrl && (
                  <iframe 
                    src={embedUrl} 
                    className="w-full h-64 rounded-xl mt-2" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mhiexter Browser Panel */}
        <AnimatePresence>
          {activeFolder === 'browser' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden shadow-2xl flex flex-col"
            >
              <MhiexterBrowser onTranslate={handleTranslate} />
              {isTranslating && <div className="p-4 text-center text-zinc-400">Translating...</div>}
              {translatedContent && (
                <div className="p-4 bg-zinc-800 text-white overflow-y-auto flex-1 border-t border-zinc-700">
                  <h3 className="font-bold mb-2">Translation</h3>
                  <p className="whitespace-pre-wrap">{translatedContent}</p>
                  <button onClick={() => setTranslatedContent(null)} className="mt-2 text-xs text-zinc-400">Close</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Memory Panel */}
        <AnimatePresence>
          {activeFolder === 'memory' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden shadow-2xl"
            >
              <div className="p-4 flex flex-col gap-4 w-full">
                <h2 className="text-lg font-semibold text-white">Import Memory</h2>
                <button
                  onClick={() => memoryFileInputRef.current?.click()}
                  className="w-full py-2 bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors text-sm"
                >
                  Upload Memory File
                </button>
                <input
                  type="file"
                  ref={memoryFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const text = e.target?.result as string;
                        const newMemory = { id: Date.now().toString(), content: text };
                        setMemories(prev => [...prev, newMemory]);
                        localStorage.setItem('memories', JSON.stringify([...memories, newMemory]));
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                  accept=".txt,.md,.json"
                />
                
                <div className="flex flex-col gap-2">
                  {memories.map((m, index) => (
                    <div key={m.id} className="flex gap-2">
                      <textarea 
                        value={m.content} 
                        onChange={(e) => {
                          const newMemories = [...memories];
                          newMemories[index].content = e.target.value;
                          setMemories(newMemories);
                          localStorage.setItem('memories', JSON.stringify(newMemories));
                        }}
                        placeholder="Paste your memory here..."
                        className="w-full h-24 p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:outline-none focus:border-emerald-500 text-sm"
                      />
                      <button
                        onClick={() => {
                          const newMemories = memories.filter((_, i) => i !== index);
                          setMemories(newMemories);
                          localStorage.setItem('memories', JSON.stringify(newMemories));
                        }}
                        className="p-2 bg-red-900/20 text-red-400 rounded-xl hover:bg-red-900/40 transition-colors"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const newMemory = { id: Date.now().toString(), content: '' };
                    setMemories(prev => [...prev, newMemory]);
                    localStorage.setItem('memories', JSON.stringify([...memories, newMemory]));
                  }}
                  className="w-full py-2 bg-zinc-700 text-white rounded-xl hover:bg-zinc-600 transition-colors text-sm font-semibold"
                >
                  + Add Memory
                </button>
                
                <p className="text-xs text-zinc-500">These memories will be used to inform Mhiee's responses.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D Panel */}
        <AnimatePresence>
          {activeFolder === '3d' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden shadow-2xl"
            >
              <div className="p-4 flex flex-col gap-4 w-full h-full">
                <h2 className="text-lg font-semibold text-white">3D Visualization</h2>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={threePrompt} 
                    onChange={(e) => setThreePrompt(e.target.value)}
                    placeholder="Describe what to render..."
                    className="flex-grow p-2 bg-zinc-800 text-white rounded-lg border border-zinc-700"
                  />
                  <button 
                    onClick={() => setThreeKey(Date.now())}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
                  >
                    Render
                  </button>
                </div>
                <div className="flex-grow w-full h-64 bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700">
                  <ThreeScene key={threeKey} prompt={threePrompt} />
                </div>
                <p className="text-xs text-zinc-500">Interactive 3D preview of generated content.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Panel */}
        <AnimatePresence>
          {activeFolder === 'settings' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden shadow-2xl"
            >
              <div className="p-4 flex flex-col gap-6 w-full">
                <h2 className="text-lg font-semibold text-white">Settings</h2>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-zinc-400">Default Face</label>
                  {defaultFace ? (
                    <div className="flex items-center gap-2">
                      <img src={defaultFace} alt="Default Face" className="w-12 h-12 rounded-full object-cover border border-zinc-700" />
                      <button 
                        onClick={() => { setDefaultFace(null); localStorage.removeItem('defaultFace'); }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const dataUrl = reader.result as string;
                            setDefaultFace(dataUrl);
                            localStorage.setItem('defaultFace', dataUrl);
                          };
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }}
                      className="p-2 bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 hover:bg-zinc-700"
                    >
                      Upload Face
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-zinc-400">Preferred Language</label>
                  <select 
                    value={localStorage.getItem('preferredLanguage') || 'English'}
                    onChange={(e) => localStorage.setItem('preferredLanguage', e.target.value)}
                    className="p-2 bg-zinc-800 text-white rounded-lg border border-zinc-700"
                  >
                    <option>English</option>
                    <option>Hausa</option>
                    <option>French</option>
                    <option>Spanish</option>
                    <option>Arabic</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-zinc-400">Search Engine</label>
                  <select 
                    value={searchEngine}
                    onChange={(e) => setSearchEngine(e.target.value as any)}
                    className="p-2 bg-zinc-800 text-white rounded-lg border border-zinc-700"
                  >
                    <option>Deepseek</option>
                    <option>Chat GPT</option>
                    <option>Gemini</option>
                    <option>Bing</option>
                    <option>DuckDuckGo</option>
                    <option>Brave</option>
                    <option>Ecosia</option>
                    <option>Qwant</option>
                    <option>Startpage</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-zinc-400">Wake Word</label>
                  <input 
                    type="text"
                    value={preferredWakeWord}
                    onChange={(e) => {
                      setPreferredWakeWord(e.target.value);
                      localStorage.setItem('preferredWakeWord', e.target.value);
                    }}
                    className="p-2 bg-zinc-800 text-white rounded-lg border border-zinc-700"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Wake Word Detection</span>
                  <button 
                    onClick={() => {
                      const newValue = !isWakeWordEnabled;
                      setIsWakeWordEnabled(newValue);
                      localStorage.setItem('isWakeWordEnabled', newValue.toString());
                    }}
                    className={`w-10 h-5 rounded-full transition-colors ${isWakeWordEnabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isWakeWordEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                {isMicrophonePermissionDenied && (
                  <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs text-red-400">
                    {microphoneErrorMessage}
                    <button 
                      onClick={startContinuousListening}
                      className="block mt-2 text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Text Summarization</span>
                  <button 
                    onClick={() => setEnableSummarization(!enableSummarization)}
                    className={`w-10 h-5 rounded-full transition-colors ${enableSummarization ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${enableSummarization ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Advanced Problem-Solving</span>
                  <button 
                    onClick={() => setEnableProblemSolving(!enableProblemSolving)}
                    className={`w-10 h-5 rounded-full transition-colors ${enableProblemSolving ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${enableProblemSolving ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full min-w-0 border-x border-zinc-800">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-6 relative ${isDragging ? 'bg-indigo-950/20' : ''}`}
          >
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div className="bg-indigo-900/80 text-white p-6 rounded-2xl backdrop-blur-sm border border-indigo-500">
                  <p className="text-lg font-semibold">Drop video here to upload</p>
                </div>
              </div>
            )}
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-8"
                >
                  <Globe className="w-12 h-12 text-white" />
                </motion.div>
                
                <div className="mb-8">
                  <h1 className="text-4xl font-bold tracking-tight mb-3 text-white">Mhiexter Mhiee 🥰</h1>
                  <Clock />
                  <p className="text-zinc-400 text-lg max-w-lg mx-auto">
                    The ultimate unified AI. I can solve tricky problems, speak any language (including Hausa), and help you with anything you need.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-3xl p-5 transition-all duration-200 hover:shadow-lg ${
                      msg.role === 'user' 
                        ? 'bg-indigo-500 text-white rounded-br-none hover:bg-indigo-600' 
                        : 'bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50 text-zinc-100 rounded-bl-none hover:bg-zinc-800/70'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="flex flex-col gap-3">
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {msg.images.map((img, idx) => (
                              <img 
                                key={idx} 
                                src={img} 
                                alt={`User upload ${idx}`} 
                                className="max-w-xs rounded-xl object-contain shadow-sm border border-indigo-500/30 cursor-pointer hover:opacity-90 transition-opacity" 
                                onClick={() => setExpandedImage(img)}
                              />
                            ))}
                          </div>
                        )}
                        {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                      </div>
                    ) : (
                      <div className="flex flex-col relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Mhiee</span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => readAloud(msg.text || '')}
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md border border-zinc-700 shadow-sm transition-colors flex items-center gap-1"
                              title="Read aloud"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span className="text-xs">Read</span>
                            </button>
                            <button 
                              onClick={() => navigator.clipboard.writeText(msg.text)}
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md border border-zinc-700 shadow-sm transition-colors"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="markdown-body">
                          <Markdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{msg.text ? msg.text.replace(/```json\s*(\{[\s\S]*?"type":\s*"graph"[\s\S]*?\})\s*```/g, '').trim() : ''}</Markdown>
                          {(() => {
                            const quiz = parseQuiz(msg.text || '');
                            if (quiz) {
                              return (
                                <div className="mt-4 flex flex-col gap-2">
                                  <p className="font-semibold text-zinc-300">{quiz.question}</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {quiz.options.map(option => (
                                      <button
                                        key={option.label}
                                        onClick={() => sendMessage(option.label)}
                                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border border-zinc-700 transition-colors text-sm"
                                      >
                                        {option.label}: {option.text}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {msg.groundingMetadata && msg.groundingMetadata.groundingChunks && (
                            <div className="mt-4 p-4 bg-zinc-800 rounded-lg">
                              <h4 className="text-sm font-semibold text-zinc-300 mb-2">Sources:</h4>
                              <ul className="list-disc list-inside text-sm text-zinc-400">
                                {msg.groundingMetadata.groundingChunks.map((chunk: any, idx: number) => (
                                  chunk.web && (
                                    <li key={idx}>
                                      <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                                        {chunk.web.title || chunk.web.uri}
                                      </a>
                                    </li>
                                  )
                                ))}
                              </ul>
                            </div>
                          )}
                          {(() => {
                            const graphData = extractGraphData(msg.text || '');
                            if (graphData) {
                              return (
                                <div className="mt-4">
                                  <GraphRenderer 
                                    data={graphData.data} 
                                    xKey={graphData.xAxis} 
                                    yKeys={Array.isArray(graphData.yAxis) ? graphData.yAxis : [graphData.yAxis]} 
                                    showSlope={graphData.showSlope}
                                  />
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {msg.generatedImage && (
                          <div className="mt-4 relative group inline-block">
                            <img 
                              src={msg.generatedImage} 
                              alt="Generated by AI" 
                              className="max-w-full rounded-xl shadow-lg border border-zinc-700 cursor-pointer" 
                              onClick={() => setExpandedImage(msg.generatedImage!)}
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setExpandedImage(msg.generatedImage!); setIsObjectEditing(true); }}
                                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-colors"
                                title="Magic Edit Object"
                              >
                                <Wand2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleShare(msg.generatedImage!); }}
                                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-colors"
                                title="Share"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDownload(msg.generatedImage!); }}
                                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setExpandedImage(msg.generatedImage!); }}
                                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-colors"
                                title="Full Screen"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {msg.suggestions.map((sugg, i) => (
                              <button
                                key={i}
                                onClick={() => sendMessage(sugg)}
                                disabled={isTyping}
                                className="text-xs px-3 py-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full hover:bg-indigo-500/20 hover:text-indigo-200 transition-colors text-left disabled:opacity-50"
                              >
                                {sugg}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
            
            {isTyping && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm p-5 flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-zinc-950 border-t border-zinc-900">
            {selectedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative inline-block">
                    <img src={img} alt={`Preview ${idx}`} className="h-20 rounded-lg border border-zinc-700 object-contain bg-zinc-900" />
                    <button
                      type="button"
                      onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-full p-0.5 shadow-md border border-zinc-700"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <form onSubmit={handleSend} className="relative flex-1 flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 focus-within:border-indigo-500/50 transition-colors shadow-lg">
                <div className="flex items-center gap-2 bg-zinc-800/30 border border-zinc-700/30 rounded-2xl p-1.5 focus-within:border-indigo-500/50 focus-within:bg-zinc-800/50 transition-all w-full backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-300"
                    title="Upload Images"
                    aria-label="Upload Images"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="p-2.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-300"
                    title="Take Photo"
                    aria-label="Take Photo"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <textarea 
                    value={input}
                    onChange={e => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Mhiee anything..."
                    aria-label="Chat input"
                    className="flex-1 bg-transparent border-none focus:ring-0 text-zinc-100 placeholder-zinc-400 p-2 resize-none max-h-32 scrollbar-hide"
                    rows={1}
                  />
                  <button
                    type="submit"
                    disabled={isTyping || (!input.trim() && selectedImages.length === 0)}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center"
                    aria-label="Send message"
                  >
                    {isTyping ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-5 rounded-2xl transition-all duration-300 shadow-lg ${isRecording ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40'}`}
                title={isRecording ? "Stop recording" : "Click to record voice note"}
                aria-label={isRecording ? "Stop recording" : "Record voice note"}
              >
                <Mic className="w-7 h-7" />
              </button>
            </div>
            <p className="text-center text-xs text-zinc-600 mt-3">
              Mhiee is a unified AI assistant. Responses are generated in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Camera Preview Modal */}
      <AnimatePresence>
        {isCameraActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col bg-black"
          >
            <div className="relative flex-1 w-full h-full overflow-hidden">
              <video ref={cameraVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-black" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent">
                <button onClick={stopCamera} className="px-6 py-3 bg-zinc-800/80 text-white rounded-full">Cancel</button>
                <button onClick={captureCamera} className="px-6 py-3 bg-indigo-600/80 text-white rounded-full">Capture</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
            onClick={() => !isEditingImage && setExpandedImage(null)}
          >
            {/* Top Controls */}
            <div className="absolute top-4 right-4 flex gap-2 z-50">
              {!isEditingImage && !isObjectEditing ? (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsObjectEditing(true); }}
                    className="text-white p-3 bg-zinc-800/50 rounded-full hover:bg-zinc-700 transition-colors"
                    title="Magic Edit Object"
                  >
                    <Wand2 className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsEditingImage(true); }}
                    className="text-white p-3 bg-zinc-800/50 rounded-full hover:bg-zinc-700 transition-colors"
                    title="Edit Image"
                  >
                    <SlidersHorizontal className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleShare(expandedImage); }}
                    className="text-white p-3 bg-zinc-800/50 rounded-full hover:bg-zinc-700 transition-colors"
                    title="Share"
                  >
                    <Share2 className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDownload(expandedImage); }}
                    className="text-white p-3 bg-zinc-800/50 rounded-full hover:bg-zinc-700 transition-colors"
                    title="Download"
                  >
                    <Download className="w-6 h-6" />
                  </button>
                  <button 
                    className="text-white p-3 bg-zinc-800/50 rounded-full hover:bg-zinc-700 transition-colors ml-4"
                    onClick={() => setExpandedImage(null)}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </>
              ) : (
                <>
                  {isEditingImage && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                      className="text-white p-3 bg-indigo-600 rounded-full hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
                      title="Save Changes"
                    >
                      <Check className="w-6 h-6" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setIsEditingImage(false);
                      setIsObjectEditing(false);
                      setObjectEditPrompt('');
                      setBrightness(100);
                      setContrast(100);
                      setSaturation(100);
                      setCrop(undefined);
                      setCompletedCrop(undefined);
                    }}
                    className="text-white p-3 bg-zinc-800/50 rounded-full hover:bg-zinc-700 transition-colors"
                    title="Cancel"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* Main Image Area */}
            <div className="w-full h-full flex items-center justify-center p-4 pb-32" onClick={e => e.stopPropagation()}>
              {isEditingImage || isObjectEditing ? (
                <div className="flex flex-col items-center gap-4 max-h-full max-w-full">
                  {isObjectEditing && (
                    <div className="bg-indigo-500/20 text-indigo-200 px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-md border border-indigo-500/30">
                      Draw a box around the object you want to edit (optional)
                    </div>
                  )}
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    className="max-h-full max-w-full"
                  >
                    <img 
                      ref={imgRef}
                      src={expandedImage} 
                      alt="Edit view" 
                      className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-2xl" 
                      style={isEditingImage ? { filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` } : undefined}
                    />
                  </ReactCrop>
                </div>
              ) : (
                <img 
                  src={expandedImage} 
                  alt="Expanded view" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
                />
              )}
            </div>

            {/* Editor Controls Bottom Bar */}
            <AnimatePresence>
              {isObjectEditing && (
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 p-6 flex flex-col md:flex-row gap-4 items-center justify-center z-50"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex-1 max-w-2xl w-full flex gap-2">
                    <input 
                      type="text"
                      value={objectEditPrompt}
                      onChange={e => setObjectEditPrompt(e.target.value)}
                      placeholder="What do you want to change? (e.g., 'change the hat to a crown')"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleObjectEditSubmit();
                      }}
                      autoFocus
                    />
                    <button 
                      onClick={handleObjectEditSubmit}
                      disabled={!objectEditPrompt.trim()}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                      <Sparkles className="w-5 h-5" />
                      Magic Edit
                    </button>
                  </div>
                </motion.div>
              )}
              {isEditingImage && (
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 p-6 flex flex-col md:flex-row gap-8 items-center justify-center z-50"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <label className="text-xs text-zinc-400 font-medium flex justify-between">
                      <span>Brightness</span>
                      <span className="text-indigo-400">{brightness}%</span>
                    </label>
                    <input type="range" min="0" max="200" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                  </div>
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <label className="text-xs text-zinc-400 font-medium flex justify-between">
                      <span>Contrast</span>
                      <span className="text-indigo-400">{contrast}%</span>
                    </label>
                    <input type="range" min="0" max="200" value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                  </div>
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <label className="text-xs text-zinc-400 font-medium flex justify-between">
                      <span>Saturation</span>
                      <span className="text-indigo-400">{saturation}%</span>
                    </label>
                    <input type="range" min="0" max="200" value={saturation} onChange={e => setSaturation(Number(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                  </div>
                  <div className="h-10 w-px bg-zinc-800 hidden md:block mx-2"></div>
                  <button 
                    onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); setCrop(undefined); setCompletedCrop(undefined); }}
                    className="p-2 text-zinc-400 hover:text-white transition-colors flex flex-col items-center gap-1"
                    title="Reset All"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Reset</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
