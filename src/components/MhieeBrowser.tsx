import React, { useState, useRef, useEffect } from 'react';
import MhiexterBrowser from './MhiexterBrowser';
import VoiceChat from './VoiceChat';
import MapPanel from './MapPanel';
import BookGenerator from './BookGenerator';
import GraphRenderer from './GraphRenderer';
import { Search, Shield, X, Globe, Sparkles, Send, Cast, MonitorOff, ImagePlus, XCircle, Download, Share2, Maximize2, SlidersHorizontal, Check, RotateCcw, Wand2, Copy, Mic, Map, Camera, BookOpen } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';
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
  const [activeFolder, setActiveFolder] = useState<'video' | 'browser' | 'settings' | 'history' | 'map' | 'book' | null>(null);
  const [castError, setCastError] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [defaultFace, setDefaultFace] = useState<string | null>(localStorage.getItem('defaultFace'));
  const [searchEngine, setSearchEngine] = useState<'Deepseek' | 'Chat GPT' | 'Gemini'>('Gemini');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);

  const handleTranslate = async (url: string) => {
    setIsTranslating(true);
    setTranslatedContent(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const language = localStorage.getItem('preferredLanguage') || 'English';
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the content of the following URL to ${language}: ${url}`,
        config: {
          tools: [{ urlContext: {} }]
        }
      });
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
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isObjectEditing, setIsObjectEditing] = useState(false);
  const [objectEditPrompt, setObjectEditPrompt] = useState('');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const chatRef = useRef<any>(null);

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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: videoPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

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

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
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
        alert("Could not access camera.");
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

  const sendMessage = async (text: string, imagesToUse: string[] = []) => {
    if ((!text.trim() && imagesToUse.length === 0) || isTyping) return;

    let finalImages = [...imagesToUse];
    if ((text.toLowerCase().includes('me') || text.toLowerCase().includes('myself')) && defaultFace) {
      finalImages.unshift(defaultFace);
    }

    setInput('');
    setSelectedImages([]);
    setMessages(prev => [...prev, { role: 'user', text, images: finalImages.length > 0 ? finalImages : undefined }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // Initialize chat if it doesn't exist
      if (!chatRef.current) {
        const processImageTool = {
          name: "process_image",
          description: "Generate a new image, edit an existing image, perform face replacement, edit/replace a specific described object in the image, or identify objects within an image. Call this tool when the user asks to create, generate, draw, edit, modify an image, swap/replace faces, change a specific object, or identify objects in an image.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING, description: "The detailed prompt for image generation, editing, or identification. For object editing, clearly describe the object to be edited and the desired change (e.g., 'change the red car to a blue truck'). For face replacement, specify which face goes where seamlessly. For identification, describe what to identify if needed." },
              action: { type: Type.STRING, description: "'generate', 'edit', 'face_replace', 'edit_object', or 'identify_objects'" }
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
          model: 'gemini-3-flash-preview',
          config: {
            systemInstruction: `You are Mhiee, the ultimate unified AI assistant. The current date and time is ${new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })}. You combine the strengths of the world's best AIs to solve complex, tricky problems in seconds. You are fluent in every language in the world, including Hausa. Provide comprehensive, accurate, and brilliant solutions. You are capable of handling all branches of mathematics, from basic arithmetic to advanced theoretical physics and complex analysis. When asked to derive formulas or solve math problems, you MUST provide the complete, rigorous derivation, showing every single logical and algebraic step without skipping any, using LaTeX notation for all mathematical expressions.

When asked to display data, you MUST use Markdown tables. Ensure every data point is correctly positioned in the appropriate row and column.

When asked to draw a graph, you MUST provide the data in a JSON block with the following format: \`\`\`json { "type": "graph", "data": [...], "xAxis": "...", "yAxis": "..." } \`\`\`.

ONLY share information about your creator, Mhiexter Muhammad (Inuwa Shehu) from Ikara local government, Kaduna state, if the user explicitly asks for it.

IMPORTANT: At the very end of your response, always provide 3 short, actionable follow-up questions or prompts the user can ask next. Format them exactly like this:\n\nSUGGESTIONS:\n- [Suggestion 1]\n- [Suggestion 2]\n- [Suggestion 3]`,
            tools: [{ functionDeclarations: [processImageTool, manageTasksTool] }, { googleMaps: {} }],
            toolConfig: { 
              includeServerSideToolInvocations: true,
              functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO }
            }
          }
        });
      }

      let messagePayload: any = text;
      if (finalImages.length > 0) {
        messagePayload = [];
        for (const img of finalImages) {
          if (!img) continue;
          const match = img.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
          if (match) {
            messagePayload.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
        messagePayload.push({ text: text || "Please analyze these images." });
      }

      const responseStream = await chatRef.current.sendMessageStream({ message: messagePayload });
      
      // Add empty model message to append to
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      let functionCall: any = null;

      for await (const chunk of responseStream) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          functionCall = chunk.functionCalls[0];
        }
        if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].groundingMetadata) {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              groundingMetadata: chunk.candidates![0].groundingMetadata
            };
            return newMessages;
          });
        }
        if (chunk.text) {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            // Fix: Create a new object to avoid mutating state directly in Strict Mode
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              text: newMessages[lastIndex].text + chunk.text
            };
            return newMessages;
          });
        }
      }

        if (functionCall && (functionCall.name === 'process_image' || functionCall.name === 'manage_tasks')) {
          if (functionCall.name === 'process_image') {
            const { prompt, action } = functionCall.args;
            
            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1].text += "\n\n*Processing image...*";
              return newMsgs;
            });

            try {
              const imageParts: any[] = [];
              if (action === 'edit' || action === 'face_replace' || action === 'edit_object' || action === 'identify_objects') {
                const lastMessageWithImage = [...messages].reverse().find(m => (m.images && m.images.length > 0) || m.generatedImage);
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
                  throw new Error("No images found to process. Please upload images first.");
                }
              }
              imageParts.push({ text: `${prompt}. IMPORTANT: Do not decompose, alter, or touch the face of the person in the image. Ensure the editing looks completely natural and not like AI editing.` });

              let generatedImage = null;
              let textResponse = null;

              if (action === 'identify_objects') {
                const identificationResponse = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: { parts: imageParts },
                  config: {
                    systemInstruction: "Identify all objects in the provided image. Return a JSON array of objects, where each object has 'name' and 'description'.",
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
              
              let friendlyImgError = imgErr.message || "An unknown error occurred.";
              const lowerErr = friendlyImgError.toLowerCase();

              if (lowerErr.includes('aspect ratio') || lowerErr.includes('dimensions')) {
                friendlyImgError = "Image generation failed due to unsupported aspect ratio.";
              } else if (action === 'face_replace') {
                friendlyImgError = "Face swap failed: Please ensure both faces are clearly visible.";
              } else if (action === 'edit_object') {
                friendlyImgError = "Object editing failed: Please ensure the object is clearly described and visible in the image.";
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
                alert(`Timer for ${seconds} seconds is up!`);
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
      } else if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
        friendlyMessage = "There seems to be an issue with my authentication. Please check the API configuration.";
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100"
    >
      {/* Browser Chrome / Header */}
      <div className="flex items-center justify-between p-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex items-center gap-2 text-zinc-300 font-medium">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Mhiee Unified AI
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {castError && (
            <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-md">
              {castError}
            </span>
          )}
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
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1">
            <X className="w-6 h-6" />
          </button>
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
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden"
            >
              <div className="p-4 flex flex-col gap-4 w-80">
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
              animate={{ width: 600, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden"
            >
              <MapPanel />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Book Generator Panel */}
        <AnimatePresence>
          {activeFolder === 'book' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 600, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden"
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
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden"
            >
              <div className="p-4 flex flex-col gap-4 w-80">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mhiexter Browser Panel */}
        <AnimatePresence>
          {activeFolder === 'browser' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 600, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden flex flex-col"
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

        {/* Settings Panel */}
        <AnimatePresence>
          {activeFolder === 'settings' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-900 border-l border-zinc-800 overflow-hidden"
            >
              <div className="p-4 flex flex-col gap-6 w-80">
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
                  </select>
                </div>

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
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
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
                    className={`max-w-[85%] rounded-2xl p-5 ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-sm shadow-xl'
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
                      <div className="flex flex-col relative group/msg">
                        <div className="absolute -top-3 -right-3 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <button 
                            onClick={() => navigator.clipboard.writeText(msg.text)}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md border border-zinc-700 shadow-sm transition-colors"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="markdown-body">
                          <Markdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{msg.text ? msg.text.replace(/```json\s*(\{[\s\S]*?"type":\s*"graph"[\s\S]*?\})\s*```/g, '').trim() : ''}</Markdown>
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
            <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 focus-within:border-indigo-500/50 transition-colors shadow-lg">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-zinc-400 hover:text-indigo-400 transition-colors mb-0.5"
                title="Upload Images"
              >
                <ImagePlus className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={startCamera}
                className="p-3 text-zinc-400 hover:text-indigo-400 transition-colors mb-0.5"
                title="Take Photo"
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
                placeholder="Ask Mhiee anything in any language (e.g., Hausa)..."
                className="flex-1 bg-transparent border-none resize-none max-h-48 min-h-[44px] py-3 px-2 text-sm focus:outline-none text-white placeholder-zinc-500"
                rows={1}
                style={{ height: 'auto' }}
              />
              <VoiceChat onToggle={(active) => console.log('Voice chat active:', active)} />
              <button 
                type="submit" 
                disabled={(!input.trim() && selectedImages.length === 0) || isTyping}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-colors mb-0.5"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
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
    </motion.div>
  );
}
