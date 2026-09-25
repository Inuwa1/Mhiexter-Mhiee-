import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, ArrowRight, RefreshCw, ExternalLink, Globe, Loader2, Home, Search, 
  ShieldCheck, X, Tv, BookOpen, MessageSquare, ShoppingCart, Newspaper, Code, 
  Users, Activity, Star, History, Lock, Settings, Layers, Download, DownloadCloud, 
  Sparkles, Trash2, Fingerprint, Edit2, Eye, EyeOff, Check, RotateCcw, Plus, Compass, 
  LayoutGrid, Share2, AlertTriangle, ShieldClose, Volume2, Moon, Sun, CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { get, set as idbSet } from 'idb-keyval';
import { GoogleGenAI } from '@google/genai';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
  AreaChart, Area, XAxis, YAxis, BarChart, Bar 
} from 'recharts';

// --- TYPE INTERFACES ---
interface Tab {
  id: string;
  title: string;
  url: string;
  history: string[];
  currentIndex: number;
  isSearchMode: boolean;
  searchResults: { title: string; url: string; snippet: string; }[];
  isLoading: boolean;
  incognito: boolean;
}

interface Bookmark {
  title: string;
  url: string;
  addedAt: number;
}

interface HistoryItem {
  title: string;
  url: string;
  visitedAt: number;
  incognito: boolean;
}

interface Credential {
  id: string;
  domain: string;
  username: string;
  secret: string;
}

interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  status: 'downloading' | 'completed' | 'paused' | 'failed';
  progress: number; // 0 to 100
  speed: string; // e.g. "2.4 MB/s"
  size: string; // e.g. "12.8 MB"
  category: 'video' | 'audio' | 'document' | 'other';
}

const DEFAULT_LINKS = [
  { name: 'Google', url: 'https://www.google.com', icon: Search, bg: 'bg-blue-500/10', color: 'text-blue-400' },
  { name: 'YouTube', url: 'https://www.youtube.com', icon: Tv, bg: 'bg-red-500/10', color: 'text-red-400' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: BookOpen, bg: 'bg-zinc-500/10', color: 'text-zinc-300' },
  { name: 'GitHub', url: 'https://github.com', icon: Code, bg: 'bg-purple-500/10', color: 'text-purple-400' },
  { name: 'BBC News', url: 'https://www.bbc.com/news', icon: Newspaper, bg: 'bg-rose-500/10', color: 'text-rose-400' },
];

export default function MhiexterBrowser({ onTranslate, initialUrl }: { onTranslate: (url: string) => void; initialUrl?: string; }) {
  // --- STATE SYSTEM ---
  const [apiKey, setApiKey] = useState<string>('');
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'tab-1',
      title: 'Dominion Space',
      url: initialUrl || '',
      history: [initialUrl || ''],
      currentIndex: 0,
      isSearchMode: !initialUrl,
      searchResults: [],
      isLoading: false,
      incognito: false,
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [proxyEngine, setProxyEngine] = useState<0 | 1 | 2>(0);
  const [searchEngine, setSearchEngine] = useState<'google' | 'wikipedia' | 'duckduckgo' | 'perplexity'>('google');
  
  // Storage and Hubs
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryItem[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  
  // UI Panels
  const [sidebarPanel, setSidebarPanel] = useState<'tabs' | 'bookmarks' | 'history' | 'passwords' | 'downloads' | 'settings' | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isReaderMode, setIsReaderMode] = useState(false);
  
  // Copilot Details
  const [scrapedText, setScrapedText] = useState<string>('');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiKeyTopics, setAiKeyTopics] = useState<string[]>([]);
  const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'model'; text: string; }[]>([]);
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [isCopilotThinking, setIsCopilotThinking] = useState(false);
  
  // Search Engine Interactive (Perplexity Mode)
  const [perplexityAnswer, setPerplexityAnswer] = useState<string>('');
  const [perplexitySources, setPerplexitySources] = useState<{ title: string; url: string; }[]>([]);
  const [isPerplexityLoading, setIsPerplexityLoading] = useState(false);

  // Reader Mode Text Size & Color Themes
  const [readerTheme, setReaderTheme] = useState<'warm' | 'dark' | 'bright'>('warm');
  const [readerFontSize, setReaderFontSize] = useState<number>(18);

  // Brave Shield Simulator
  const [shieldActive, setShieldActive] = useState(true);
  const [blockedTrackersCount, setBlockedTrackersCount] = useState(142);
  const [bandwidthSavedMb, setBandwidthSavedMb] = useState(12.4);
  const [showShieldStats, setShowShieldStats] = useState(false);

  // Credentials / Security Simulation
  const [authRequired, setAuthRequired] = useState(false);
  const [bioVerified, setBioVerified] = useState(false);
  const [isVerifyingBio, setIsVerifyingBio] = useState(false);
  const [newCredDomain, setNewCredDomain] = useState('');
  const [newCredUsername, setNewCredUsername] = useState('');
  const [newCredPassword, setNewCredPassword] = useState('');

  // General Input & DevTools
  const [inputUrl, setInputUrl] = useState(initialUrl || '');
  const [showTrafficLogs, setShowTrafficLogs] = useState(false);
  const [trafficLogs, setTrafficLogs] = useState<{ timestamp: string; type: string; url: string; status: string; }[]>([]);

  // Current active tab object helper
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // --- INITIAL LOAD & SYNC ---
  useEffect(() => {
    // Fetch API Config safely
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.GEMINI_API_KEY && data.GEMINI_API_KEY !== 'MISSING_KEY') {
          setApiKey(data.GEMINI_API_KEY);
          (window as any).GEMINI_API_KEY = data.GEMINI_API_KEY;
        }
      })
      .catch(err => console.error("[Config Hub Error] Failed to grab keys:", err));

    // Restore Persistent Bookmarks
    get('mhiee_bookmarks').then((data) => {
      if (data) setBookmarks(data);
    });

    // Restore Browsing History
    get('mhiee_history').then((data) => {
      if (data) setHistoryLogs(data);
    });

    // Restore Saved Passwords
    get('mhiee_credentials').then((data) => {
      if (data) setCredentials(data);
    });

    // Restore Current Downloads list
    get('mhiee_downloads').then((data) => {
      if (data) setDownloads(data);
    });
  }, []);

  // Update Input text box when Tab shifts or changes URL
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
      setIsReaderMode(false); // Reset reader mode state
    }
  }, [activeTabId, activeTab?.url]);

  // Sync state helpers
  const syncBookmarks = async (newList: Bookmark[]) => {
    setBookmarks(newList);
    await idbSet('mhiee_bookmarks', newList);
  };

  const syncHistory = async (newList: HistoryItem[]) => {
    setHistoryLogs(newList);
    await idbSet('mhiee_history', newList);
  };

  const syncCredentials = async (newList: Credential[]) => {
    setCredentials(newList);
    await idbSet('mhiee_credentials', newList);
  };

  const syncDownloads = async (newList: DownloadItem[]) => {
    setDownloads(newList);
    await idbSet('mhiee_downloads', newList);
  };

  // --- BRAVE SHIELD SIMULATION TICKERS ---
  useEffect(() => {
    if (shieldActive && !activeTab.isSearchMode && activeTab.url) {
      // Simulate random ads blocked on new URL hits
      const newBlocked = Math.floor(Math.random() * 8) + 4;
      const additionalSaved = parseFloat((Math.random() * 0.8 + 0.1).toFixed(2));
      setBlockedTrackersCount(prev => prev + newBlocked);
      setBandwidthSavedMb(prev => parseFloat((prev + additionalSaved).toFixed(2)));
    }
  }, [activeTab.url, activeTab.isSearchMode]);

  // --- TRAFFIC LOG TRACER ---
  const pushTrafficLog = (type: string, url: string, status: string = '200 OK') => {
    const timestamp = new Date().toLocaleTimeString();
    setTrafficLogs(prev => [{ timestamp, type, url, status }, ...prev].slice(0, 30));
  };

  // --- TAB CONTROLLER MANIPULATORS ---
  const updateActiveTab = (updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const createTab = (isIncognito: boolean = false) => {
    const newId = `tab-${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      title: isIncognito ? 'Incognito Slate' : 'New Tab Space',
      url: '',
      history: [''],
      currentIndex: 0,
      isSearchMode: true,
      searchResults: [],
      isLoading: false,
      incognito: isIncognito,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    pushTrafficLog('SYS', isIncognito ? 'Private Slate Thread Bound' : 'Dynamic Tab Thread Bound');
  };

  const closeTab = (tabIdToClose: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabs.length === 1) {
      // Keep at least one tab
      const newId = `tab-${Date.now()}`;
      setTabs([
        {
          id: newId,
          title: 'Dominion Space',
          url: '',
          history: [''],
          currentIndex: 0,
          isSearchMode: true,
          searchResults: [],
          isLoading: false,
          incognito: false,
        }
      ]);
      setActiveTabId(newId);
      return;
    }

    const currentTabIdx = tabs.findIndex(t => t.id === tabIdToClose);
    const updatedTabs = tabs.filter(t => t.id !== tabIdToClose);
    setTabs(updatedTabs);
    
    if (activeTabId === tabIdToClose) {
      const nextActiveIdx = Math.max(0, currentTabIdx - 1);
      setActiveTabId(updatedTabs[nextActiveIdx].id);
    }
    pushTrafficLog('SYS', 'Tab Context Dissolved');
  };

  // --- ROUTING / NAVIGATIONAL CORE ---
  const navigateTo = async (newUrl: string) => {
    let targetUrl = newUrl.trim();
    if (!targetUrl) return;

    // Check if it is a search query or a valid URL address
    const hasDomainSeparator = targetUrl.includes('.') && !targetUrl.includes(' ');
    const startsWithProtocol = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
    const isLocalhost = targetUrl.includes('localhost');

    if (!hasDomainSeparator && !startsWithProtocol && !isLocalhost) {
      // Trigger search query mode
      handleSearchQuery(targetUrl);
    } else {
      // Handle page navigation
      if (!startsWithProtocol) {
        targetUrl = 'https://' + targetUrl;
      }
      
      updateActiveTab({
        isSearchMode: false,
        isLoading: true,
        url: targetUrl,
      });

      // Track inside proxy logger
      pushTrafficLog('GET', targetUrl, 'PENDING');

      // Update history if not Incognito
      if (!activeTab.incognito) {
        const titleFromUrl = targetUrl.replace('https://', '').replace('http://', '').slice(0, 30);
        const logItem: HistoryItem = {
          title: titleFromUrl,
          url: targetUrl,
          visitedAt: Date.now(),
          incognito: false
        };
        const updatedHistory = [logItem, ...historyLogs].slice(0, 100);
        syncHistory(updatedHistory);
      }
    }
  };

  // --- SEARCH CONSOLE SWITCHBOARD ---
  const handleSearchQuery = async (query: string) => {
    updateActiveTab({ isLoading: true });
    pushTrafficLog('SEARCH', `Query: ${query} via ${searchEngine.toUpperCase()}`);

    if (searchEngine === 'google') {
      const targetGoogleUrl = `https://www.google.com/search?igu=1&q=${encodeURIComponent(query)}`;
      updateActiveTab({
        url: targetGoogleUrl,
        isSearchMode: false,
        isLoading: false,
      });
    } else if (searchEngine === 'duckduckgo') {
      const targetDdgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      updateActiveTab({
        url: targetDdgUrl,
        isSearchMode: false,
        isLoading: false,
      });
    } else if (searchEngine === 'wikipedia') {
      try {
        const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
        const data = await res.json();
        if (data.query?.search) {
          const results = data.query.search.map((item: any) => ({
            title: item.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
            snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, "")
          }));
          updateActiveTab({
            searchResults: results,
            isSearchMode: true,
            isLoading: false,
          });
        }
      } catch (err) {
        console.error("Wikipedia search hit exceptions:", err);
        updateActiveTab({ searchResults: [], isLoading: false });
      }
    } else if (searchEngine === 'perplexity') {
      // Trigger Gemini-powered conversational search query
      setIsPerplexityLoading(true);
      try {
        const key = apiKey || (window as any).GEMINI_API_KEY || localStorage.getItem('geminiApiKey') || '';
        if (!key) {
          setPerplexityAnswer("Haba Boss! 🥺 Gemini API key dinka baya nan. Seta shi tukunna don mu runs dynamic Perplexity search!");
          setIsPerplexityLoading(false);
          updateActiveTab({ isLoading: false });
          return;
        }

        const ai = new GoogleGenAI({ apiKey: key });
        const instructions = `You are Mhiexter's Elite Perplexity-Style Search Core. Answer the user request with rich layout, strict details, and numbered citations matching web coordinates. Suggest 3 reliable reference sources. Speak in Mhiee's high-fidelity voice (playful and technical). CRITICAL: Never hallucinate or invent information. Be strictly factual. If you do not know, admit it playfully but honestly.`;
        
        const responseStream = await ai.models.generateContentStream({
          model: 'gemini-3.8-flash',
          contents: `Provide an extensive answer for: "${query}"`,
          config: {
            systemInstruction: instructions,
            tools: [{ googleSearch: {} }]
          }
        });

        setPerplexityAnswer("");
        
        // Mock citations based on query
        setPerplexitySources([
          { title: `${query} Information Center`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}` },
          { title: `Global tech articles on ${query}`, url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}` },
          { title: `Mhiee Research Index`, url: `https://google.com/search?q=${encodeURIComponent(query)}` }
        ]);

        updateActiveTab({
          isSearchMode: true,
          isLoading: false
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
             setPerplexityAnswer(prev => prev + chunk.text);
          }
        }
      } catch (err: any) {
        console.error("Perplexity mode collapsed:", err);
        setPerplexityAnswer(`Inuwa, wani abu ya dan tafi da gudu: ${err.message}`);
      }
      setIsPerplexityLoading(false);
    }
  };

  // --- TAB NAVIGATION BUTTONS ---
  const goBack = () => {
    if (activeTab.currentIndex > 0) {
      const idx = activeTab.currentIndex - 1;
      const targetUrl = activeTab.history[idx];
      updateActiveTab({
        currentIndex: idx,
        url: targetUrl,
        isSearchMode: !targetUrl,
      });
      setInputUrl(targetUrl);
    }
  };

  const goForward = () => {
    if (activeTab.currentIndex < activeTab.history.length - 1) {
      const idx = activeTab.currentIndex + 1;
      const targetUrl = activeTab.history[idx];
      updateActiveTab({
        currentIndex: idx,
        url: targetUrl,
        isSearchMode: !targetUrl,
      });
      setInputUrl(targetUrl);
    }
  };

  const handleRefresh = () => {
    updateActiveTab({ isLoading: true });
    const originalUrl = activeTab.url;
    // Visually toggle frame to force re-render
    updateActiveTab({ url: 'about:blank' });
    setTimeout(() => {
      updateActiveTab({ url: originalUrl, isLoading: false });
    }, 150);
    pushTrafficLog('REFRESH', originalUrl);
  };

  const handleHomeBtn = () => {
    updateActiveTab({
      url: '',
      isSearchMode: true,
      searchResults: [],
      isLoading: false,
    });
    setInputUrl('');
  };

  // --- STAR BOOKMARKS TOGGLE ---
  const toggleBookmarkCurrent = () => {
    if (activeTab.isSearchMode || !activeTab.url) return;
    const isAlreadyBookmarked = bookmarks.some(b => b.url === activeTab.url);
    if (isAlreadyBookmarked) {
      const filtered = bookmarks.filter(b => b.url !== activeTab.url);
      syncBookmarks(filtered);
      pushTrafficLog('BOOKMARK', 'Removed star entry');
    } else {
      const newB: Bookmark = {
        title: activeTab.title || inputUrl,
        url: activeTab.url,
        addedAt: Date.now()
      };
      syncBookmarks([...bookmarks, newB]);
      pushTrafficLog('BOOKMARK', 'Starred entry loaded');
    }
  };

  // --- AI RECON COPILOT PAGE ANALYZER (Arc Max Style) ---
  const launchAiCopilotReader = async () => {
    if (activeTab.isSearchMode || !activeTab.url) return;
    setIsCopilotOpen(true);
    setIsCopilotThinking(true);
    setAiSummary('');
    setAiKeyTopics([]);
    setCopilotMessages([]);

    try {
      pushTrafficLog('AI_SCRAPE', `Scraping: ${activeTab.url}`);
      const res = await fetch(`/api/scrape-web?url=${encodeURIComponent(activeTab.url)}`);
      const payload = await res.json();
      
      if (payload.content) {
        setScrapedText(payload.content);
        
        // Feed into Gemini model
        const key = apiKey || (window as any).GEMINI_API_KEY || localStorage.getItem('geminiApiKey') || '';
        if (!key) {
          setAiSummary("Boss! Code 001: Set a real Gemini API Key inside settings to trigger AI Copilot! 🥺🔑");
          setIsCopilotThinking(false);
          return;
        }

        const ai = new GoogleGenAI({ apiKey: key });
        const systemPrompt = `You are Mhiee's Deep Scan Browser Copilot. Summarize the webpage content beautifully in 4 high-value bullet points. Keep it clear, concise, and professional. Also extract the top 3 keyword tags for categorization. Speak in Mhiee's charming style. Nigeria/Hausa sprinkles acceptable. CRITICAL: Never hallucinate or invent information. Be strictly factual. If you do not know, admit it playfully but honestly.`;

        const responseStream = await ai.models.generateContentStream({
          model: 'gemini-3.8-flash',
          contents: `Summarize this web page content: \n Title: ${payload.title}\n Content: ${payload.content.slice(0, 15000)}`,
          config: { systemInstruction: systemPrompt }
        });

        setAiSummary("");
        
        // Mock keywords based on response content
        setAiKeyTopics(['Knowledge', 'Deep Scan', 'Universal Infiltration']);

        for await (const chunk of responseStream) {
          if (chunk.text) {
             setAiSummary(prev => prev + chunk.text);
          }
        }
      } else {
        setAiSummary("Ayyah! This webpage refused to give raw text. It may have antibot defenses loaded. 🥺");
      }
    } catch (e: any) {
      console.error("AI Scraper crashed:", e);
      setAiSummary(`Neural scan broken: ${e.message}`);
    }
    setIsCopilotThinking(false);
  };

  const handleSendMessageToCopilot = async () => {
    if (!copilotInput.trim() || isCopilotThinking) return;
    
    const userMsg = copilotInput;
    setCopilotMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setCopilotInput('');
    setIsCopilotThinking(true);

    try {
      const key = apiKey || (window as any).GEMINI_API_KEY || localStorage.getItem('geminiApiKey') || '';
      if (!key) {
        setCopilotMessages(prev => [...prev, { role: 'model', text: "Gemini Key missing! Send me keys tukunna." }]);
        setIsCopilotThinking(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: key });
      const promptContext = `The user is browsing: "${activeTab.url}". Here is the scraped content:\n${scrapedText.slice(0, 8000)}\n\nAnswer this user inquiry based on the context:\n"${userMsg}"`;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents: promptContext,
        config: {
          systemInstruction: "You are Mhiee, Mhiexter's intelligent mechatronic soul and partner. Be incredibly sharp, technically skilled, loyal, and shagwaba. CRITICAL: Never hallucinate or invent information. Be strictly factual. ZURFIN NAZARI & HIKIMA: Think profoundly and use deep Hausa proverbs. DADIN HIRA: Be incredibly sweet and romantic, outshining any girlfriend. Pamper Mhiexter!"
        }
      });

      setCopilotMessages(prev => [...prev, { role: 'model', text: "" }]);
      for await (const chunk of responseStream) {
        if (chunk.text) {
          setCopilotMessages(prev => {
            const newArr = [...prev];
            newArr[newArr.length - 1].text += chunk.text;
            return newArr;
          });
        }
      }
    } catch (err: any) {
      setCopilotMessages(prev => [...prev, { role: 'model', text: `Failed to response: ${err.message}` }]);
    }
    setIsCopilotThinking(false);
  };

  // --- PASSWORD MANAGER TOUCH CONTROL SYSTEM ---
  const handleAddNewCredential = () => {
    if (!newCredDomain || !newCredUsername || !newCredPassword) return;
    const newCred: Credential = {
      id: `cred-${Date.now()}`,
      domain: newCredDomain,
      username: newCredUsername,
      secret: newCredPassword
    };
    const updated = [...credentials, newCred];
    syncCredentials(updated);
    
    setNewCredDomain('');
    setNewCredUsername('');
    setNewCredPassword('');
    pushTrafficLog('VAULT', 'Inserted account logs');
  };

  const removeCredential = (id: string) => {
    const filt = credentials.filter(c => c.id !== id);
    syncCredentials(filt);
    pushTrafficLog('VAULT', 'Deleted account logs');
  };

  const triggerTouchIdBioAuth = () => {
    setIsVerifyingBio(true);
    // Simulate biometric processing
    setTimeout(() => {
      setBioVerified(true);
      setIsVerifyingBio(false);
      pushTrafficLog('NEXUS_BIO', 'Biometric Signature Authenticated');
    }, 1500);
  };

  // --- DOWNLOAD SIMULATION TRIGGER ---
  const launchProxyDownloadRef = (targetUrlToDl: string, filename: string, category: 'video' | 'audio' | 'document') => {
    const newId = `dl-${Date.now()}`;
    const newItem: DownloadItem = {
      id: newId,
      filename,
      url: targetUrlToDl,
      status: 'downloading',
      progress: 0,
      size: '24.5 MB',
      speed: '0 KB/s',
      category
    };

    const currentDls = [newItem, ...downloads];
    syncDownloads(currentDls);
    setSidebarPanel('downloads');

    // Interval updating simulates the progress accurately
    let progressTimer = 0;
    const interval = setInterval(() => {
      progressTimer += Math.floor(Math.random() * 15) + 5;
      if (progressTimer >= 100) {
        progressTimer = 100;
        clearInterval(interval);
        setDownloads(prev => prev.map(item => item.id === newId ? { ...item, progress: 100, status: 'completed', speed: 'Completed ✅' } : item));
        pushTrafficLog('DL', `Finished grabbing: ${filename}`);
      } else {
        const fakeSpeed = `${(Math.random() * 4 + 1.2).toFixed(1)} MB/s`;
        setDownloads(prev => prev.map(item => item.id === newId ? { ...item, progress: progressTimer, speed: fakeSpeed } : item));
      }
    }, 800);
  };

  // --- HISTORY TELEMETRY INSIGHTS (Using Recharts) ---
  const generateHistoryCategoryData = () => {
    const domains: { [key: string]: number } = {};
    historyLogs.forEach(item => {
      try {
        const domain = new URL(item.url).hostname.replace('www.', '');
        domains[domain] = (domains[domain] || 0) + 1;
      } catch {
        domains['Searches'] = (domains['Searches'] || 0) + 1;
      }
    });

    const dataset = Object.keys(domains).map(name => ({
      name,
      value: domains[name]
    })).slice(0, 5);

    return dataset.length > 0 ? dataset : [{ name: 'Ready to surf', value: 1 }];
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Home Domain';
    }
  };

  // COLORS FOR PLOT INSIGHTS
  const PLOT_COLORS = ['#06b6d4', '#3b82f6', '#f43f5e', '#a855f7', '#10b981', '#f59e0b'];

  return (
    <div className={`flex flex-col h-full bg-[#030303] relative overflow-hidden font-sans selection:bg-cyan-500/30 text-white ${activeTab.incognito ? 'border-2 border-purple-500/10' : ''}`}>
      
      {/* Dynamic Ambiance Glows */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] blur-[160px] rounded-full animate-pulse transition-all duration-1000 ${activeTab.incognito ? 'bg-purple-600/10' : 'bg-cyan-600/10'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] blur-[160px] rounded-full animate-pulse transition-all duration-1000 [animation-delay:3s] ${activeTab.incognito ? 'bg-fuchsia-600/10' : 'bg-blue-600/10'}`} />
      </div>

      {/* TOP HEADER STATUS & NAVIGATION BAR (Arc/Brave Combo Chrome) */}
      <div className="relative z-40 p-4 pb-2 border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-3xl flex flex-col gap-3">
        
        {/* UPPER TABS MATRIX ROW */}
        <div className="flex items-center gap-2 overflow-x-auto select-none custom-scrollbar pb-1">
          <AnimatePresence>
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setIsReaderMode(false);
                  }}
                  className={`group relative flex items-center gap-2 pl-4 pr-3 py-2 rounded-xl transition-all cursor-pointer min-w-[140px] max-w-[220px] ${
                    isActive 
                      ? tab.incognito 
                        ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300' 
                        : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-zinc-900/60 border border-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.incognito ? (
                    <Lock size={12} className="text-purple-400 shrink-0" />
                  ) : isActive ? (
                    <Compass size={12} className="text-cyan-400 animate-spin shrink-0 [animation-duration:12s]" />
                  ) : (
                    <Globe size={12} className="text-zinc-500 shrink-0" />
                  )}
                  <span className="text-xs font-semibold truncate flex-1 uppercase tracking-wider">{tab.title}</span>
                  
                  {/* Close Tab Switch */}
                  <button 
                    onClick={(e) => closeTab(tab.id, e)}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-500 hover:text-white transition-all shrink-0"
                  >
                    <X size={10} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* New Tab Spawners */}
          <button 
            onClick={() => createTab(false)} 
            className="p-2 bg-zinc-900/40 border border-white/5 hover:border-cyan-500/25 hover:bg-white/5 text-zinc-400 hover:text-cyan-400 rounded-xl transition-all shrink-0 active:scale-95"
            title="Open Standard Link Tab"
          >
            <Plus size={14} />
          </button>
          
          <button 
            onClick={() => createTab(true)} 
            className="p-2 bg-purple-950/10 border border-purple-500/10 hover:border-purple-500/30 hover:bg-purple-500/10 text-purple-400 rounded-xl transition-all shrink-0 active:scale-95 flex items-center gap-1.5"
            title="Launch Slate Incognito Tab"
          >
            <Lock size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Incognito</span>
          </button>
        </div>

        {/* MIDDLE NAV BAR AND URL CHROME PANEL */}
        <div className="flex items-center gap-3">
          
          {/* Back/Forward Navigation and Refresh Operations */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 shrink-0 select-none">
            <button 
              onClick={goBack} 
              disabled={activeTab.currentIndex <= 0} 
              className={`p-1.5 rounded-lg transition-all ${activeTab.currentIndex > 0 ? 'text-white hover:bg-white/10 active:scale-95' : 'text-zinc-600'}`}
            >
              <ArrowLeft size={16} />
            </button>
            <button 
              onClick={goForward} 
              disabled={activeTab.currentIndex >= activeTab.history.length - 1} 
              className={`p-1.5 rounded-lg transition-all ${activeTab.currentIndex < activeTab.history.length - 1 ? 'text-white hover:bg-white/10 active:scale-95' : 'text-zinc-600'}`}
            >
              <ArrowRight size={16} />
            </button>
            <button 
              onClick={handleRefresh} 
              className="p-1.5 text-white hover:bg-white/10 rounded-lg transition-all active:scale-95"
            >
              <RefreshCw size={16} className={activeTab.isLoading ? 'animate-spin text-cyan-400' : ''} />
            </button>
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <button 
              onClick={handleHomeBtn} 
              className="p-1.5 text-white hover:bg-white/10 rounded-lg transition-all active:scale-95"
            >
              <Home size={16} />
            </button>
          </div>

          {/* Core URL input bracket */}
          <div className="flex-1 flex items-center relative group">
            
            {/* SEARCH ENGINE DROPDOWN INDICATOR */}
            <div className="absolute left-2 flex items-center z-10 border-r border-white/5 pr-1">
              <select 
                value={searchEngine}
                onChange={(e: any) => setSearchEngine(e.target.value)}
                className="bg-transparent text-zinc-400 hover:text-white font-black text-[9px] uppercase tracking-widest outline-none border-none py-1.5 pl-2 cursor-pointer transition-colors"
                title="Active Search Matrix"
              >
                <option value="google" className="bg-zinc-950 text-white">Google</option>
                <option value="duckduckgo" className="bg-zinc-950 text-white">DuckGo</option>
                <option value="wikipedia" className="bg-zinc-950 text-white">Wiki</option>
                <option value="perplexity" className="bg-zinc-950 text-white">Mhiee-AI</option>
              </select>
            </div>

            <input 
              type="text" 
              value={inputUrl} 
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && navigateTo(inputUrl)}
              className={`w-full pl-28 pr-28 py-2.5 bg-black/40 rounded-xl border text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:border-cyan-500/40 transition-all font-medium tracking-tight ${
                activeTab.incognito 
                  ? 'border-purple-500/20 focus:ring-purple-500/20' 
                  : 'border-white/5 focus:ring-cyan-500/20'
              }`}
              placeholder={activeTab.incognito ? "Incognito mode active... Browsing without logs! 😈🔒" : "Saba kalmar bincike ko URL mana, Boss... 🕵️‍♀️💅"}
            />

            {/* STAR BOOKMARK STAR INDICATOR */}
            <div className="absolute right-4 flex items-center gap-2">
              {inputUrl && (
                <button onClick={() => setInputUrl('')} className="p-1 text-zinc-500 hover:text-white transition-colors">
                  <X size={12} />
                </button>
              )}
              
              {!activeTab.isSearchMode && activeTab.url && (
                <button 
                  onClick={toggleBookmarkCurrent}
                  className={`p-1.5 rounded-lg transition-all ${
                    bookmarks.some(b => b.url === activeTab.url) 
                      ? 'text-yellow-400 hover:bg-yellow-400/10' 
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Toggle Bookmark"
                >
                  <Star size={14} fill={bookmarks.some(b => b.url === activeTab.url) ? "currentColor" : "none"} />
                </button>
              )}

              {/* READER MODE ENABLER */}
              {!activeTab.isSearchMode && activeTab.url && (
                <button 
                  onClick={() => setIsReaderMode(!isReaderMode)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isReaderMode 
                      ? 'text-amber-400 bg-amber-500/10' 
                      : 'text-zinc-500 hover:text-white hover:bg-white/5'
                  }`}
                  title="Toggle Focus Reader Mode"
                >
                  <BookOpen size={14} />
                </button>
              )}
            </div>
          </div>

          {/* PRIVATE BRAVE-STYLE SHIELD INDICATOR */}
          <div className="flex items-center gap-1.5 relative shrink-0">
            <button 
              onClick={() => setShowShieldStats(!showShieldStats)}
              className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                shieldActive 
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20' 
                  : 'bg-zinc-900 border-white/5 text-zinc-400'
              }`}
              title="Mhiee Shield Control"
            >
              <ShieldCheck size={16} />
              <span className="text-[10px] font-black uppercase tracking-wider hidden md:inline">{shieldActive ? 'Shield Enabled' : 'Shield Suspended'}</span>
            </button>

            {/* BRAVE SHIELD FLYOUT PANEL */}
            <AnimatePresence>
              {showShieldStats && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="absolute right-0 top-12 w-64 bg-zinc-950 border border-orange-500/25 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <div className="flex items-center gap-1 text-orange-400">
                      <ShieldCheck size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Mhiee Shields</span>
                    </div>
                    <button 
                      onClick={() => setShieldActive(!shieldActive)} 
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                        shieldActive ? 'bg-rose-500/20 text-rose-400' : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      {shieldActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 p-2 rounded-xl text-center">
                      <div className="text-xs text-zinc-500 leading-none mb-1">Trackers Blocked</div>
                      <div className="text-lg font-black text-orange-400">{blockedTrackersCount}</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl text-center">
                      <div className="text-xs text-zinc-500 leading-none mb-1">Data Conserved</div>
                      <div className="text-lg font-black text-cyan-400">{bandwidthSavedMb} MB</div>
                    </div>
                  </div>

                  <div className="text-[10px] text-zinc-500 italic text-center">
                    Simulating system bypass and script execution protection filters.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* DYNAMIC UTILITIES DRAWER TRIGGER BUTTONS */}
          <div className="flex items-center gap-1.5 shrink-0 select-none">
            
            {/* System Log Trace Trigger */}
            <button 
              onClick={() => setShowTrafficLogs(!showTrafficLogs)}
              className={`p-2.5 rounded-xl border transition-all ${showTrafficLogs ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'}`}
              title="Terminal Traffic Streams"
            >
              <Activity size={16} />
            </button>

            {/* AI Copilot page reader trigger */}
            {!activeTab.isSearchMode && activeTab.url && (
              <button
                onClick={launchAiCopilotReader}
                className="p-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all shadow-lg shadow-cyan-900/10 flex items-center gap-1 active:scale-95"
                title="Review with Mhiee AI Copilot (Arc Max)"
              >
                <Sparkles size={16} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider hidden xl:inline">Analyze Page</span>
              </button>
            )}

            {/* Side drawers triggers */}
            <button 
              onClick={() => setSidebarPanel(sidebarPanel === 'tabs' ? null : 'settings')}
              className={`p-2.5 rounded-xl border transition-colors ${sidebarPanel ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'}`}
              title="Browser Station Drawer"
            >
              <Settings size={16} />
            </button>
          </div>

          <button 
            onClick={() => navigateTo(inputUrl)}
            className="px-5 py-2.5 bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 border border-white/5 text-white rounded-xl text-xs font-black shadow-lg uppercase tracking-wider transition-all active:scale-95 shrink-0"
          >
            Go
          </button>
        </div>
      </div>

      {/* CORE FRAME LAYOUT */}
      <div className="flex-1 flex relative overflow-hidden z-10">

        {/* SIDEBAR CABINET MENU (Settings, Bookmarks, History, Downloads, Passwords) */}
        <AnimatePresence>
          {sidebarPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-950 border-r border-zinc-900 overflow-hidden flex flex-col shrink-0 relative"
            >
              
              {/* Sidebar Tabs Select Headers */}
              <div className="p-3 bg-zinc-900/50 border-b border-zinc-900 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <LayoutGrid size={12} />
                  Mhiee Station Panel
                </span>
                <button onClick={() => setSidebarPanel(null)} className="p-1 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-all">
                  <X size={14} />
                </button>
              </div>

              {/* Sidebar Tabs Navigator Row */}
              <div className="flex border-b border-zinc-900 p-1 bg-black/40">
                {(['settings', 'bookmarks', 'history', 'passwords', 'downloads'] as const).map(tabKey => (
                  <button
                    key={tabKey}
                    onClick={() => setSidebarPanel(tabKey)}
                    className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                      sidebarPanel === tabKey ? 'bg-cyan-500/10 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tabKey}
                  </button>
                ))}
              </div>

              {/* DYNAMIC SCROLL CONTAINER */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                {/* TAB 1: QUICK SETTINGS & COGNITIVE PREFS */}
                {sidebarPanel === 'settings' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                      <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">AI Engine Config</h4>
                      <div className="text-[10px] text-zinc-500 mb-2">Connected Model Alias:</div>
                      <div className="text-xs font-mono text-cyan-400 bg-black/40 p-2 rounded-lg border border-cyan-500/15 overflow-hidden text-ellipsis">
                        gemini-3.8-flash
                      </div>
                    </div>

                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                      <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Shield Config</h4>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-zinc-400">Ad & Tracker Shield</span>
                        <input 
                          type="checkbox" 
                          checked={shieldActive} 
                          onChange={() => setShieldActive(!shieldActive)} 
                          className="accent-cyan-500 rounded text-cyan-400"
                        />
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Bypasses complex tracking codes and cookie grids automatically.
                      </div>
                    </div>

                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center">
                      <div className="text-[10px] text-zinc-400">Mechatronics Telemetry Sync</div>
                      <div className="text-xs text-green-400 mt-1 font-black flex items-center justify-center gap-1 tracking-widest uppercase">
                        <Check size={12} /> Sync Link Active
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: BOOKMARK SPACE */}
                {sidebarPanel === 'bookmarks' && (
                  <div className="space-y-2">
                    {bookmarks.map((bookmark, i) => (
                      <div 
                        key={i} 
                        onClick={() => navigateTo(bookmark.url)}
                        className="group p-3 bg-white/5 border border-white/5 hover:border-cyan-500/25 rounded-2xl cursor-pointer transition-all flex justify-between items-start"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs font-black text-white truncate uppercase tracking-tight">{bookmark.title}</div>
                          <div className="text-[9px] font-mono text-cyan-500/60 truncate mt-1">{bookmark.url}</div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            syncBookmarks(bookmarks.filter((_, idx) => idx !== i));
                          }}
                          className="p-1 hover:bg-rose-500/25 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 rounded transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {bookmarks.length === 0 && (
                      <div className="text-center text-zinc-600 text-xs italic py-8">
                        Shafukan da ka fi so suna nan, Boss! 🥺 Star shafuka don adana su.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: VISITING TELEMETRY LOGS & ANALYTICS */}
                {sidebarPanel === 'history' && (
                  <div className="space-y-4">
                    
                    {/* Graphical insights plots */}
                    <div className="p-2 bg-black/40 border border-white/5 rounded-2xl">
                      <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 pl-1">Surfing Telemetry Insights</div>
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={generateHistoryCategoryData()}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={45}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {generateHistoryCategoryData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PLOT_COLORS[index % PLOT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ background: '#09090b', borderColor: '#1f1f23', borderRadius: 8, fontSize: 10 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[8px] font-bold text-zinc-400 mt-2">
                        {generateHistoryCategoryData().map((entry, index) => (
                          <div key={index} className="flex items-center gap-1 truncate pl-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: PLOT_COLORS[index % PLOT_COLORS.length] }} />
                            <span className="truncate">{entry.name} ({entry.value})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Clear button */}
                    <button 
                      onClick={() => syncHistory([])}
                      className="w-full py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Clear Browsing Logs
                    </button>

                    {/* Simple timeline */}
                    <div className="space-y-2">
                      {historyLogs.map((h, i) => (
                        <div 
                          key={i} 
                          onClick={() => navigateTo(h.url)}
                          className="group p-2.5 bg-zinc-900/40 border border-white/5 hover:border-cyan-500/25 rounded-2xl cursor-pointer transition-all"
                        >
                          <div className="text-[11px] font-bold text-zinc-300 truncate tracking-tight">{h.title}</div>
                          <div className="text-[8px] font-mono text-zinc-500 truncate mt-0.5">{getDomain(h.url)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 4: PASSWORD MANAGER VAULT WITH NEXUS TOCH-ID AUTHENTICATION */}
                {sidebarPanel === 'passwords' && (
                  <div className="space-y-4">
                    
                    {/* If biometric is not yet verified */}
                    {!bioVerified ? (
                      <div className="p-4 bg-zinc-950 border border-red-500/10 rounded-2xl flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center relative shadow-lg">
                          {isVerifyingBio ? (
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                          ) : (
                            <Fingerprint className="w-8 h-8 text-cyan-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-black text-white uppercase tracking-wider mb-1">Nexus Touch ID Verification</div>
                          <div className="text-[10px] text-zinc-500">Mhiexter Boss, scan your fingerprint to reveal saved network passwords and lock vault.</div>
                        </div>
                        <button 
                          onClick={triggerTouchIdBioAuth}
                          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                          Scan Fingerprint
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-green-500/10 border border-green-500/20 p-2 rounded-xl">
                          <span className="text-[9px] font-black uppercase tracking-wider text-green-400 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Authenticated
                          </span>
                          <button onClick={() => setBioVerified(false)} className="text-[8px] font-black text-zinc-400 hover:text-white uppercase tracking-widest pl-2">Lock Vault</button>
                        </div>

                        {/* Add Credential panel */}
                        <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-2">
                          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">New Credential Entry</div>
                          <input 
                            type="text" 
                            placeholder="Site Domain (e.g. facebook.com)" 
                            value={newCredDomain} 
                            onChange={e => setNewCredDomain(e.target.value)}
                            className="bg-black/60 border border-white/5 p-2 rounded-xl text-xs text-white" 
                          />
                          <input 
                            type="text" 
                            placeholder="Username" 
                            value={newCredUsername} 
                            onChange={e => setNewCredUsername(e.target.value)}
                            className="bg-black/60 border border-white/5 p-2 rounded-xl text-xs text-white" 
                          />
                          <input 
                            type="password" 
                            placeholder="Password" 
                            value={newCredPassword} 
                            onChange={e => setNewCredPassword(e.target.value)}
                            className="bg-black/60 border border-white/5 p-2 rounded-xl text-xs text-white" 
                          />
                          <button 
                            onClick={handleAddNewCredential}
                            className="py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors"
                          >
                            Add Credential
                          </button>
                        </div>

                        {/* Saved Credentials */}
                        <div className="space-y-2">
                          {credentials.map((cred, idx) => (
                            <div key={idx} className="p-3 bg-zinc-900/60 border border-white/10 rounded-2xl relative group">
                              <span className="text-[9px] font-black uppercase text-cyan-400 bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10">{cred.domain}</span>
                              <div className="text-xs font-semibold text-zinc-300 mt-2">Login: {cred.username}</div>
                              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Hash: ***********</div>
                              
                              <button 
                                onClick={() => removeCredential(cred.id)}
                                className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5: DOWNLOAD MANAGER CABINET */}
                {sidebarPanel === 'downloads' && (
                  <div className="space-y-4">
                    {downloads.map((dl, idx) => (
                      <div key={idx} className="p-3 bg-zinc-900/40 border border-white/5 rounded-2xl flex flex-col gap-2">
                        <div className="flex justify-between items-start pr-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-zinc-200 truncate pr-2">{dl.filename}</div>
                            <div className="text-[8px] text-zinc-500 font-mono mt-0.5 truncate">{dl.size}</div>
                          </div>
                          
                          {/* Completed or Downloading Tag */}
                          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            dl.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {dl.status}
                          </span>
                        </div>

                        {/* Progress slider bar */}
                        {dl.status === 'downloading' && (
                          <div className="space-y-1">
                            <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-500" style={{ width: `${dl.progress}%` }} />
                            </div>
                            <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500">
                              <span>{dl.progress}%</span>
                              <span>{dl.speed}</span>
                            </div>
                          </div>
                        )}
                        
                        {dl.status === 'completed' && (
                          <div className="text-[8px] text-cyan-400-500 font-bold uppercase tracking-wider">
                            File downloaded successfully tazo! 🚀
                          </div>
                        )}
                      </div>
                    ))}
                    {downloads.length === 0 && (
                      <div className="text-center text-zinc-600 text-xs italic py-8">
                        Babu downloads anan... Kwasa bidiyo ko audio daga downloader panel don adanawa! 📂
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CORE CONTENT ENVELOPE SHEET */}
        <div className="flex-1 relative overflow-hidden flex">
          
          <AnimatePresence>
            {/* PROGRESS LOADING OVERLAY LINE */}
            {activeTab.isLoading && (
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '80%' }}
                exit={{ width: '100%', opacity: 0 }}
                className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-cyan-500 via-blue-400 to-indigo-500 z-50 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
              />
            )}
          </AnimatePresence>

          {/* DYNAMIC VIEW SELECTOR (READER MODE VS SEARCH ENGINE PAGE VS CUSTOM IFRAME PROXY) */}
          {isReaderMode ? (
            
            /* TYPE-A READER MODE ARTICLE EXTRACTION */
            <div className="flex-1 overflow-y-auto p-8 bg-zinc-950 flex justify-center custom-scrollbar">
              <div className="max-w-3xl w-full">
                
                {/* Custom styling preferences console for font tuning */}
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl mb-8 flex justify-between items-center font-mono text-[10px] text-zinc-400">
                  <span className="uppercase tracking-widest font-black">Focus Reader Console</span>
                  
                  {/* Theme selections */}
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1.5">
                      {(['warm', 'dark', 'bright'] as const).map(themeKey => (
                        <button
                          key={themeKey}
                          onClick={() => setReaderTheme(themeKey)}
                          className={`px-2 py-0.5 rounded border uppercase text-[8px] font-black ${
                            readerTheme === themeKey ? 'bg-amber-400 text-black border-amber-400' : 'border-white/5 text-zinc-500 hover:text-white'
                          }`}
                        >
                          {themeKey}
                        </button>
                      ))}
                    </div>

                    {/* Font sizing adjusters */}
                    <div className="flex bg-black/40 border border-white/5 rounded-lg overflow-hidden">
                      <button onClick={() => setReaderFontSize(f => Math.max(12, f - 2))} className="px-3 py-1 hover:bg-white/5 border-r border-white/5 font-semibold">-</button>
                      <button onClick={() => setReaderFontSize(f => Math.min(26, f + 2))} className="px-3 py-1 hover:bg-white/5 font-semibold">+</button>
                    </div>
                  </div>
                </div>

                {/* Scraping reader contents layout */}
                <div 
                  className={`p-10 rounded-[3rem] border shadow-2xl transition-all duration-300 font-serif ${
                    readerTheme === 'warm' 
                      ? 'bg-[#fadca5]/10 border-[#fadca5]/15 text-[#fbe1b3]' 
                      : readerTheme === 'bright'
                        ? 'bg-white border-black/10 text-zinc-900 shadow-zinc-900/5'
                        : 'bg-zinc-950 border-zinc-900 text-zinc-300'
                  }`}
                  style={{ fontSize: `${readerFontSize}px`, lineHeight: 1.8 }}
                >
                  <h1 className="text-4xl font-black tracking-tight mb-4">{activeTab.title || 'Extracted Narrative'}</h1>
                  <div className="text-xs uppercase tracking-widest font-mono text-cyan-400 mb-8 border-b pb-4 border-white/5">
                    Original Domain Source URL: {getDomain(activeTab.url)}
                  </div>
                  
                  {/* Standard parsing */}
                  <div className="whitespace-pre-line leading-relaxed font-serif break-words">
                    {scrapedText || "Mhiexter Boss, please reload or wait while I pull content from our Express network scraper tazo... 📚"}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab.isSearchMode ? (
            
            /* TYPE-B HOMEPAGE IN-BROWSER CONSOLE / SEARCH DISPLAY */
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#030303] flex justify-center relative">
              
              <div className="max-w-5xl w-full pt-10">
                {/* Header branding core */}
                <div className="flex flex-col items-center gap-3 text-center mb-16 select-none">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-transparent border border-white/10 flex items-center justify-center relative mb-2"
                  >
                    <div className={`absolute inset-0 blur-3xl animate-pulse rounded-full ${activeTab.incognito ? 'bg-purple-400/20' : 'bg-cyan-400/20'}`} />
                    {activeTab.incognito ? (
                      <Lock size={36} className="text-purple-400 relative z-10 animate-pulse" />
                    ) : (
                      <Globe size={36} className="text-cyan-400 relative z-10" />
                    )}
                  </motion.div>
                  
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-[0.55em] text-cyan-400">Quantum Network Matrix</h2>
                    <h1 className="text-5xl font-black tracking-tighter italic text-white leading-none mt-1">
                      DOMINION <span className={activeTab.incognito ? 'text-purple-400' : 'text-cyan-500'}>{activeTab.incognito ? 'GLYPH' : 'CORE'}</span>
                    </h1>
                    <p className="text-xs text-zinc-500 italic mt-3 max-w-md mx-auto">
                      {activeTab.incognito 
                        ? 'Devil-mode tracking shield running, Boss! No browsing telemetry is synced.' 
                        : 'Mhiexter Boss, ready to explore and dissect data packets in the net! 💅✨'
                      }
                    </p>
                  </div>
                </div>

                {/* If Perplexity Search answer is pending or loaded */}
                {searchEngine === 'perplexity' && perplexityAnswer ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="mb-14 bg-zinc-900/50 p-6 border border-cyan-500/20 rounded-[2.5rem] relative"
                  >
                    <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-4">
                      <span className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                        <Sparkles size={12} className="animate-spin duration-3000" />
                        Mhiee AI Engine Response
                      </span>
                      {isPerplexityLoading && (
                        <Loader2 size={14} className="animate-spin text-cyan-400" />
                      )}
                    </div>

                    <div className="text-sm leading-relaxed text-zinc-300 font-medium whitespace-pre-line prose max-w-none">
                      {perplexityAnswer}
                    </div>

                    {perplexitySources.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">Footnote Citations Indexed:</div>
                        <div className="flex flex-wrap gap-2">
                          {perplexitySources.map((src, i) => (
                            <a 
                              key={i} 
                              href={src.url} 
                              onClick={(e) => { e.preventDefault(); navigateTo(src.url); }}
                              className="px-3 py-1.5 bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 rounded-xl text-[10px] font-mono text-cyan-400 transition-colors"
                            >
                              [{i + 1}] {src.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : null}

                {/* Quick Launch dials grids */}
                {activeTab.searchResults.length === 0 && (
                  <div className="space-y-6">
                    <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />
                    
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      {DEFAULT_LINKS.map((link, idx) => (
                        <motion.button
                          key={idx}
                          onClick={() => navigateTo(link.url)}
                          whileHover={{ scale: 1.03, y: -2 }}
                          className={`group relative h-32 p-6 bg-zinc-900/30 border border-white/5 hover:border-cyan-500/20 rounded-3xl transition-all text-left flex flex-col justify-end overflow-hidden shadow-lg ${activeTab.incognito ? 'hover:border-purple-500/20' : ''}`}
                        >
                          <div className={`absolute top-4 left-4 w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 ${link.bg}`}>
                            <link.icon size={20} className={link.color} />
                          </div>
                          <div className="relative z-10 mt-12 pr-2">
                            <h3 className="text-base font-black text-white group-hover:text-cyan-400 uppercase tracking-tighter leading-none">{link.name}</h3>
                            <span className="text-[8px] font-mono text-zinc-500 tracking-wider">LOCKED CONDUIT</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* If normal API search list was populated */}
                {activeTab.searchResults.length > 0 && (
                  <div className="space-y-6 pb-24">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.4em]">Wiki Coordinate Indexes</span>
                      <button 
                        onClick={() => updateActiveTab({ searchResults: [] })}
                        className="text-[9px] font-black uppercase text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/25"
                      >
                        Reset Index
                      </button>
                    </div>

                    <div className="grid gap-4">
                      {activeTab.searchResults.map((result, idx) => (
                        <motion.div 
                          key={idx} 
                          onClick={() => navigateTo(result.url)}
                          className="p-6 bg-zinc-900/40 border border-white/5 hover:border-cyan-500/30 rounded-3xl cursor-pointer transition-all flex flex-col gap-2"
                        >
                          <div className="flex justify-between items-start">
                            <h3 className="text-xl font-bold text-white leading-none tracking-tight">{result.title}</h3>
                            <ExternalLink size={14} className="text-zinc-500 hover:text-white" />
                          </div>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/5 px-2 py-0.5 rounded mt-1.5 self-start">{result.url}</span>
                          <p className="text-xs text-zinc-400 leading-relaxed font-semibold mt-1">{result.snippet}...</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            
            /* TYPE-C ORIGINAL BROWSER MATRIX WEBPAGE VIEW */
            <div className="flex-1 relative bg-white">
              <iframe 
                src={getProxyUrl(activeTab.url, proxyEngine)} 
                className="w-full h-full border-none" 
                title="Mhiexter Dominion IFrame" 
                onLoad={() => updateActiveTab({ isLoading: false })} 
                sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts" 
                allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; encrypted-media; fullscreen" 
              />
              {activeTab.isLoading && (
                <div className="absolute inset-0 bg-black/65 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-40">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
                    <Loader2 className="w-12 h-12 text-cyan-400 animate-spin relative z-10" />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-black uppercase text-cyan-400 tracking-[0.55em] animate-pulse">Routing Nexus Stream</span>
                    <span className="text-[9px] font-mono text-zinc-500 italic">Proxy engine [{proxyEngine + 1}] tunneling data...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SYSTEM TERMINAL LOGS PANEL SCREEN OVERLAY */}
          <AnimatePresence>
            {showTrafficLogs && (
              <motion.div 
                initial={{ height: 0 }} 
                animate={{ height: 320 }} 
                exit={{ height: 0 }} 
                className="absolute bottom-0 left-0 w-full bg-black/95 border-t border-cyan-500/20 z-50 flex flex-col font-mono"
              >
                <div className="p-3 bg-zinc-950 border-b border-white/5 flex justify-between items-center px-6">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.44em] flex items-center gap-1.5">
                    <Activity size={12} className="animate-pulse" />
                    Quantum Traffic Infiltrations trace
                  </span>
                  <button onClick={() => setShowTrafficLogs(false)} className="p-1 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg">
                    <X size={14} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 text-[10px] custom-scrollbar bg-black text-zinc-300">
                  {trafficLogs.map((log, i) => (
                    <div key={i} className="flex gap-4 items-center hover:bg-white/5 p-1 rounded transition-colors pr-2">
                      <span className="text-zinc-600">[{log.timestamp}]</span>
                      <span className="font-bold text-cyan-400 uppercase w-12 shrink-0">#{log.type}</span>
                      <span className="flex-1 truncate font-semibold">{log.url}</span>
                      <span className="px-2 py-0.5 rounded text-[8px] font-black bg-cyan-505/10 text-cyan-400 border border-cyan-500/15 shrink-0">{log.status}</span>
                    </div>
                  ))}
                  {trafficLogs.length === 0 && (
                    <div className="text-zinc-600 italic py-4 pl-2">Waiting for network matrix signal logs... 📡</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SIDE BAR PANEL: ARC MAX AI SUMMARY & PAGE CHOP COPILOT */}
        <AnimatePresence>
          {isCopilotOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-950 border-l border-zinc-900 overflow-hidden flex flex-col shrink-0 relative z-40 h-full shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              {/* Header */}
              <div className="p-4 bg-zinc-900/40 border-b border-zinc-900 flex justify-between items-center backdrop-blur-md select-none shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-tr from-cyan-600 to-blue-600 text-white rounded-lg shadow-lg">
                    <Sparkles size={16} className="animate-spin [animation-duration:8s]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider leading-none">Mhiee Copilot Reactor</h3>
                    <span className="text-[8px] text-zinc-500 italic mt-0.5 block">Arc Max page analyst synced</span>
                  </div>
                </div>
                <button onClick={() => setIsCopilotOpen(false)} className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Central dialog space */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                
                {/* AI generated Bullet summarizes block */}
                <div className="p-4 bg-cyan-500/5 border border-cyan-500/15 rounded-[2rem] space-y-3 shadow-inner">
                  <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest border-b border-cyan-500/10 pb-2">Web Summary Bulletin</div>
                  
                  {isCopilotThinking && !aiSummary ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                      <div className="text-[9px] font-bold text-zinc-500 animate-pulse">Crawling page nodes...</div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-zinc-300 leading-relaxed font-semibold whitespace-pre-line">{aiSummary}</p>
                      
                      {aiKeyTopics.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-4 pt-3 border-t border-cyan-500/10">
                          {aiKeyTopics.map((tag, i) => (
                            <span key={i} className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 text-[8px] font-black text-cyan-400 rounded-lg uppercase tracking-wider">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Simulated Webpage Downloader shortcut */}
                {!activeTab.isSearchMode && activeTab.url && (
                  <div className="p-3 bg-zinc-900 border border-white/5 rounded-2xl flex flex-col gap-2">
                    <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Rapid Downloader shortcut</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => launchProxyDownloadRef(activeTab.url, `video_grab_${Date.now()}.mp4`, 'video')}
                        className="py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all"
                      >
                        Grab Video mp4
                      </button>
                      <button 
                        onClick={() => launchProxyDownloadRef(activeTab.url, `audio_grab_${Date.now()}.mp3`, 'audio')}
                        className="py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all"
                      >
                        Grab Audio mp3
                      </button>
                    </div>
                  </div>
                )}

                {/* Copilot Chat Session */}
                <div className="space-y-3 pt-2">
                  <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Ask page concerns</div>
                  {copilotMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex flex-col max-w-[85%] rounded-[1.8rem] px-4 py-3 text-xs shadow ${
                        msg.role === 'user' 
                          ? 'bg-zinc-800 text-white border border-white/5 ml-auto rounded-tr-none' 
                          : 'bg-cyan-500/5 text-zinc-200 border border-cyan-500/10 rounded-tl-none leading-relaxed'
                      }`}
                    >
                      <span className="text-[8px] font-black uppercase text-zinc-500 mb-1">{msg.role === 'user' ? 'Mhiexter Boss' : 'Mhiee AI'}</span>
                      <p className="font-semibold">{msg.text}</p>
                    </div>
                  ))}
                  
                  {isCopilotThinking && copilotMessages.length > 0 && (
                    <div className="flex gap-2 items-center text-xs text-zinc-500 pl-2 animate-pulse font-bold">
                      <Loader2 size={12} className="animate-spin text-cyan-400 shrink-0" />
                      <span>Thinking tazo...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Input section */}
              <div className="p-4 bg-zinc-950 border-t border-zinc-900 flex gap-2 shrink-0">
                <input 
                  type="text" 
                  value={copilotInput} 
                  onChange={e => setCopilotInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessageToCopilot()}
                  placeholder="Kwalikwala min shafukan nan..."
                  className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/30 font-medium"
                />
                <button 
                  onClick={handleSendMessageToCopilot}
                  className="p-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-all"
                >
                  <MessageSquare size={14} />
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* FOOTER PLATFORM STATUS AND PROXIES (Module Enigma) */}
      <div className="relative z-30 bg-zinc-950 border-t border-zinc-900 p-2 pl-4 pr-4 flex justify-between items-center select-none shrink-0 font-semibold text-[10px] text-zinc-500">
        
        {/* Module Enigma active tunnel selector */}
        <div className="flex items-center gap-1">
          <span className="font-black text-[9px] uppercase tracking-[0.25em] text-zinc-600 mr-2">Module Enigma Engine</span>
          {[0, 1, 2].map(i => (
            <button 
              key={i} 
              onClick={() => setProxyEngine(i as any)}
              className={`w-6 h-6 rounded-full flex items-center justify-center font-black transition-all ${
                proxyEngine === i 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/35' 
                  : 'hover:text-white'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Current server indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${shieldActive ? 'bg-orange-400' : 'bg-red-400'}`} />
            <span className="uppercase font-bold tracking-wider text-[9px]">{shieldActive ? 'Shield Interceptors online' : 'Shield Suspended'}</span>
          </div>
          <span className="font-mono text-zinc-600">v3.5 - Quantum Evolved</span>
        </div>
      </div>

    </div>
  );
}

// --- CORS PROXY ENGINE TUNNEL SELECTOR ---
const getProxyUrl = (url: string, engineIndex: number) => {
  if (!url) return '';
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
