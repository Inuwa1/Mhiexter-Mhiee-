/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent, useEffect, MouseEvent, DragEvent } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, MonitorPlay, UploadCloud, Share2, X, Globe, Image as ImageIcon, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FileShare from './components/FileShare';
import MhieeBrowser from './components/MhieeBrowser';
import PhotoStudio from './components/PhotoStudio';

export default function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'photo'>('video');

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleProgressMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * duration;
    
    setPreviewTime(time);
    setPreviewPosition(percentage * 100);
    
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = time;
    }
  };

  const loadVideoFile = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoName(file.name);
      setIsPlaying(false);
      setCurrentTime(0);
    } else {
      alert('Please select a valid video file.');
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadVideoFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      loadVideoFile(file);
    }
  };

  const handleMouseMove = () => {
    setIsHovering(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsHovering(false);
        setShowSettings(false);
      }
    }, 2500);
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setIsHovering(false);
      setShowSettings(false);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume === 0) {
        setIsMuted(true);
        videoRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoSrc || !videoRef.current) return;
      if (document.activeElement?.tagName === 'INPUT') return;

      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowright':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 5, videoRef.current.duration);
          break;
        case 'arrowleft':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 5, 0);
          break;
        case 'arrowup':
          e.preventDefault();
          const newVolUp = Math.min(videoRef.current.volume + 0.1, 1);
          videoRef.current.volume = newVolUp;
          setVolume(newVolUp);
          if (newVolUp > 0 && isMuted) {
            setIsMuted(false);
            videoRef.current.muted = false;
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          const newVolDown = Math.max(videoRef.current.volume - 0.1, 0);
          videoRef.current.volume = newVolDown;
          setVolume(newVolDown);
          if (newVolDown === 0) {
            setIsMuted(true);
            videoRef.current.muted = true;
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoSrc, isMuted]);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div 
      className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 flex flex-col items-center relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && activeTab === 'video' && (
        <div className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm border-4 border-indigo-500 border-dashed m-4 md:m-8 rounded-3xl flex flex-col items-center justify-center pointer-events-none transition-all">
          <UploadCloud className="w-24 h-24 text-indigo-400 mb-4 animate-bounce" />
          <h2 className="text-3xl font-bold text-white tracking-tight">Drop video here</h2>
          <p className="text-indigo-200 mt-2 font-medium">Release to play instantly</p>
        </div>
      )}

      <header className="mb-8 w-full max-w-6xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-zinc-900 border border-zinc-800 p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === 'video' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span className="text-sm font-bold">M²</span>
              Video Player
            </button>
            <button
              onClick={() => setActiveTab('photo')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === 'photo' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Photo Studio
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBrowser(true)}
            className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 py-2 px-4 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            Mhiee Browser
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowShareModal(true)}
            className="bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share File
          </motion.button>
        </div>
      </header>

      {/* Browser Modal */}
      <AnimatePresence>
        {showBrowser && <MhieeBrowser onClose={() => setShowBrowser(false)} />}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative"
            >
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowShareModal(false)}
                className="absolute -top-12 right-0 text-zinc-400 hover:text-white transition-colors bg-zinc-900 p-2 rounded-full"
              >
                <X className="w-6 h-6" />
              </motion.button>
              <FileShare />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'video' ? (
        <div className="w-full max-w-5xl flex flex-col items-center gap-6">
          {!videoSrc && (
            <div className="w-full aspect-video bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4">
              <MonitorPlay className="w-16 h-16 text-zinc-700" />
              <motion.label 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-6 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
              >
                Select Video
                <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
              </motion.label>
              <p className="text-sm text-zinc-500">Supports all standard video formats</p>
            </div>
          )}

          {videoSrc && (
            <div 
              ref={containerRef}
              className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative group"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={togglePlay}
            >
              {/* Top Bar */}
            <motion.div 
              initial={false}
              animate={{ 
                opacity: isHovering || !isPlaying ? 1 : 0,
                y: isHovering || !isPlaying ? 0 : -20
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/80 to-transparent pt-4 pb-12 px-4 z-10 flex justify-between items-start pointer-events-auto" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 max-w-[70%]">
                <span className="text-sm font-medium text-white truncate drop-shadow-md">{videoName}</span>
              </div>
              <motion.label 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="cursor-pointer bg-zinc-800/80 hover:bg-zinc-700 text-white py-1.5 px-3 rounded-lg text-sm font-medium transition-colors backdrop-blur-md"
              >
                Change Video
                <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
              </motion.label>
            </motion.div>

            {/* Center Play/Pause Overlay */}
            <motion.div 
              initial={false}
              animate={{ 
                opacity: !isPlaying ? 1 : 0,
                scale: !isPlaying ? 1 : 1.5
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
            >
              <div className="bg-black/50 backdrop-blur-sm p-5 rounded-full text-white shadow-2xl">
                <Play className="w-12 h-12 ml-1" />
              </div>
            </motion.div>

            {/* Bottom Controls */}
            <motion.div 
              initial={false}
              animate={{ 
                opacity: isHovering || !isPlaying ? 1 : 0,
                y: isHovering || !isPlaying ? 0 : 20
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-4 px-4 z-10 pointer-events-auto" 
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress Bar */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-zinc-300 w-10 text-right font-mono">{formatTime(currentTime)}</span>
                
                <div 
                  className="flex-1 relative flex items-center h-6 group/progress cursor-pointer"
                  ref={progressBarRef}
                  onMouseMove={handleProgressMouseMove}
                  onMouseEnter={() => setShowPreview(true)}
                  onMouseLeave={() => setShowPreview(false)}
                >
                  {/* Thumbnail Preview */}
                  <AnimatePresence>
                    {showPreview && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full mb-2 transform -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col items-center pointer-events-none z-50"
                        style={{ left: `${previewPosition}%` }}
                      >
                        <video 
                          ref={previewVideoRef} 
                          src={videoSrc} 
                          className="w-36 aspect-video bg-black object-contain"
                          preload="metadata"
                          muted
                        />
                        <div className="text-xs font-mono text-white py-1 font-medium">{formatTime(previewTime)}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 group-hover/progress:h-2 transition-all absolute top-1/2 -translate-y-1/2 m-0"
                  />
                </div>

                <span className="text-xs font-medium text-zinc-300 w-10 font-mono">{formatTime(duration)}</span>
              </div>

              {/* Controls Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <motion.button 
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={togglePlay} 
                    className="text-white hover:text-indigo-400 transition-colors ml-2"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </motion.button>
                  
                  <div className="flex items-center gap-2 group/volume">
                    <motion.button 
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={toggleMute} 
                      className="text-white hover:text-indigo-400 transition-colors"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </motion.button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 transition-all duration-300 h-1.5 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-5 relative mr-2">
                  <div className="relative">
                    <motion.button 
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setShowSettings(!showSettings)}
                      className={`text-white hover:text-indigo-400 transition-colors ${showSettings ? 'text-indigo-400' : ''}`}
                    >
                      <motion.div animate={{ rotate: showSettings ? 45 : 0 }} transition={{ duration: 0.3 }}>
                        <Settings className="w-5 h-5" />
                      </motion.div>
                    </motion.button>
                    
                    {/* Settings Menu (Speed) */}
                    <AnimatePresence>
                      {showSettings && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute bottom-full right-0 mb-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-2 min-w-[140px] shadow-2xl origin-bottom-right"
                        >
                          <div className="text-xs font-semibold text-zinc-400 mb-2 px-2 uppercase tracking-wider">Speed</div>
                          <div className="flex flex-col">
                            {[0.25, 0.5, 1, 1.25, 1.5, 2].map((rate) => (
                              <motion.button
                                key={rate}
                                whileHover={{ x: 4 }}
                                onClick={() => {
                                  handlePlaybackRateChange(rate);
                                  setShowSettings(false);
                                }}
                                className={`text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  playbackRate === rate ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                }`}
                              >
                                {rate === 1 ? 'Normal' : `${rate}x`}
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.button 
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={toggleFullscreen} 
                    className="text-white hover:text-indigo-400 transition-colors"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </motion.button>
                </div>
              </div>
            </motion.div>

            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full aspect-video bg-black"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        )}
        </div>
      ) : (
        <PhotoStudio />
      )}
    </div>
  );
}
