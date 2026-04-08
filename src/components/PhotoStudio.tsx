import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, SlidersHorizontal, RotateCcw, Download, Check, Sparkles, Loader2 } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { callAiWithRetry } from '../lib/aiUtils';

// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function PhotoStudio() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sepia, setSepia] = useState(0);
  const [blur, setBlur] = useState(0);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isObjectSelectionMode, setIsObjectSelectionMode] = useState(false);
  const [activeFolder, setActiveFolder] = useState<'adjustments' | 'retouch' | 'face' | 'video' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [splitPosition, setSplitPosition] = useState(50);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceSwapInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
    }
  };

  const loadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setImageName(file.name);
      resetEdits();
    };
    reader.readAsDataURL(file);
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
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
    }
  };

  const resetEdits = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setSepia(0);
    setBlur(0);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setAiError(null);
    setPreviewImageSrc(null);
  };

  const handleFaceSwapFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageSrc || isProcessingAI) return;

    setIsProcessingAI(true);
    setAiError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const reader = new FileReader();
      const base64SecondImage = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (reader.result) {
            resolve(reader.result as string);
          } else {
            reject(new Error("Failed to read image file"));
          }
        };
        reader.readAsDataURL(file);
      });

      const match1 = imageSrc.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
      const match2 = base64SecondImage.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
      
      if (!match1 || !match2) throw new Error("Invalid image format");

      const response = await callAiWithRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: match1[1], data: match1[2] } },
            { inlineData: { mimeType: match2[1], data: match2[2] } },
            { text: "Replace the face of the person in the first image with the face from the second image seamlessly. IMPORTANT: Do not decompose, alter, or touch the face of the person in the image. Ensure the editing looks completely natural and not like AI editing." }
          ]
        }
      }));

      let newImage = null;
      let textResponse = null;
      const candidate = response.candidates?.[0];

      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("Image generation was blocked due to safety guidelines.");
      }

      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            newImage = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          } else if (part.text) {
            textResponse = part.text;
          }
        }
      }

      if (newImage) {
        setPreviewImageSrc(newImage);
        setSplitPosition(50);
      } else {
        throw new Error(textResponse || "Failed to generate face swap image.");
      }
    } catch (err: any) {
      console.error("Face Swap Error:", err);
      setAiError(err.message || "An error occurred during face swap.");
    } finally {
      setIsProcessingAI(false);
      if (faceSwapInputRef.current) faceSwapInputRef.current.value = '';
    }
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

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isObjectSelectionMode || !imgRef.current) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const size = 20; 
    const newCrop: Crop = {
      unit: '%',
      x: Math.max(0, (x / rect.width) * 100 - size / 2),
      y: Math.max(0, (y / rect.height) * 100 - size / 2),
      width: size,
      height: size,
    };
    setCrop(newCrop);
    setCompletedCrop(newCrop);
  };

  const handleAIEdit = async (prompt: string) => {
    const baseImage = previewImageSrc || imageSrc;
    if (!baseImage || isProcessingAI) return;
    
    let finalPrompt = prompt;
    finalPrompt += " IMPORTANT: Do not decompose, alter, or touch the face of the person in the image. Ensure the editing looks completely natural and not like AI editing.";
    
    if (completedCrop && completedCrop.width > 0) {
      finalPrompt += ` The object to modify is located roughly in the ${getRegionName(completedCrop)} of the image.`;
    }
    
    setIsProcessingAI(true);
    setAiError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const match = baseImage.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid image format");

      const mimeType = match[1];
      const base64Data = match[2];

      const response = await callAiWithRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: finalPrompt }
          ]
        }
      }));

      let newImage = null;
      let textResponse = null;
      const candidate = response?.candidates?.[0];

      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("Image generation was blocked due to safety guidelines.");
      }

      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            newImage = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          } else if (part.text) {
            textResponse = part.text;
          }
        }
      }

      if (newImage) {
        setPreviewImageSrc(newImage);
        setSplitPosition(50);
      } else {
        throw new Error(textResponse || "Failed to generate edited image.");
      }
    } catch (err: any) {
      console.error("AI Edit Error:", err);
      setAiError("AI processing failed due to a temporary issue. Please try again.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleDownload = () => {
    if (!imgRef.current || !imageSrc) return;

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

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) blur(${blur}px)`;
    
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

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `edited-${imageName || 'image.png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleVideoGeneration = async () => {
    if (!videoPrompt || isGeneratingVideo) return;
    
    // Check for API key
    if (!(await (window as any).aistudio.hasSelectedApiKey())) {
      await (window as any).aistudio.openSelectKey();
    }

    setIsGeneratingVideo(true);
    setAiError(null);
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
      setAiError(err.message || "An error occurred during video generation.");
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  return (
    <div 
      className="w-full max-w-6xl mx-auto flex flex-col gap-6 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm border-4 border-indigo-500 border-dashed rounded-3xl flex flex-col items-center justify-center pointer-events-none transition-all">
          <UploadCloud className="w-24 h-24 text-indigo-400 mb-4 animate-bounce" />
          <h2 className="text-3xl font-bold text-white tracking-tight">Drop image here</h2>
        </div>
      )}

      {!imageSrc ? (
        <div className="w-full aspect-video bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4">
          <ImageIcon className="w-16 h-16 text-zinc-700" />
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-6 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
          >
            Select Image
          </motion.button>
          <input 
            type="file" 
            ref={fileInputRef}
            accept="image/*" 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <p className="text-sm text-zinc-500">Supports JPG, PNG, WebP</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] min-h-[600px]">
          {/* Main Image Area */}
          <div className="flex-1 bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col relative">
            <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center">
              <span className="text-sm font-medium text-white truncate drop-shadow-md">{imageName}</span>
              <button 
                onClick={() => { setImageSrc(null); resetEdits(); }}
                className="text-xs bg-zinc-800/80 hover:bg-zinc-700 text-white py-1.5 px-3 rounded-lg font-medium transition-colors backdrop-blur-md"
              >
                Close Image
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-black/50 relative">
              {isProcessingAI && (
                <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                  <p className="text-white font-medium">Applying AI Enhancements...</p>
                </div>
              )}
              {previewImageSrc ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
                  <div className="relative max-h-full max-w-full inline-block">
                    {/* Original Image (Bottom) */}
                    <img 
                      src={imageSrc} 
                      alt="Original" 
                      className="max-h-full max-w-full object-contain shadow-2xl" 
                      style={{ filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) blur(${blur}px)` }}
                    />
                    {/* Swapped Image (Top, Clipped) */}
                    <img 
                      src={previewImageSrc} 
                      alt="Preview" 
                      className="absolute top-0 left-0 w-full h-full object-contain shadow-2xl pointer-events-none" 
                      style={{ 
                        clipPath: `inset(0 ${100 - splitPosition}% 0 0)`,
                        filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) blur(${blur}px)`
                      }}
                    />
                    {/* Invisible Range Slider for Dragging */}
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={splitPosition} 
                      onChange={(e) => setSplitPosition(Number(e.target.value))}
                      className="absolute top-0 left-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                    />
                    {/* Visible Split Line */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10 shadow-[0_0_4px_rgba(0,0,0,0.5)]" style={{ left: `${splitPosition}%` }}>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-indigo-600 font-bold text-xs tracking-tighter">
                        ◂▸
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-30">
                    <button 
                      onClick={() => setPreviewImageSrc(null)} 
                      className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium shadow-xl border border-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => { setImageSrc(previewImageSrc); setPreviewImageSrc(null); resetEdits(); }} 
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-xl shadow-indigo-500/20 transition-colors flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Confirm Swap
                    </button>
                  </div>
                </div>
              ) : (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  className="max-h-full max-w-full"
                >
                  <img 
                    ref={imgRef}
                    src={imageSrc} 
                    alt="Studio Workspace" 
                    className={`max-h-full max-w-full object-contain shadow-2xl ${isObjectSelectionMode ? 'cursor-crosshair' : ''}`} 
                    style={{ 
                      filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) blur(${blur}px)` 
                    }}
                    onClick={handleImageClick}
                  />
                </ReactCrop>
              )}
            </div>
          </div>
          {/* Sidebar Controls */}
          <div className="w-full lg:w-80 bg-zinc-900 rounded-2xl border border-zinc-800 p-6 flex flex-col gap-6 overflow-y-auto">
            
            {/* AI Enhancements Section */}
            <div className="flex flex-col gap-4 border-b border-zinc-800 pb-6">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold tracking-tight">AI Magic</h2>
                </div>
                <button
                  onClick={() => setIsObjectSelectionMode(!isObjectSelectionMode)}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${isObjectSelectionMode ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {isObjectSelectionMode ? 'Selecting...' : 'Select Object'}
                </button>
              </div>
              
              {aiError && (
                <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded-lg border border-red-400/20">
                  {aiError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAIEdit("Remove any glare, reflections, or harsh highlights from the face and glasses. Make the lighting even and natural.")}
                  disabled={isProcessingAI || !!previewImageSrc}
                  className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors border border-zinc-700"
                >
                  <span className="text-xl">🕶️</span>
                  <span className="text-xs font-medium">Deglare</span>
                </button>
                <button
                  onClick={() => handleAIEdit("Enhance this photo into a high-quality professional headshot. Improve lighting, smooth skin naturally, and ensure a clean, professional appearance.")}
                  disabled={isProcessingAI || !!previewImageSrc}
                  className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors border border-zinc-700"
                >
                  <span className="text-xl">👔</span>
                  <span className="text-xs font-medium">Pro Headshot</span>
                </button>
              </div>
              
              <button
                onClick={() => faceSwapInputRef.current?.click()}
                disabled={isProcessingAI || !!previewImageSrc}
                className="w-full flex items-center justify-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors border border-zinc-700 mt-1"
              >
                <span className="text-xl">🎭</span>
                <span className="text-sm font-medium">Face Swap</span>
              </button>
              <input 
                type="file" 
                ref={faceSwapInputRef}
                accept="image/*" 
                onChange={handleFaceSwapFile} 
                className="hidden" 
              />
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800 mt-auto">
              <button 
                onClick={resetEdits}
                className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All
              </button>
              <button 
                onClick={handleDownload}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Image
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bottom Panel */}
      {imageSrc && !previewImageSrc && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 z-40">
          <div className="max-w-6xl mx-auto">
            {/* Adjustments Folder */}
            <div className="border-b border-zinc-800">
              <button 
                onClick={() => setActiveFolder(activeFolder === 'adjustments' ? null : 'adjustments')} 
                className="w-full p-4 text-left text-zinc-400 font-medium hover:text-white flex justify-between items-center"
              >
                Adjustments
                <span>{activeFolder === 'adjustments' ? '−' : '+'}</span>
              </button>
              <AnimatePresence>
                {activeFolder === 'adjustments' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm text-zinc-400 font-medium flex justify-between"><span>Brightness</span><span className="text-indigo-400">{brightness}%</span></label>
                        <input type="range" min="0" max="200" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm text-zinc-400 font-medium flex justify-between"><span>Contrast</span><span className="text-indigo-400">{contrast}%</span></label>
                        <input type="range" min="0" max="200" value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm text-zinc-400 font-medium flex justify-between"><span>Saturation</span><span className="text-indigo-400">{saturation}%</span></label>
                        <input type="range" min="0" max="200" value={saturation} onChange={e => setSaturation(Number(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm text-zinc-400 font-medium flex justify-between"><span>Sepia</span><span className="text-indigo-400">{sepia}%</span></label>
                        <input type="range" min="0" max="100" value={sepia} onChange={e => setSepia(Number(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm text-zinc-400 font-medium flex justify-between"><span>Blur</span><span className="text-indigo-400">{blur}px</span></label>
                        <input type="range" min="0" max="20" step="0.5" value={blur} onChange={e => setBlur(Number(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Retouch & Effects Folder */}
            <div className="border-b border-zinc-800">
              <button 
                onClick={() => setActiveFolder(activeFolder === 'retouch' ? null : 'retouch')} 
                className="w-full p-4 text-left text-zinc-400 font-medium hover:text-white flex justify-between items-center"
              >
                Retouch & Effects
                <span>{activeFolder === 'retouch' ? '−' : '+'}</span>
              </button>
              <AnimatePresence>
                {activeFolder === 'retouch' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 grid grid-cols-3 md:grid-cols-6 gap-2">
                      <button onClick={() => handleAIEdit("Whiten the teeth naturally.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">🦷</span><span className="text-[10px] font-medium text-center leading-tight">Whiten Teeth</span></button>
                      <button onClick={() => handleAIEdit("Apply subtle, natural-looking makeup.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">💄</span><span className="text-[10px] font-medium text-center leading-tight">Add Makeup</span></button>
                      <button onClick={() => handleAIEdit("Automatically enhance this portrait.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">🪄</span><span className="text-[10px] font-medium text-center leading-tight">Auto Enhance</span></button>
                      <button onClick={() => handleAIEdit("Add natural volume and shine to the hair.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">💇‍♀️</span><span className="text-[10px] font-medium text-center leading-tight">Hair Volume</span></button>
                      <button onClick={() => handleAIEdit("Apply professional studio lighting.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">💡</span><span className="text-[10px] font-medium text-center leading-tight">Studio Relight</span></button>
                      <button onClick={() => handleAIEdit("Blur the background.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">🌫️</span><span className="text-[10px] font-medium text-center leading-tight">Background Blur</span></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Face Editing Folder */}
            <div className="border-b border-zinc-800">
              <button 
                onClick={() => setActiveFolder(activeFolder === 'face' ? null : 'face')} 
                className="w-full p-4 text-left text-zinc-400 font-medium hover:text-white flex justify-between items-center"
              >
                Face Editing
                <span>{activeFolder === 'face' ? '−' : '+'}</span>
              </button>
              <AnimatePresence>
                {activeFolder === 'face' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 grid grid-cols-3 md:grid-cols-6 gap-2">
                      <button onClick={() => handleAIEdit("Smooth the skin.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">✨</span><span className="text-[10px] font-medium text-center leading-tight">Smooth Skin</span></button>
                      <button onClick={() => handleAIEdit("Remove wrinkles.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">👵</span><span className="text-[10px] font-medium text-center leading-tight">Remove Wrinkles</span></button>
                      <button onClick={() => handleAIEdit("Remove blemishes.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">🩹</span><span className="text-[10px] font-medium text-center leading-tight">Remove Blemishes</span></button>
                      <button onClick={() => handleAIEdit("Brighten eyes.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">👁️</span><span className="text-[10px] font-medium text-center leading-tight">Brighten Eyes</span></button>
                      <button onClick={() => handleAIEdit("Remove dark circles.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">🌙</span><span className="text-[10px] font-medium text-center leading-tight">Dark Circles</span></button>
                      <button onClick={() => handleAIEdit("Slim face.")} className="flex flex-col items-center justify-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"><span className="text-lg">📐</span><span className="text-[10px] font-medium text-center leading-tight">Slim Face</span></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Video Generation Folder */}
            <div className="border-b border-zinc-800">
              <button 
                onClick={() => setActiveFolder(activeFolder === 'video' ? null : 'video')} 
                className="w-full p-4 text-left text-zinc-400 font-medium hover:text-white flex justify-between items-center"
              >
                Video Generation
                <span>{activeFolder === 'video' ? '−' : '+'}</span>
              </button>
              <AnimatePresence>
                {activeFolder === 'video' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 flex flex-col gap-4">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
