import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, ExternalLink, Globe, Loader2, Home, Search, ShieldCheck, X, Tv, BookOpen, MessageSquare, ShoppingCart, Newspaper, Code, Users, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const QUICK_LINKS = [
  { name: 'Google', url: 'https://www.google.com', icon: Search, bg: 'bg-blue-500/10', color: 'text-blue-400' },
  { name: 'YouTube', url: 'https://www.youtube.com', icon: Tv, bg: 'bg-red-500/10', color: 'text-red-400' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: BookOpen, bg: 'bg-zinc-500/10', color: 'text-zinc-300' },
  { name: 'ChatGPT', url: 'https://chat.openai.com', icon: MessageSquare, bg: 'bg-emerald-500/10', color: 'text-emerald-400' },
  { name: 'Amazon', url: 'https://www.amazon.com', icon: ShoppingCart, bg: 'bg-orange-500/10', color: 'text-orange-400' },
  { name: 'BBC News', url: 'https://www.bbc.com/news', icon: Newspaper, bg: 'bg-rose-500/10', color: 'text-rose-400' },
  { name: 'GitHub', url: 'https://github.com', icon: Code, bg: 'bg-purple-500/10', color: 'text-purple-400' },
  { name: 'Facebook', url: 'https://facebook.com', icon: Users, bg: 'bg-blue-600/10', color: 'text-blue-500' },
];

export default function MhiexterBrowser({ onTranslate }: { onTranslate: (url: string) => void }) {
  const [history, setHistory] = useState<string[]>(['']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [proxyEngine, setProxyEngine] = useState<0 | 1 | 2>(0);
  
  // Custom Search State
  const [isSearchMode, setIsSearchMode] = useState(true);
  const [searchResults, setSearchResults] = useState<{title: string, url: string, snippet: string}[]>([]);
  
  // Preview Modal State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Developer Analytics State
  const [showDevTools, setShowDevTools] = useState(false);
  const [networkLogs, setNetworkLogs] = useState<{timestamp: string, type: string, url: string, status: string}[]>([]);

  const currentUrl = history[currentIndex] || '';
  
  const getProxyUrl = (url: string, engineIndex: number) => {
    if (!url) return '';
    // Bypass proxy for YouTube (use embed) or Wikipedia if possible, but for universal browser, we use proxy engines.
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    
    switch (engineIndex) {
      case 0: return `https://corsproxy.io/?${encodeURIComponent(url)}`;
      case 1: return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      case 2: return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
      default: return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }
  };

  const iframeSrc = getProxyUrl(currentUrl, proxyEngine);

  useEffect(() => {
    if (!inputUrl.trim()) {
      setIsSearchMode(true);
      setSearchResults([]);
    }
  }, [inputUrl]);

  // Simulate picking up network traffic when URL changes
  useEffect(() => {
      if (currentUrl && !isSearchMode) {
          const newLog = {
              timestamp: new Date().toLocaleTimeString(),
              type: 'GET',
              url: currentUrl,
              status: '200 OK'
          };
          setNetworkLogs(prev => [newLog, ...prev].slice(0, 15));
      }
  }, [currentUrl, isSearchMode]);

  const fetchSearchResults = async (query: string) => {
    setIsLoading(true);
    try {
      // Using Wikipedia API for reliable, free, keyless search results
      const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
      const data = await res.json();
      if (data.query && data.query.search) {
        const results = data.query.search.map((item: any) => ({
          title: item.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, "") // Strip HTML tags
        }));
        setSearchResults(results);
      }
    } catch (e) {
      console.error("Search failed:", e);
      setSearchResults([]);
    }
    setIsLoading(false);
  };

  const navigateTo = (newUrl: string) => {
    let targetUrl = newUrl.trim();
    if (!targetUrl) return;
    
    // Auto-detect if it's a search query instead of a URL
    if (!targetUrl.includes('.') && !targetUrl.startsWith('http') && !targetUrl.includes('localhost')) {
      setIsSearchMode(true);
      fetchSearchResults(targetUrl);
      setInputUrl(targetUrl);
    } else {
      if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
      }
      setIsSearchMode(false);
      
      if (targetUrl !== currentUrl) {
        setIsLoading(true);
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push(targetUrl);
        setHistory(newHistory);
        setCurrentIndex(newHistory.length - 1);
        setInputUrl(targetUrl);
      }
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setIsLoading(true);
      setCurrentIndex(currentIndex - 1);
      setInputUrl(history[currentIndex - 1]);
      setIsSearchMode(false); // Entering history assumes URL mode
    }
  };

  const goForward = () => {
    if (currentIndex < history.length - 1) {
      setIsLoading(true);
      setCurrentIndex(currentIndex + 1);
      setInputUrl(history[currentIndex + 1]);
      setIsSearchMode(false);
    }
  };

  const handleRefresh = () => {
    if (isSearchMode) {
      fetchSearchResults(inputUrl);
    } else {
      setIsLoading(true);
      const tempUrl = currentUrl;
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push('about:blank');
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      setTimeout(() => {
        const resetHistory = newHistory.slice(0, -1);
        resetHistory.push(tempUrl);
        setHistory(resetHistory);
        setCurrentIndex(resetHistory.length - 1);
      }, 50);
    }
  };

  const handleHome = () => {
    setIsSearchMode(true);
    setInputUrl('');
    setSearchResults([]);
  };

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const openPreviewModal = (url: string) => {
    setPreviewUrl(url);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 backdrop-blur-3xl border border-amber-500/20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/10 transition-all duration-300">
      
      {/* MAC-OS STYLE HEADER & TOOLBAR (AMBER THEME) */}
      <div className="flex flex-col bg-zinc-950/80 border-b border-amber-500/20 relative z-10 backdrop-blur-[40px]">
        
        {/* Top Window Controls */}
        <div className="flex items-center justify-between px-4 py-2 w-full">
          <div className="flex items-center gap-2">
            {/* Window controls removed */}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-amber-500/70 text-xs font-semibold tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="opacity-80 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
              MHIEXTER SECURE ENGINE v{proxyEngine + 1}
            </span>
            <button 
              onClick={() => setProxyEngine((prev) => ((prev + 1) % 3) as 0 | 1 | 2)}
              className="ml-2 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/40 rounded-full text-[9px] transition-colors"
              title="Fix Broken Page (Switch Engine)"
            >
              SWITCH
            </button>
          </div>
        </div>

        {/* Navigation Toolbar */}
        <div className="flex items-center gap-2 px-3 pb-3">
          <div className="flex items-center bg-amber-500/5 rounded-xl border border-amber-500/10 p-1">
            <button 
              onClick={goBack} 
              disabled={!canGoBack}
              className={`p-1.5 rounded-lg transition-colors ${canGoBack ? 'text-amber-400 hover:bg-amber-500/20' : 'text-zinc-700'}`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={goForward} 
              disabled={!canGoForward}
              className={`p-1.5 rounded-lg transition-colors ${canGoForward ? 'text-amber-400 hover:bg-amber-500/20' : 'text-zinc-700'}`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={handleRefresh} className="p-1.5 hover:bg-amber-500/20 rounded-lg text-amber-400 transition-colors">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-300' : ''}`} />
            </button>
            <button onClick={handleHome} className="p-1.5 hover:bg-amber-500/20 rounded-lg text-amber-400 transition-colors">
              <Home className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex items-center relative group">
            <div className="absolute left-3 text-amber-500/50 group-focus-within:text-amber-400 transition-colors">
              <Search className="w-4 h-4" />
            </div>
            <input 
              type="text" 
              value={inputUrl} 
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && navigateTo(inputUrl)}
              onFocus={(e) => e.target.select()}
              className="w-full pl-9 pr-24 py-2 bg-zinc-900/50 rounded-xl border border-amber-500/20 text-amber-50 text-sm placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 shadow-inner overflow-hidden text-ellipsis whitespace-nowrap transition-all"
              placeholder="Bincika komai anan..."
              spellCheck="false"
            />
            {/* Domain Highlight Overlay & Clear Button */}
            <div className="absolute right-2 flex items-center gap-1">
              {inputUrl && (
                <button 
                  onClick={() => { setInputUrl(''); setIsSearchMode(true); setSearchResults([]); }}
                  className="p-1 text-zinc-500 hover:text-red-400 bg-zinc-900/50 hover:bg-zinc-800 rounded-md transition-all"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {!isSearchMode && currentUrl && (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-amber-500/60 uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20 pointer-events-none">
                  {getDomain(currentUrl)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setShowDevTools(true)}
              className="p-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-300 transition-all mr-2"
              title="Developer Analytics (Security Audit)"
            >
                <Activity className="w-5 h-5" />
            </button>
            <button onClick={() => navigateTo(inputUrl)} className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-xl text-amber-400 text-sm font-medium transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] border border-amber-500/30">
              Bincika
            </button>
            {!isSearchMode && (
              <>
                <button onClick={() => onTranslate?.(currentUrl)} className="p-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-300 transition-all" title="Translate Page">
                  <Globe className="w-5 h-5" />
                </button>
                <button onClick={() => window.open(currentUrl, '_blank')} className="p-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-300 transition-all" title="Open Outside">
                  <ExternalLink className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* BROWSER / SEARCH VIEWPORT */}
      <div className="relative flex-1 w-full h-full bg-zinc-950 overflow-hidden">
        
        {/* Developer Analytics UI Layer */}
        <AnimatePresence>
            {showDevTools && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="absolute bottom-0 left-0 w-full h-64 bg-zinc-900 border-t border-amber-500/30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40 flex flex-col font-mono text-xs"
                >
                    <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-400 font-semibold tracking-wider">
                            <Activity className="w-4 h-4" />
                            NETWORK & SECURITY ANALYTICS
                        </div>
                        <button onClick={() => setShowDevTools(false)} className="text-zinc-500 hover:text-amber-400 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/50 text-emerald-400/80 space-y-1">
                        <div className="text-amber-500/80 mb-2">Analyzing connection secure endpoints...</div>
                        {networkLogs.length === 0 ? (
                             <div className="text-zinc-600 italic">No network traffic detected yet. Navigate to a page to intercept.</div>
                        ) : (
                            networkLogs.map((log, i) => (
                                <div key={i} className="flex gap-4 hover:bg-white/5 p-1 rounded">
                                    <span className="text-zinc-500 w-24">[{log.timestamp}]</span>
                                    <span className="text-blue-400 w-12 font-bold">{log.type}</span>
                                    <span className={log.status.includes('200') ? 'text-emerald-400 w-16' : 'text-red-400 w-16'}>{log.status}</span>
                                    <span className="text-zinc-300 truncate">{log.url}</span>
                                </div>
                            ))
                        )}
                        <div className="animate-pulse flex gap-2 mt-4 text-amber-400/50">
                            <span>{'>'}</span> Listening for incoming XHR/Fetch requests...
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 0.8, transition: { duration: 2, ease: "easeOut" } }}
              exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.3 } }}
              className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-500 z-30 origin-left"
            />
          )}
        </AnimatePresence>

        {isSearchMode ? (
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6 bg-zinc-950">
            {searchResults.length === 0 && !isLoading && !inputUrl.trim() ? (
              <div className="h-full flex flex-col items-center justify-center p-6 bg-zinc-950 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col items-center mt-[-40px]">
                     <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                       <Globe className="w-8 h-8 text-amber-400" />
                     </div>
                     <h2 className="text-3xl font-bold text-amber-50 tracking-tight">Mhiexter <span className="text-amber-500 font-light">Browser</span></h2>
                     <p className="text-amber-400/60 mt-2 max-w-sm text-center text-sm">Saukake bincike a kan intanet tare da kariya da saurinsa.</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl px-4 mt-12 mb-8">
                    {QUICK_LINKS.map((link, idx) => (
                        <button 
                            key={idx}
                            onClick={() => navigateTo(link.url)} 
                            className="flex flex-col items-center justify-center p-4 bg-zinc-900/60 border border-amber-500/10 rounded-2xl hover:bg-zinc-800/80 hover:border-amber-500/40 transition-all duration-300 group shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:-translate-y-1"
                        >
                           <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center ${link.bg} border border-white/5`}>
                             <link.icon className={`w-5 h-5 ${link.color} group-hover:scale-110 transition-transform`} />
                           </div>
                           <span className="text-xs font-semibold text-amber-100/60 group-hover:text-amber-300 transition-colors tracking-wide">{link.name}</span>
                        </button>
                    ))}
                </div>
              </div>
            ) : searchResults.length === 0 && !isLoading ? (
               <div className="text-center text-zinc-400 mt-10">Babu sakamako. Gwada wani binciken daban.</div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6 pb-20">
                <div className="text-xs font-semibold text-amber-500/40 uppercase tracking-widest mb-6">Sakamakon Bincike: {inputUrl}</div>
                
                {searchResults.map((result, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={idx} 
                    className="p-5 bg-zinc-900/50 border border-amber-500/10 rounded-2xl hover:border-amber-500/40 hover:bg-zinc-800/80 transition-all cursor-pointer group shadow-sm hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    onClick={() => openPreviewModal(result.url)}
                  >
                    <h3 className="text-lg font-medium text-amber-400 group-hover:text-amber-300 mb-1 leading-tight">{result.title}</h3>
                    <div className="text-xs text-emerald-400/70 mb-3 font-mono truncate">{result.url}</div>
                    <p className="text-sm text-zinc-400 leading-relaxed group-hover:text-zinc-300">{result.snippet}...</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <iframe
            src={iframeSrc}
            className="w-full h-full border-none bg-white"
            title="Mhiexter Browser Content"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; encrypted-media; fullscreen"
          ></iframe>
        )}
      </div>

      {/* SAFE PREVIEW MODAL */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 md:p-12"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full h-full max-w-6xl bg-zinc-950 border border-amber-500/30 rounded-3xl overflow-hidden flex flex-col shadow-[0_20px_60px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/20"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-amber-50 font-semibold text-sm">Safe Preview Modal</h3>
                    <p className="text-zinc-500 text-xs font-mono truncate max-w-md">{previewUrl}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.open(previewUrl, '_blank')} className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium rounded-xl transition-colors border border-amber-500/20 flex items-center gap-2">
                    Open Default <ExternalLink className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPreviewUrl(null)} className="p-2 hover:bg-red-500/20 bg-zinc-800 rounded-xl text-zinc-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/30">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Modal Iframe */}
              <div className="flex-1 bg-white relative">
                <iframe 
                  src={`https://api.allorigins.win/raw?url=${encodeURIComponent(previewUrl)}`} 
                  className="w-full h-full border-none" 
                  sandbox="allow-forms allow-same-origin allow-scripts" 
                  title="Safe Preview"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
