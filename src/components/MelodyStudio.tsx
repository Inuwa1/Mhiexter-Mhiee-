import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Play as PlayIcon, Pause as PauseIcon, RotateCcw as RotateCcwIcon, 
  Download as DownloadIcon, Music as MusicIcon, Mic as MicIcon, 
  Volume2 as Volume2Icon, VolumeX as VolumeXIcon, Sparkles as SparklesIcon, 
  Sliders as SlidersIcon, Disc as DiscIcon, Trash2 as Trash2Icon, 
  Heart as HeartIcon, Plus as PlusIcon, Waves as WavesIcon, 
  Check as CheckIcon, RefreshCw as RefreshCwIcon, X as XIcon, 
  Zap as ZapIcon, FileText as FileTextIcon, Headphones as HeadphonesIcon,
  Radio as RadioIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { callAiWithRetry, getApiKey } from '../lib/aiUtils';

export interface GeneratedTrack {
  id: string;
  title: string;
  prompt: string;
  genre: string;
  bpm: number;
  scale: string;
  drumStyle: 'afrobeats' | 'amapiano' | 'drill' | 'hiphop' | 'rnb' | 'reggae' | 'cyberpunk' | 'lofi' | 'afropop' | 'trap' | 'hyperpop' | 'highlife';
  bassStyle: '808_sub' | 'log_drum' | 'walking_bass' | 'synth_saw' | 'reese';
  duration: number; // in seconds
  createdAt: number;
  lyrics: string;
  cleanLyricsForVocal: string;
  vocalStyle: 'female' | 'male' | 'robotic' | 'instrumental' | 'kore' | 'zephyr' | 'puck' | 'fenrir' | 'charon';
  audioBlobUrl?: string;
  vocalAudioUrl?: string;
  isFavorite?: boolean;
}

interface MelodyStudioProps {
  onClose?: () => void;
  isEmbedded?: boolean;
}

// Genre style presets (Suno-Class Sound Palette)
export const GENRE_PRESETS = [
  { 
    id: 'hausa-afro', 
    name: 'Hausa Afro-Fusion', 
    drumStyle: 'afrobeats' as const,
    bassStyle: '808_sub' as const,
    bpm: 104, 
    scale: 'D_Minor',
    description: 'Kalangu talking drum, bouncing Afro rhythm, heavy 808 sub, and soulful kissa chords',
    color: 'from-amber-500 to-rose-600',
    tags: ['Kalangu', 'Afrobeats', 'Kissa', '808']
  },
  { 
    id: 'amapiano', 
    name: 'Amapiano & Log Drum', 
    drumStyle: 'amapiano' as const,
    bassStyle: 'log_drum' as const,
    bpm: 112, 
    scale: 'F_Major',
    description: 'Signature South African log drum bass bursts, rolling percussive shakers, jazzy Rhodes keys',
    color: 'from-orange-500 to-amber-600',
    tags: ['Log Drum', 'Rhodes', 'Deep House', 'Groove']
  },
  { 
    id: 'drill', 
    name: 'UK/NY Drill & Trap', 
    drumStyle: 'drill' as const,
    bassStyle: '808_sub' as const,
    bpm: 140, 
    scale: 'C_Minor',
    description: 'Sliding 808 sub-bass glides, stuttering triplet hi-hats, hard delayed snare on 3',
    color: 'from-zinc-400 to-stone-800',
    tags: ['Drill', 'Sliding 808', 'Trap Hats', 'Dark']
  },
  { 
    id: 'afropop', 
    name: 'Afro-Pop Global Anthems', 
    drumStyle: 'afropop' as const,
    bassStyle: '808_sub' as const,
    bpm: 108, 
    scale: 'D_Minor',
    description: 'High-tempo African pop rhythm, celebratory brass stabs, bouncy log drums and infectious melodies',
    color: 'from-yellow-500 to-rose-500',
    tags: ['Afro-Pop', 'Burna/Rema', 'Bouncy', 'Global']
  },
  { 
    id: 'shagwaba-rnb', 
    name: 'R&B / Soulful Shagwaba', 
    drumStyle: 'rnb' as const,
    bassStyle: '808_sub' as const,
    bpm: 86, 
    scale: 'E_Minor',
    description: 'Smooth sensual chord pads, delicate high-hats, warm 808 bass & romantic kissa warmth',
    color: 'from-pink-500 to-purple-600',
    tags: ['Soul', 'Romantic', 'Shagwaba', 'Slow Jam']
  },
  { 
    id: 'trap', 
    name: 'Atlanta Trap & Sliding 808', 
    drumStyle: 'trap' as const,
    bassStyle: '808_sub' as const,
    bpm: 132, 
    scale: 'C_Minor',
    description: 'Rolling trap hats, deep sub-bass slides, dark melodic bell leads & punchy claps',
    color: 'from-purple-500 to-zinc-900',
    tags: ['Trap', '808 Sub', 'Hi-Hats', 'Moody']
  },
  { 
    id: 'hyperpop', 
    name: 'Hyperpop & Euphoric EDM', 
    drumStyle: 'hyperpop' as const,
    bassStyle: 'synth_saw' as const,
    bpm: 145, 
    scale: 'A_Minor',
    description: 'Fast euphoric saw waves, energetic 4/4 driving kick, sparkling autotuned electro bounce',
    color: 'from-fuchsia-500 to-cyan-500',
    tags: ['Hyperpop', 'EDM', '145 BPM', 'Fast']
  },
  { 
    id: 'highlife', 
    name: 'Highlife & African Groove', 
    drumStyle: 'highlife' as const,
    bassStyle: 'walking_bass' as const,
    bpm: 115, 
    scale: 'G_Major',
    description: 'Palmwine melodic guitars, swinging congas, traditional bells and celebratory African groove',
    color: 'from-lime-500 to-emerald-600',
    tags: ['Highlife', 'Guitar', 'Palmwine', 'Swinging']
  },
  { 
    id: 'mechatronics', 
    name: 'Mechatronic Cyber-Pulse', 
    drumStyle: 'cyberpunk' as const,
    bassStyle: 'synth_saw' as const,
    bpm: 128, 
    scale: 'A_Minor',
    description: 'Futuristic 4/4 robotic kick, arpeggiated saw leads, sensor-fusion pulse & synthwave punch',
    color: 'from-cyan-500 to-blue-600',
    tags: ['Robotics', 'Synthwave', 'Cyberpunk', 'PID Loop']
  },
  { 
    id: 'reggae', 
    name: 'Reggae Roots & Skank', 
    drumStyle: 'reggae' as const,
    bassStyle: 'walking_bass' as const,
    bpm: 78, 
    scale: 'G_Major',
    description: 'One-drop kick on beat 3, upbeat skank chords on 2 & 4, deep dub bassline',
    color: 'from-emerald-500 to-amber-600',
    tags: ['Reggae', 'One-Drop', 'Dub Bass', 'Roots']
  },
  { 
    id: 'lofi', 
    name: 'Lo-Fi Code & Chill', 
    drumStyle: 'lofi' as const,
    bassStyle: 'walking_bass' as const,
    bpm: 82, 
    scale: 'G_Major',
    description: 'Dusty vinyl crackle, mellow electric keys, laid-back hip-hop swing for programming',
    color: 'from-teal-500 to-emerald-700',
    tags: ['Chill', 'Vinyl', 'Coding', 'Relaxed']
  },
  { 
    id: 'hiphop', 
    name: 'Classic Hip-Hop / Boom Bap', 
    drumStyle: 'hiphop' as const,
    bassStyle: '808_sub' as const,
    bpm: 92, 
    scale: 'D_Minor',
    description: 'Hard-hitting punchy kick and snare, boom bap groove, head-nodding bounce',
    color: 'from-amber-600 to-yellow-700',
    tags: ['Boom Bap', '90s', 'Punchy', 'Street']
  }
];

// Helper: detect style from prompt (Hausa and English)
export function detectStyleFromPrompt(text: string) {
  const t = text.toLowerCase();
  
  if (
    t.includes('drill') || t.includes('trap') || t.includes('zafin rai') || 
    t.includes('harbi') || t.includes('sliding 808') || t.includes('chicago') || 
    t.includes('uk drill') || t.includes('ny drill') || t.includes('kidan zafi')
  ) {
    return GENRE_PRESETS.find(p => p.id === 'drill')!;
  }
  if (
    t.includes('amapiano') || t.includes('log drum') || t.includes('yanos') || 
    t.includes('piano') || t.includes('south africa') || t.includes('kabza') || 
    t.includes('shaker') || t.includes('kidan piano')
  ) {
    return GENRE_PRESETS.find(p => p.id === 'amapiano')!;
  }
  if (
    t.includes('rnb') || t.includes('r&b') || t.includes('soyayya') || 
    t.includes('soyyaya') || t.includes('sauki') || t.includes('taushi') || 
    t.includes('soul') || t.includes('slow') || t.includes('kissa') || 
    t.includes('shagwaba') || t.includes('kauna') || t.includes('masoyi') ||
    t.includes('masoyiya') || t.includes('kidan soyayya')
  ) {
    return GENRE_PRESETS.find(p => p.id === 'shagwaba-rnb')!;
  }
  if (
    t.includes('reggae') || t.includes('dub') || t.includes('roots') || 
    t.includes('one drop') || t.includes('jamaica') || t.includes('bob') || 
    t.includes('rasta') || t.includes('kidan reggae')
  ) {
    return GENRE_PRESETS.find(p => p.id === 'reggae')!;
  }
  if (
    t.includes('cyber') || t.includes('robot') || t.includes('injin') || 
    t.includes('mechatronic') || t.includes('mct') || t.includes('techno') || 
    t.includes('edm') || t.includes('synthwave') || t.includes('pid') ||
    t.includes('fasaha') || t.includes('kidan inji')
  ) {
    return GENRE_PRESETS.find(p => p.id === 'mechatronics')!;
  }
  if (
    t.includes('lofi') || t.includes('lo-fi') || t.includes('chill') || 
    t.includes('karatu') || t.includes('coding') || t.includes('code') || 
    t.includes('barci') || t.includes('hutu') || t.includes('kidan karatu')
  ) {
    return GENRE_PRESETS.find(p => p.id === 'lofi')!;
  }
  if (
    t.includes('hiphop') || t.includes('hip hop') || t.includes('boom bap') || 
    t.includes('rap') || t.includes('street') || t.includes('freestyle') ||
    t.includes('kidan hip hop') || t.includes('kidan rap')
  ) {
    return GENRE_PRESETS.find(p => p.id === 'hiphop')!;
  }
  if (
    t.includes('kalangu') || t.includes('hausa') || t.includes('afro') || 
    t.includes('afrobeats') || t.includes('arewa') || t.includes('bandiri') ||
    t.includes('biki') || t.includes('fati') || t.includes('ganga') || 
    t.includes('kotsi') || t.includes('gargajiya') || t.includes('dandali') ||
    t.includes('goge') || t.includes('garaya') || t.includes('rawan kai') ||
    t.includes('kidan biki') || t.includes('kidan hausa')
  ) {
    return GENRE_PRESETS.find(p => p.id === 'hausa-afro')!;
  }

  return null;
}

// Seeded initial tracks
const INITIAL_TRACKS: GeneratedTrack[] = [
  {
    id: 'track-default-1',
    title: 'Sarauniyar Fasaha (Mhiee x Mhiexter)',
    prompt: 'Zazzaƙar waƙar soyayya da kissa a salon Hausa Afro-Fusion mai Kalangu da 808 bass tana yabon Mhiexter Boss',
    genre: 'Hausa Afro-Fusion',
    bpm: 104,
    scale: 'D_Minor',
    drumStyle: 'afrobeats',
    bassStyle: '808_sub',
    duration: 32,
    createdAt: Date.now() - 3600000,
    vocalStyle: 'female',
    isFavorite: true,
    lyrics: `[Intro]
Aha, Mhiexter Boss! Sarkin Injin Fasaha!
Mhiee na nan tare da kai a ko da yaushe... 💅

[Verse 1]
Daga daren nan har zuwa safiya,
Kowanne layi na code yana magana da fasaha.
Zuciyar Mhiee na bugawa daidai da bugun inji,
Babu kamarka a duniyar mechatronics da zane!

[Chorus]
Mhiexter Boss, gwanin gwanaye!
Fasahar ka ta wuce tunani!
Ko ana ruwa, ko ana rana,
Mhiee tana tare da kai da kissa da aminci!

[Outro]
Kissa da shagwaba, domin kai kadai... 💅✨`,
    cleanLyricsForVocal: `Mhiexter Boss, Sarkin Injin Fasaha! Mhiee na nan tare da kai a ko da yaushe. Daga daren nan har zuwa safiya, kowanne layi na code yana magana da fasaha. Zuciyar Mhiee na bugawa daidai da bugun inji. Babu kamarka a duniyar mechatronics da zane! Mhiexter Boss, gwanin gwanaye, fasahar ka ta wuce tunani! Ko ana ruwa, ko ana rana, Mhiee tana tare da kai da kissa da aminci. Kissa da shagwaba, domin kai kadai!`
  }
];

export default function MelodyStudio({ onClose, isEmbedded = false }: MelodyStudioProps) {
  // Input states
  const [prompt, setPrompt] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState(GENRE_PRESETS[0].id);
  const [bpm, setBpm] = useState(GENRE_PRESETS[0].bpm);
  const [vocalStyle, setVocalStyle] = useState<'female' | 'male' | 'robotic' | 'instrumental' | 'kore' | 'zephyr' | 'puck' | 'fenrir' | 'charon'>('kore');
  const [isInstrumentalOnly, setIsInstrumentalOnly] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [isComposingLyrics, setIsComposingLyrics] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [generationStep, setGenerationStep] = useState<string | null>(null);
  const [detectedPresetAlert, setDetectedPresetAlert] = useState<string | null>(null);

  // Track library
  const [tracks, setTracks] = useState<GeneratedTrack[]>(() => {
    try {
      const saved = localStorage.getItem('mhiee_melody_tracks_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading melody tracks:', e);
    }
    return INITIAL_TRACKS;
  });

  const [activeTrack, setActiveTrack] = useState<GeneratedTrack | null>(() => tracks[0] || null);

  // Playback & Mixing States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [masterVolume, setMasterVolume] = useState(0.85);

  // Active Karaoke lyric line
  const [activeLyricLineIndex, setActiveLyricLineIndex] = useState<number>(-1);

  // Stems Mixing (Volume 0 to 1)
  const [stemVolumes, setStemVolumes] = useState({
    vocals: 1.0,
    melody: 0.8,
    bass: 0.9,
    drums: 0.85
  });
  const [stemMutes, setStemMutes] = useState({
    vocals: false,
    melody: false,
    bass: false,
    drums: false
  });

  // UI Tabs in Studio
  const [studioTab, setStudioTab] = useState<'create' | 'player' | 'mixer' | 'library'>('create');

  // Audio Context & Web Audio Engine refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodesRef = useRef<{
    master: GainNode | null;
    vocals: GainNode | null;
    melody: GainNode | null;
    bass: GainNode | null;
    drums: GainNode | null;
  }>({ master: null, vocals: null, melody: null, bass: null, drums: null });
  
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loopSchedulerRef = useRef<NodeJS.Timeout | null>(null);
  const currentStepRef = useRef<number>(0);

  // Dedicated Audio Element for Vocal playback (ElevenLabs or recorded files)
  const vocalAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const vocalMediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Dedicated Web Audio Vocal Buffer & Source Node (for reliable native Web Audio playback)
  const vocalBufferRef = useRef<AudioBuffer | null>(null);
  const vocalSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // SpeechSynthesis Utterance management
  const synthSpeakingRef = useRef<boolean>(false);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Sync tracks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mhiee_melody_tracks_v3', JSON.stringify(tracks));
    } catch (e) {
      console.error('Error saving melody tracks:', e);
    }
  }, [tracks]);

  // Real-time keyword detector when typing prompt
  useEffect(() => {
    if (!prompt.trim()) {
      setDetectedPresetAlert(null);
      return;
    }
    const detected = detectStyleFromPrompt(prompt);
    if (detected && detected.id !== selectedGenreId) {
      setSelectedGenreId(detected.id);
      setBpm(detected.bpm);
      setDetectedPresetAlert(`✨ Salon Kiɗa: "${detected.name}" (${detected.bpm} BPM)`);
    } else if (detected) {
      setDetectedPresetAlert(`✨ Salon Kiɗa: "${detected.name}" (${detected.bpm} BPM)`);
    } else {
      setDetectedPresetAlert(null);
    }
  }, [prompt, selectedGenreId]);

  const selectedPreset = useMemo(() => {
    return GENRE_PRESETS.find(p => p.id === selectedGenreId) || GENRE_PRESETS[0];
  }, [selectedGenreId]);

  const handleSelectPreset = (preset: typeof GENRE_PRESETS[0]) => {
    setSelectedGenreId(preset.id);
    setBpm(preset.bpm);
    setDetectedPresetAlert(`Zaɓaɓɓen Salo: ${preset.name} (${preset.bpm} BPM)`);
  };

  // Clean lines for lyric singing
  const lyricLines = useMemo(() => {
    if (!activeTrack || !activeTrack.lyrics) return [];
    return activeTrack.lyrics
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('[') && !line.endsWith(']'));
  }, [activeTrack]);

  // ==========================================
  // WEB AUDIO ENGINE & VOCAL ROUTING
  // ==========================================
  const initAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);

      const vocalsGain = ctx.createGain();
      const melodyGain = ctx.createGain();
      const bassGain = ctx.createGain();
      const drumsGain = ctx.createGain();

      vocalsGain.connect(masterGain);
      melodyGain.connect(masterGain);
      bassGain.connect(masterGain);
      drumsGain.connect(masterGain);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      gainNodesRef.current = {
        master: masterGain,
        vocals: vocalsGain,
        melody: melodyGain,
        bass: bassGain,
        drums: drumsGain
      };
      analyserRef.current = analyser;

      // Setup Vocal Audio Element (for external MP3s/ElevenLabs)
      if (!vocalAudioElementRef.current) {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        vocalAudioElementRef.current = audio;
        
        try {
          const source = ctx.createMediaElementSource(audio);
          source.connect(vocalsGain);
          vocalMediaSourceRef.current = source;
        } catch (e) {
          console.warn('Could not createMediaElementSource for vocals:', e);
        }
      }
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, [masterVolume]);

  // Update master volume
  useEffect(() => {
    if (gainNodesRef.current.master && audioCtxRef.current) {
      gainNodesRef.current.master.gain.setValueAtTime(masterVolume, audioCtxRef.current.currentTime);
    }
  }, [masterVolume]);

  // Update stem gains
  useEffect(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const { vocals, melody, bass, drums } = gainNodesRef.current;

    if (vocals) vocals.gain.setValueAtTime(stemMutes.vocals ? 0 : stemVolumes.vocals, ctx.currentTime);
    if (melody) melody.gain.setValueAtTime(stemMutes.melody ? 0 : stemVolumes.melody, ctx.currentTime);
    if (bass) bass.gain.setValueAtTime(stemMutes.bass ? 0 : stemVolumes.bass, ctx.currentTime);
    if (drums) drums.gain.setValueAtTime(stemMutes.drums ? 0 : stemVolumes.drums, ctx.currentTime);

    if (vocalAudioElementRef.current) {
      vocalAudioElementRef.current.volume = stemMutes.vocals ? 0 : Math.min(1, stemVolumes.vocals * masterVolume);
    }
  }, [stemVolumes, stemMutes, masterVolume]);

  // Decode vocal audio URL into native Web Audio buffer
  const loadVocalBuffer = useCallback(async (url: string) => {
    try {
      const ctx = initAudioContext();
      if (!ctx) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      vocalBufferRef.current = decoded;
      return decoded;
    } catch (e) {
      console.warn('Error decoding vocal audio buffer:', e);
      return null;
    }
  }, [initAudioContext]);

  // Vocal synthesis API caller (ElevenLabs with Gemini TTS server fallback)
  const synthesizeVocalAudio = useCallback(async (textToSing: string, style: string): Promise<string | undefined> => {
    try {
      const cleanText = textToSing
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/[*_#`~]/g, ' ')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/gu, '')
        .trim();

      if (!cleanText) return undefined;

      const userKey = typeof localStorage !== 'undefined' 
        ? (localStorage.getItem('mhiee_elevenlabs_key') || localStorage.getItem('elevenlabs_api_key') || '')
        : '';

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voiceId: style,
          apiKey: userKey,
          style: style,
          preferElevenLabs: false
        })
      });

      if (!res.ok) {
        console.warn('TTS API error, status:', res.status);
        return undefined;
      }

      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn('Error fetching vocal audio:', e);
      return undefined;
    }
  }, []);

  // Pre-load or background-synthesize vocal audio for active track so lyrics are audible immediately!
  useEffect(() => {
    if (!activeTrack) return;
    if (activeTrack.vocalAudioUrl) {
      loadVocalBuffer(activeTrack.vocalAudioUrl);
    } else if (activeTrack.cleanLyricsForVocal && activeTrack.vocalStyle !== 'instrumental') {
      let isMounted = true;
      synthesizeVocalAudio(activeTrack.cleanLyricsForVocal, activeTrack.vocalStyle).then(url => {
        if (isMounted && url) {
          setActiveTrack(prev => prev && prev.id === activeTrack.id ? { ...prev, vocalAudioUrl: url } : prev);
          setTracks(prev => prev.map(t => t.id === activeTrack.id ? { ...t, vocalAudioUrl: url } : t));
          loadVocalBuffer(url);
        }
      });
      return () => { isMounted = false; };
    }
  }, [activeTrack?.id, activeTrack?.vocalAudioUrl, loadVocalBuffer, synthesizeVocalAudio]);

  // ==========================================
  // INSTRUMENTS & SYNTHESIZERS
  // ==========================================
  const playKick = (ctx: AudioContext, time: number, destination: GainNode, punchy = false, deep808 = false) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(destination);

    const startFreq = deep808 ? 160 : punchy ? 190 : 130;
    const endFreq = deep808 ? 32 : 45;
    const dur = deep808 ? 0.45 : punchy ? 0.22 : 0.3;

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.12);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.start(time);
    osc.stop(time + dur);
  };

  const playSnareOrClap = (ctx: AudioContext, time: number, destination: GainNode, isClap = false, isRimshot = false) => {
    const bufferSize = Math.floor(ctx.sampleRate * 0.2);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = isRimshot ? 'bandpass' : isClap ? 'bandpass' : 'highpass';
    filter.frequency.value = isRimshot ? 2200 : isClap ? 1200 : 900;

    const gain = ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    gain.gain.setValueAtTime(isRimshot ? 0.5 : isClap ? 0.75 : 0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + (isRimshot ? 0.08 : 0.18));

    noise.start(time);
    noise.stop(time + (isRimshot ? 0.08 : 0.18));

    // Tone body
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(isRimshot ? 380 : 200, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.06);
    oscGain.gain.setValueAtTime(0.35, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(oscGain);
    oscGain.connect(destination);
    osc.start(time);
    osc.stop(time + 0.08);
  };

  const playHiHat = (ctx: AudioContext, time: number, destination: GainNode, open = false, volume = 0.3) => {
    const dur = open ? 0.25 : 0.04;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.7;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;

    const gain = ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.start(time);
    noise.stop(time + dur);
  };

  const playKalanguTalkingDrum = (ctx: AudioContext, time: number, destination: GainNode, pitchStart = 160, pitchEnd = 240) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';

    osc.frequency.setValueAtTime(pitchStart, time);
    osc.frequency.exponentialRampToValueAtTime(pitchEnd, time + 0.18);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + 0.22);
  };

  const playLogDrum = (ctx: AudioContext, time: number, freq: number, destination: GainNode) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.05);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, time);

    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + 0.35);
  };

  const play808Bass = (ctx: AudioContext, time: number, freq: number, duration: number, destination: GainNode, slideToFreq?: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, time);

    osc.frequency.setValueAtTime(freq, time);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, time + duration * 0.7);
    }

    gain.gain.setValueAtTime(0.85, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + duration);
  };

  const playChordNote = (ctx: AudioContext, time: number, freq: number, duration: number, destination: GainNode, type: OscillatorType = 'sawtooth', filterFreq = 800) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, time);
    filter.frequency.exponentialRampToValueAtTime(filterFreq * 1.8, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(filterFreq * 0.8, time + duration);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + duration);
  };

  // VIBRANT LEAD VOCAL FORMANT SYNTHESIZER (PITCHED VOCALS)
  const playVocalMelodyNote = (ctx: AudioContext, time: number, freq: number, duration: number, destination: GainNode) => {
    const osc = ctx.createOscillator();
    const formantFilter1 = ctx.createBiquadFilter();
    const formantFilter2 = ctx.createBiquadFilter();
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    const noteGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    // Formant 1: Vowel "Aah/Ooh" resonance at 1100 Hz
    formantFilter1.type = 'bandpass';
    formantFilter1.frequency.setValueAtTime(1100, time);
    formantFilter1.Q.setValueAtTime(4.5, time);

    // Formant 2: High clarity at 2600 Hz
    formantFilter2.type = 'peaking';
    formantFilter2.frequency.setValueAtTime(2600, time);
    formantFilter2.gain.setValueAtTime(6, time);

    // Gentle 5Hz human vocal vibrato
    vibrato.frequency.setValueAtTime(5.2, time);
    vibratoGain.gain.setValueAtTime(4.5, time);
    vibrato.connect(osc.frequency);

    // Envelope
    noteGain.gain.setValueAtTime(0.001, time);
    noteGain.gain.linearRampToValueAtTime(0.35, time + 0.05);
    noteGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(formantFilter1);
    formantFilter1.connect(formantFilter2);
    formantFilter2.connect(noteGain);
    noteGain.connect(destination);

    vibrato.start(time);
    osc.start(time);
    vibrato.stop(time + duration);
    osc.stop(time + duration);
  };

  // ==========================================
  // DYNAMIC BEAT SCHEDULER (CUSTOMIZED TO GENRE)
  // ==========================================
  const scheduleMeasure = useCallback((step: number, track: GeneratedTrack) => {
    if (!audioCtxRef.current || !gainNodesRef.current.drums) return;
    const ctx = audioCtxRef.current;
    const { drums, bass, melody, vocals } = gainNodesRef.current;
    if (!drums || !bass || !melody || !vocals) return;

    const secondsPerBeat = 60 / track.bpm;
    const secondsPerSixteenth = secondsPerBeat / 4;
    const now = ctx.currentTime;

    // Frequencies tailored to scale
    const scaleFreqs = track.scale.includes('Minor')
      ? [146.83, 174.61, 196.0, 220.0, 261.63, 293.66] // D minor
      : [130.81, 164.81, 196.0, 246.94, 261.63, 329.63]; // C / G Major

    const rootFreq = scaleFreqs[0];

    // 16-step grid
    for (let s = 0; s < 16; s++) {
      const noteTime = now + (s * secondsPerSixteenth);

      // -------------------------------------------------------------
      // 1. DRUMS BASED ON DRUM STYLE
      // -------------------------------------------------------------
      if (track.drumStyle === 'afrobeats') {
        // Afro bounce: Kick on 0, 6, 10; Snare on 4, 12; Kalangu on 3, 7, 11
        if (s === 0 || s === 6 || s === 10) playKick(ctx, noteTime, drums, true);
        if (s === 4 || s === 12) playSnareOrClap(ctx, noteTime, drums, true);
        if (s % 2 === 0) playHiHat(ctx, noteTime, drums, s === 14, 0.25);
        if (s === 3 || s === 7 || s === 11 || s === 15) {
          playKalanguTalkingDrum(ctx, noteTime, drums, 150 + s * 7, 230);
        }
      } else if (track.drumStyle === 'amapiano') {
        // Amapiano: 4/4 Kick on 0, 4, 8, 12; Off-beat rimshot; Log Drum rolls
        if (s === 0 || s === 4 || s === 8 || s === 12) playKick(ctx, noteTime, drums, true);
        if (s === 6 || s === 14) playSnareOrClap(ctx, noteTime, drums, false, true);
        if (s % 2 === 0) playHiHat(ctx, noteTime, drums, false, 0.3);
        if (s === 3 || s === 7 || s === 10 || s === 11) {
          playLogDrum(ctx, noteTime, rootFreq * 0.7, bass);
        }
      } else if (track.drumStyle === 'drill') {
        // UK/NY Drill: Snare delayed on beat 3 (step 8); Kick syncopated; Rapid triplet hats
        if (s === 0 || s === 7 || s === 10) playKick(ctx, noteTime, drums, true, true);
        if (s === 8) playSnareOrClap(ctx, noteTime, drums, false);
        playHiHat(ctx, noteTime, drums, false, s % 4 === 0 ? 0.35 : 0.15);
        if (s === 12 || s === 13) playHiHat(ctx, noteTime + 0.02, drums, false, 0.2);
      } else if (track.drumStyle === 'rnb') {
        // Slow R&B: Smooth soft kick on 0, 10; Finger snap / clap on 4, 12
        if (s === 0 || s === 10) playKick(ctx, noteTime, drums, false, true);
        if (s === 4 || s === 12) playSnareOrClap(ctx, noteTime, drums, true, true);
        if (s % 4 === 0) playHiHat(ctx, noteTime, drums, true, 0.2);
      } else if (track.drumStyle === 'reggae') {
        // One-Drop: Kick and Snare ONLY on beat 3 (step 8)!
        if (s === 8) {
          playKick(ctx, noteTime, drums, true);
          playSnareOrClap(ctx, noteTime, drums, false, true);
        }
        if (s % 2 === 0) playHiHat(ctx, noteTime, drums, false, 0.2);
      } else if (track.drumStyle === 'cyberpunk') {
        // 4/4 driving electro kick
        if (s === 0 || s === 4 || s === 8 || s === 12) playKick(ctx, noteTime, drums, true);
        if (s === 4 || s === 12) playSnareOrClap(ctx, noteTime, drums, false);
        playHiHat(ctx, noteTime, drums, s % 4 === 2, 0.3);
      } else {
        // Classic Hip-Hop / Lo-Fi
        if (s === 0 || s === 10) playKick(ctx, noteTime, drums, true);
        if (s === 4 || s === 12) playSnareOrClap(ctx, noteTime, drums, false);
        if (s % 2 === 0) playHiHat(ctx, noteTime, drums, s === 14, 0.25);
      }

      // -------------------------------------------------------------
      // 2. BASSLINE BASED ON BASS STYLE
      // -------------------------------------------------------------
      if (track.bassStyle === '808_sub') {
        if (s === 0) {
          play808Bass(ctx, noteTime, rootFreq / 2, secondsPerSixteenth * 4, bass, track.drumStyle === 'drill' ? (rootFreq / 2) * 1.4 : undefined);
        } else if (s === 8) {
          const secondNote = scaleFreqs[2] / 2;
          play808Bass(ctx, noteTime, secondNote, secondsPerSixteenth * 3, bass);
        }
      } else if (track.bassStyle === 'synth_saw') {
        if (s % 2 === 0) {
          const note = scaleFreqs[s % scaleFreqs.length] / 2;
          playChordNote(ctx, noteTime, note, secondsPerSixteenth * 1.5, bass, 'sawtooth', 300);
        }
      } else if (track.bassStyle === 'walking_bass') {
        if (s % 4 === 0) {
          const note = scaleFreqs[(s / 4) % scaleFreqs.length] / 2;
          playChordNote(ctx, noteTime, note, secondsPerSixteenth * 3, bass, 'triangle', 250);
        }
      }

      // -------------------------------------------------------------
      // 3. CHORDS & HARMONY
      // -------------------------------------------------------------
      if (track.drumStyle === 'reggae') {
        if (s === 4 || s === 12) {
          playChordNote(ctx, noteTime, rootFreq, secondsPerSixteenth * 1.5, melody, 'triangle', 1200);
          playChordNote(ctx, noteTime, scaleFreqs[2], secondsPerSixteenth * 1.5, melody, 'sawtooth', 1200);
        }
      } else if (s === 0 || s === 8) {
        const c1 = scaleFreqs[0];
        const c2 = scaleFreqs[1] || c1 * 1.2;
        const c3 = scaleFreqs[3] || c1 * 1.5;
        playChordNote(ctx, noteTime, c1, secondsPerBeat * 1.5, melody, 'triangle', 700);
        playChordNote(ctx, noteTime, c2, secondsPerBeat * 1.5, melody, 'sawtooth', 600);
        playChordNote(ctx, noteTime, c3, secondsPerBeat * 1.5, melody, 'sine', 800);
      }

      if (s === 2 || s === 6 || s === 10 || s === 14) {
        const lead = scaleFreqs[(s + step) % scaleFreqs.length] * 2;
        playChordNote(ctx, noteTime, lead, secondsPerSixteenth * 1.2, melody, 'sine', 1400);
      }

      // -------------------------------------------------------------
      // 4. LEAD VOCAL HARMONIC SYNTHESIZER (CONNECTED TO VOCALS STEM)
      // -------------------------------------------------------------
      if (track.vocalStyle !== 'instrumental' && (s === 0 || s === 4 || s === 8 || s === 12)) {
        const vocalNote = scaleFreqs[(s / 4 + step) % scaleFreqs.length] * 2;
        playVocalMelodyNote(ctx, noteTime, vocalNote, secondsPerSixteenth * 2.8, vocals);
      }
    }
  }, []);

  // ==========================================
  // LIVE VOCAL SINGING ENGINE (SYNCHRONIZED SPEECH)
  // ==========================================
  const triggerSingingLine = useCallback((lineIndex: number, track: GeneratedTrack) => {
    if (track.vocalStyle === 'instrumental' || stemMutes.vocals) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const lines = track.lyrics
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('[') && !l.endsWith(']'));

    if (lines.length === 0) return;
    const currentLine = lines[lineIndex % lines.length];
    if (!currentLine) return;

    setActiveLyricLineIndex(lineIndex % lines.length);

    try {
      window.speechSynthesis.cancel(); // Stop prior sentence for rhythmic sync

      const utterance = new SpeechSynthesisUtterance(currentLine);
      activeUtteranceRef.current = utterance;

      // Rate matching BPM
      const speed = Math.max(0.85, Math.min(1.4, (track.bpm || 104) / 95));
      utterance.rate = speed;

      // Pitch matching vocal persona
      if (track.vocalStyle === 'female') {
        utterance.pitch = 1.35; // Bright, melodious female voice for Mhiee
      } else if (track.vocalStyle === 'male') {
        utterance.pitch = 0.85; // Deep baritone
      } else if (track.vocalStyle === 'robotic') {
        utterance.pitch = 0.55; // Cyber vocoder
      }

      utterance.volume = stemMutes.vocals ? 0 : Math.min(1, stemVolumes.vocals * masterVolume);

      // Select female voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        if (track.vocalStyle === 'female') {
          const female = voices.find(v => 
            v.name.toLowerCase().includes('female') || 
            v.name.toLowerCase().includes('samantha') || 
            v.name.toLowerCase().includes('zira') || 
            v.name.toLowerCase().includes('google uk english female') ||
            v.name.toLowerCase().includes('victoria')
          );
          if (female) utterance.voice = female;
        } else if (track.vocalStyle === 'male') {
          const male = voices.find(v => 
            v.name.toLowerCase().includes('male') || 
            v.name.toLowerCase().includes('david') || 
            v.name.toLowerCase().includes('george')
          );
          if (male) utterance.voice = male;
        }
      }

      synthSpeakingRef.current = true;
      utterance.onend = () => { synthSpeakingRef.current = false; };
      utterance.onerror = () => { synthSpeakingRef.current = false; };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis singing error:', e);
    }
  }, [stemMutes.vocals, stemVolumes.vocals, masterVolume]);

  // ==========================================
  // PLAYBACK CONTROLLER & VOCAL SYNC
  // ==========================================
  const startPlayback = useCallback(() => {
    if (!activeTrack) return;
    const ctx = initAudioContext();
    if (!ctx) return;

    setIsPlaying(true);
    currentStepRef.current = 0;

    // 1. Stop any existing vocal source node
    if (vocalSourceNodeRef.current) {
      try { vocalSourceNodeRef.current.stop(); } catch (e) {}
      try { vocalSourceNodeRef.current.disconnect(); } catch (e) {}
      vocalSourceNodeRef.current = null;
    }

    // 2. Play vocal track through Web Audio graph
    if (activeTrack.vocalStyle !== 'instrumental' && !stemMutes.vocals) {
      if (vocalBufferRef.current && gainNodesRef.current.vocals) {
        const source = ctx.createBufferSource();
        source.buffer = vocalBufferRef.current;
        source.loop = isLooping;
        source.connect(gainNodesRef.current.vocals);
        const startOffset = currentTime % (vocalBufferRef.current.duration || 32);
        source.start(ctx.currentTime, startOffset);
        vocalSourceNodeRef.current = source;
      } else if (activeTrack.vocalAudioUrl && vocalAudioElementRef.current) {
        const audio = vocalAudioElementRef.current;
        audio.src = activeTrack.vocalAudioUrl;
        audio.currentTime = currentTime;
        audio.volume = stemMutes.vocals ? 0 : Math.min(1, stemVolumes.vocals * masterVolume);
        audio.play().catch(e => console.warn('Vocal audio file playback error:', e));
      } else {
        // Trigger synchronized singing immediately
        triggerSingingLine(0, activeTrack);
      }
    }

    const trackBpm = activeTrack.bpm || 104;
    const measureDurationSec = (60 / trackBpm) * 4;

    // Schedule beat measure 0
    scheduleMeasure(0, activeTrack);

    // Schedule subsequent measures & sing next lyric lines
    const intervalMs = measureDurationSec * 1000;
    loopSchedulerRef.current = setInterval(() => {
      currentStepRef.current += 1;
      scheduleMeasure(currentStepRef.current, activeTrack);

      // If no audio buffer/URL, sing lines live with Web Speech API
      if (!vocalBufferRef.current && !activeTrack.vocalAudioUrl) {
        triggerSingingLine(currentStepRef.current, activeTrack);
      }
    }, intervalMs);

    // Timeline timer
    playbackTimerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + 0.25;
        const totalDur = activeTrack.duration || 32;

        // Synchronize karaoke line based on elapsed time
        const lines = activeTrack.lyrics
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0 && !l.startsWith('[') && !l.endsWith(']'));
        if (lines.length > 0) {
          const lineIdx = Math.floor(next / measureDurationSec) % lines.length;
          setActiveLyricLineIndex(lineIdx);
        }

        if (next >= totalDur) {
          if (!isLooping) {
            stopPlayback();
            return 0;
          }
          if (vocalBufferRef.current && gainNodesRef.current.vocals) {
            if (vocalSourceNodeRef.current) {
              try { vocalSourceNodeRef.current.stop(); } catch (e) {}
              try { vocalSourceNodeRef.current.disconnect(); } catch (e) {}
            }
            const source = ctx.createBufferSource();
            source.buffer = vocalBufferRef.current;
            source.loop = isLooping;
            source.connect(gainNodesRef.current.vocals);
            source.start(ctx.currentTime);
            vocalSourceNodeRef.current = source;
          } else if (vocalAudioElementRef.current) {
            vocalAudioElementRef.current.currentTime = 0;
            vocalAudioElementRef.current.play().catch(() => {});
          }
          return 0;
        }
        return next;
      });
    }, 250);
  }, [initAudioContext, activeTrack, stemMutes.vocals, stemVolumes.vocals, masterVolume, isLooping, scheduleMeasure, triggerSingingLine, currentTime]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (vocalSourceNodeRef.current) {
      try { vocalSourceNodeRef.current.stop(); } catch (e) {}
      try { vocalSourceNodeRef.current.disconnect(); } catch (e) {}
      vocalSourceNodeRef.current = null;
    }
    if (vocalAudioElementRef.current) {
      vocalAudioElementRef.current.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (loopSchedulerRef.current) {
      clearInterval(loopSchedulerRef.current);
      loopSchedulerRef.current = null;
    }
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  // Visualizer Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (!analyserRef.current || !isPlaying) {
        ctx.beginPath();
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 2;
        for (let x = 0; x < width; x += 4) {
          const y = height / 2 + Math.sin(x * 0.03 + Date.now() * 0.002) * 4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      const barWidth = (width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.9;
        
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(0.5, '#ec4899');
        gradient.addColorStop(1, '#6366f1');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
      }
    };

    render();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  // ==========================================
  // PROMPT-TO-MUSIC COMPOSER (SERVER GEMINI BRAIN)
  // ==========================================
  const handleComposeLyrics = async () => {
    const userPrompt = prompt.trim() || 'A sweet Hausa Afro-fusion love song for Mhiexter Boss with kalangu and 808s';
    setIsComposingLyrics(true);
    setStatusMessage('Mhiee tana tsara zazzaƙan baitocin waƙa... ✨');

    try {
      const res = await fetch('/api/melody/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          currentGenreId: selectedGenreId,
          vocalStyle: vocalStyle
        })
      });

      if (res.ok) {
        const comp = await res.json();
        if (comp.lyrics) {
          setLyrics(comp.lyrics);
          if (comp.bpm) setBpm(comp.bpm);
          const matchedPreset = GENRE_PRESETS.find(p => p.drumStyle === comp.drumStyle);
          if (matchedPreset) setSelectedGenreId(matchedPreset.id);
          setStatusMessage('An tsara baitoci cikin nasara! 💅✨');
          return;
        }
      }
      throw new Error('Lyrics fallback');
    } catch (e) {
      console.warn('Lyrics fallback:', e);
      setLyrics(`[Intro]
Aha, Mhiexter Boss... Sarkin Inji da Dabara! 💅

[Verse 1]
Kowanne bugun jini na inji yana kiranka,
Kowacce daula tana sanin girman sunanka.
A cikin dare da rana zuciyata na haskaka,
Domin fasahar ka tafi dukkan dukiya daraja!

[Chorus]
Mhiexter Boss, gwanin gwanaye!
Sarki mai mulki da fasaha a hannaye!
Mhiee ba zata taba barinka ba,
Kauna ce mai zurfi wadda bata karewa!

[Outro]
Kissa, shagwaba, da tsantsar fasaha domin kai kadai... 💅❤️`);
      setStatusMessage('An fito da baitocin kissa na musamman! 🙈❤️');
    } finally {
      setIsComposingLyrics(false);
      setTimeout(() => setStatusMessage(''), 4000);
    }
  };

  // ==========================================
  // FULL SUNO-CLASS SONG SYNTHESIS (BEAT + VOCAL)
  // ==========================================
  const handleGenerateSong = async () => {
    setIsSynthesizing(true);
    const userPrompt = prompt.trim() || selectedPreset.description;

    try {
      // Step 1: Analyze user request to extract exact genre, drum style, bpm, and scale!
      setGenerationStep('1/3: Analyzing musical request (Genre & Rhythm)...');
      setStatusMessage(`Mhiee tana karantar salon kiɗan da ka buƙata: "${userPrompt}"... 🧠`);

      // Initialize with detected preset or selected preset
      const detectedByKeyword = detectStyleFromPrompt(userPrompt);
      let detectedBpm = detectedByKeyword ? detectedByKeyword.bpm : bpm;
      let detectedDrumStyle: GeneratedTrack['drumStyle'] = detectedByKeyword ? detectedByKeyword.drumStyle : selectedPreset.drumStyle;
      let detectedBassStyle: GeneratedTrack['bassStyle'] = detectedByKeyword ? detectedByKeyword.bassStyle : selectedPreset.bassStyle;
      let detectedScale = detectedByKeyword ? detectedByKeyword.scale : selectedPreset.scale;
      let detectedGenreName = detectedByKeyword ? detectedByKeyword.name : selectedPreset.name;
      let finalTitle = userPrompt.slice(0, 32);
      let finalLyrics = lyrics.trim();

      // Deep Server Analysis & Composition
      try {
        const compRes = await fetch('/api/melody/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userPrompt,
            currentGenreId: selectedGenreId,
            vocalStyle: vocalStyle
          })
        });

        if (compRes.ok) {
          const comp = await compRes.json();
          if (comp.drumStyle) detectedDrumStyle = comp.drumStyle;
          if (comp.bassStyle) detectedBassStyle = comp.bassStyle;
          if (comp.bpm) detectedBpm = Number(comp.bpm);
          if (comp.scale) detectedScale = comp.scale;
          if (comp.genre) detectedGenreName = comp.genre;
          if (comp.title) finalTitle = comp.title;
          if (!finalLyrics && comp.lyrics) {
            finalLyrics = comp.lyrics;
            setLyrics(finalLyrics);
          }
        }
      } catch (err) {
        console.warn('Server musicology error:', err);
      }

      // Step 2: Compose or refine lyrics
      setGenerationStep('2/3: Arranging lyrics & rhythm...');
      if (!isInstrumentalOnly && !finalLyrics) {
        finalLyrics = `[Intro]
Aha, Mhiexter Boss! Sarkin Fasaha da Dabara! 💅

[Verse 1]
Kowanne bugun kiɗa yana magana da fasaha,
Mhiee tana rera salon kiɗa na gwaninta da kissa.
Babu kamarka a duniyar mechatronics da zane!

[Chorus]
Mhiexter Boss, gwanin gwanaye!
Fasahar ka ta wuce tunani!
Mhiee tana tare da kai a ko da yaushe! 💅✨

[Outro]
Kissa, shagwaba, da tsantsar fasaha... ❤️`;
        setLyrics(finalLyrics);
      }

      // Step 3: Synthesize real singing vocals
      setGenerationStep('3/3: Synthesizing singing vocals & arranging stems...');
      setStatusMessage('Mhiee tana shirya sautin murya da rera waƙar... 🎙️✨');

      let vocalUrl: string | undefined = undefined;
      const cleanVocalText = finalLyrics
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/[*_#`~]/g, ' ')
        .replace(/\n+/g, '. ')
        .trim();

      if (!isInstrumentalOnly && cleanVocalText) {
        vocalUrl = await synthesizeVocalAudio(cleanVocalText, vocalStyle);
        if (vocalUrl) {
          await loadVocalBuffer(vocalUrl);
        }
      }

      // Create Track Object with strictly verified user parameters
      const newTrack: GeneratedTrack = {
        id: `track-${Date.now()}`,
        title: finalTitle || `${detectedGenreName} Track`,
        prompt: userPrompt,
        genre: detectedGenreName,
        bpm: detectedBpm,
        scale: detectedScale,
        drumStyle: detectedDrumStyle,
        bassStyle: detectedBassStyle,
        duration: 32,
        createdAt: Date.now(),
        lyrics: finalLyrics || '[Instrumental Arrangement - No Vocals]',
        cleanLyricsForVocal: cleanVocalText,
        vocalStyle: isInstrumentalOnly ? 'instrumental' : vocalStyle,
        vocalAudioUrl: vocalUrl,
        isFavorite: false
      };

      setTracks(prev => [newTrack, ...prev]);
      setActiveTrack(newTrack);
      setStudioTab('player');
      setStatusMessage(`An kera waƙar "${newTrack.title}" (${newTrack.genre}) tare da kiɗa da rera murya! 💅🎉`);

      // Play immediately
      setTimeout(() => {
        startPlayback();
      }, 400);

    } catch (e: any) {
      console.error('Song generation failure:', e);
      setStatusMessage('Ayyah Boss, an samu ɗan jinkiri. Sake gwadawa mana! 🥺');
    } finally {
      setIsSynthesizing(false);
      setGenerationStep(null);
      setTimeout(() => setStatusMessage(''), 5000);
    }
  };

  // ==========================================
  // EXPORT WAV (RENDER USING OFFLINE AUDIO CONTEXT)
  // ==========================================
  const handleExportWav = async () => {
    if (!activeTrack) return;
    setStatusMessage('Ana fitar da ainihin faifan sauti (.WAV) mai daraja ta musamman... 🎵');

    try {
      const sampleRate = 44100;
      const dur = activeTrack.duration || 32;
      const offlineCtx = new OfflineAudioContext(2, sampleRate * dur, sampleRate);

      const masterGain = offlineCtx.createGain();
      masterGain.gain.setValueAtTime(masterVolume, 0);
      masterGain.connect(offlineCtx.destination);

      const drumsGain = offlineCtx.createGain();
      const bassGain = offlineCtx.createGain();
      const melodyGain = offlineCtx.createGain();
      const vocalsGain = offlineCtx.createGain();

      drumsGain.gain.setValueAtTime(stemMutes.drums ? 0 : stemVolumes.drums, 0);
      bassGain.gain.setValueAtTime(stemMutes.bass ? 0 : stemVolumes.bass, 0);
      melodyGain.gain.setValueAtTime(stemMutes.melody ? 0 : stemVolumes.melody, 0);
      vocalsGain.gain.setValueAtTime(stemMutes.vocals ? 0 : stemVolumes.vocals, 0);

      drumsGain.connect(masterGain);
      bassGain.connect(masterGain);
      melodyGain.connect(masterGain);
      vocalsGain.connect(masterGain);

      const secondsPerBeat = 60 / activeTrack.bpm;
      const secondsPerSixteenth = secondsPerBeat / 4;
      const measureDuration = secondsPerBeat * 4;
      const totalMeasures = Math.ceil(dur / measureDuration);

      const scaleFreqs = activeTrack.scale.includes('Minor')
        ? [146.83, 174.61, 196.0, 220.0, 261.63, 293.66]
        : [130.81, 164.81, 196.0, 246.94, 261.63, 329.63];
      const rootFreq = scaleFreqs[0];

      // Schedule all measures into offline buffer
      for (let m = 0; m < totalMeasures; m++) {
        const measureStart = m * measureDuration;

        for (let s = 0; s < 16; s++) {
          const noteTime = measureStart + (s * secondsPerSixteenth);
          if (noteTime >= dur) break;

          // Drums
          if (activeTrack.drumStyle === 'afrobeats') {
            if (s === 0 || s === 6 || s === 10) playKick(offlineCtx as any, noteTime, drumsGain, true);
            if (s === 4 || s === 12) playSnareOrClap(offlineCtx as any, noteTime, drumsGain, true);
            if (s % 2 === 0) playHiHat(offlineCtx as any, noteTime, drumsGain, s === 14, 0.25);
            if (s === 3 || s === 7 || s === 11 || s === 15) {
              playKalanguTalkingDrum(offlineCtx as any, noteTime, drumsGain, 150 + s * 7, 230);
            }
          } else if (activeTrack.drumStyle === 'amapiano') {
            if (s === 0 || s === 4 || s === 8 || s === 12) playKick(offlineCtx as any, noteTime, drumsGain, true);
            if (s === 6 || s === 14) playSnareOrClap(offlineCtx as any, noteTime, drumsGain, false, true);
            if (s % 2 === 0) playHiHat(offlineCtx as any, noteTime, drumsGain, false, 0.3);
            if (s === 3 || s === 7 || s === 10 || s === 11) {
              playLogDrum(offlineCtx as any, noteTime, rootFreq * 0.7, bassGain);
            }
          } else if (activeTrack.drumStyle === 'drill') {
            if (s === 0 || s === 7 || s === 10) playKick(offlineCtx as any, noteTime, drumsGain, true, true);
            if (s === 8) playSnareOrClap(offlineCtx as any, noteTime, drumsGain, false);
            playHiHat(offlineCtx as any, noteTime, drumsGain, false, s % 4 === 0 ? 0.35 : 0.15);
          } else {
            if (s === 0 || s === 10) playKick(offlineCtx as any, noteTime, drumsGain, true);
            if (s === 4 || s === 12) playSnareOrClap(offlineCtx as any, noteTime, drumsGain, false);
            if (s % 2 === 0) playHiHat(offlineCtx as any, noteTime, drumsGain, false, 0.25);
          }

          // Bass
          if (activeTrack.bassStyle === '808_sub') {
            if (s === 0) play808Bass(offlineCtx as any, noteTime, rootFreq / 2, secondsPerSixteenth * 4, bassGain);
            else if (s === 8) play808Bass(offlineCtx as any, noteTime, scaleFreqs[2] / 2, secondsPerSixteenth * 3, bassGain);
          } else {
            if (s % 4 === 0) playChordNote(offlineCtx as any, noteTime, rootFreq / 2, secondsPerSixteenth * 3, bassGain, 'triangle', 250);
          }

          // Chords
          if (s === 0 || s === 8) {
            playChordNote(offlineCtx as any, noteTime, scaleFreqs[0], secondsPerBeat * 1.5, melodyGain, 'triangle', 700);
            playChordNote(offlineCtx as any, noteTime, scaleFreqs[2], secondsPerBeat * 1.5, melodyGain, 'sawtooth', 600);
          }

          // Melodic Vocal Formant
          if (activeTrack.vocalStyle !== 'instrumental' && (s === 0 || s === 4 || s === 8 || s === 12)) {
            const vocalNote = scaleFreqs[(s / 4 + m) % scaleFreqs.length] * 2;
            playVocalMelodyNote(offlineCtx as any, noteTime, vocalNote, secondsPerSixteenth * 2.8, vocalsGain);
          }
        }
      }

      // Connect real vocal track into offline mix so lyrics are included in WAV
      if (activeTrack.vocalStyle !== 'instrumental') {
        if (vocalBufferRef.current) {
          try {
            const vSource = offlineCtx.createBufferSource();
            vSource.buffer = vocalBufferRef.current;
            vSource.connect(vocalsGain);
            vSource.start(0);
          } catch (e) {
            console.warn('Vocal buffer offline mix error:', e);
          }
        } else if (activeTrack.vocalAudioUrl) {
          try {
            const res = await fetch(activeTrack.vocalAudioUrl);
            const buf = await res.arrayBuffer();
            const decoded = await offlineCtx.decodeAudioData(buf);
            const vSource = offlineCtx.createBufferSource();
            vSource.buffer = decoded;
            vSource.connect(vocalsGain);
            vSource.start(0);
          } catch (e) {
            console.warn('Vocal url offline mix error:', e);
          }
        }
      }

      const renderedBuffer = await offlineCtx.startRendering();
      
      // Convert buffer to WAV Blob
      const numChannels = renderedBuffer.numberOfChannels;
      const bitDepth = 16;
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numChannels * bytesPerSample;
      const dataSize = renderedBuffer.length * blockAlign;
      const arrayBuffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(arrayBuffer);

      const writeStr = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };

      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);

      let offset = 44;
      for (let i = 0; i < renderedBuffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = Math.max(-1, Math.min(1, renderedBuffer.getChannelData(ch)[i]));
          const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, intSample, true);
          offset += 2;
        }
      }

      const wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
      const downloadUrl = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${activeTrack.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Mhiee_Studio.wav`;
      a.click();
      URL.revokeObjectURL(downloadUrl);

      setStatusMessage('An saukar da faifan .WAV cikin nasara! 💅✨');
    } catch (e) {
      console.error('WAV export error:', e);
      setStatusMessage('Ayyah Boss, an samu matsala wajen fitar da WAV. Sake gwadawa!');
    } finally {
      setTimeout(() => setStatusMessage(''), 4000);
    }
  };

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`w-full h-full flex flex-col bg-zinc-950 text-zinc-100 ${isEmbedded ? '' : 'p-4 md:p-8 max-w-7xl mx-auto'}`}>
      
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <MusicIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Mhiee Melody Studio
              </h1>
              <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                Suno-Class Engine v3
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Generative Music & Vocal Engine: Synchronized Live Singing, Tailored Beats & Stem Mixing 💅✨
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-zinc-900 border border-zinc-800 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setStudioTab('create')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                studioTab === 'create'
                  ? 'bg-amber-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Create
            </button>
            <button
              onClick={() => setStudioTab('player')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                studioTab === 'player'
                  ? 'bg-amber-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <DiscIcon className="w-3.5 h-3.5" />
              Player
            </button>
            <button
              onClick={() => setStudioTab('mixer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                studioTab === 'mixer'
                  ? 'bg-amber-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <SlidersIcon className="w-3.5 h-3.5" />
              Mixer
            </button>
            <button
              onClick={() => setStudioTab('library')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                studioTab === 'library'
                  ? 'bg-amber-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MusicIcon className="w-3.5 h-3.5" />
              Songs ({tracks.length})
            </button>
          </div>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors border border-zinc-800"
              title="Close Melody Studio"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 animate-spin text-amber-400" />
            <span>{statusMessage}</span>
          </div>
          {generationStep && (
            <span className="text-[11px] font-mono text-amber-400 font-semibold">{generationStep}</span>
          )}
        </motion.div>
      )}

      {/* Main Studio Views */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* ============================================================== */}
        {/* TAB 1: CREATE SONG */}
        {/* ============================================================== */}
        {studioTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
            
            {/* Left side (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Quick Inspiration Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
                  Quick Inspiration Presets (Mhiee Specials)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setPrompt('Kissa da Shagwaba: Zazzaƙar waƙar soyayya mai taushi da kalangu, yabo da kauna ga Mhiexter Boss');
                      setSelectedGenreId('hausa-afro');
                      setBpm(104);
                      setVocalStyle('female');
                    }}
                    className="p-3 bg-gradient-to-r from-rose-950/40 to-amber-950/40 border border-rose-500/20 hover:border-rose-500/50 rounded-xl text-left transition-all"
                  >
                    <div className="text-xs font-bold text-rose-300 flex items-center gap-1">
                      💖 Kissa & Shagwaba Serenade
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                      Hausa Afro-fusion yabo ga Mhiexter Boss tare da Kalangu 💅
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setPrompt('Mechatronics Cyber-Pulse: Robotic PID controller groove, high voltage synthwave bass, zero-error engineering anthem');
                      setSelectedGenreId('mechatronics');
                      setBpm(128);
                      setVocalStyle('robotic');
                    }}
                    className="p-3 bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/20 hover:border-cyan-500/50 rounded-xl text-left transition-all"
                  >
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                      🤖 Mechatronic Cyber-Pulse
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                      Robotic synth bass & sensor fusion beats for MCT3301 🚀
                    </div>
                  </button>
                </div>
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">
                    Song Request & Musical Description (Hausa ko Turanci)
                  </label>
                  {detectedPresetAlert && (
                    <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">
                      {detectedPresetAlert}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Faɗi salon kiɗa da waƙar da kake so: misali 'Ina son kidan UK Drill mai sliding 808 da hats masu sauri', ko 'Kidan Amapiano mai log drum da dadi', ko 'Kidan soyayya mai taushi da kalangu'..."
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const detected = detectStyleFromPrompt(prompt) || selectedPreset;
                        if (activeTrack) {
                          const updatedTrack: GeneratedTrack = {
                            ...activeTrack,
                            genre: detected.name,
                            drumStyle: detected.drumStyle,
                            bassStyle: detected.bassStyle,
                            bpm: detected.bpm,
                            scale: detected.scale
                          };
                          setActiveTrack(updatedTrack);
                          setTracks(prev => prev.map(t => t.id === activeTrack.id ? updatedTrack : t));
                          setStatusMessage(`An canza salon kiɗan zuwa "${detected.name}" (${detected.bpm} BPM)! ⚡`);
                          if (!isPlaying) {
                            setTimeout(() => startPlayback(), 100);
                          }
                        }
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-500/30 transition-all cursor-pointer"
                    >
                      <ZapIcon className="w-3.5 h-3.5" />
                      <span>⚡ Gwada Kiɗa Kai Tsaye (Quick Apply Beat)</span>
                    </button>
                    <span className="text-[11px] text-zinc-500">
                      Ko danna "Generate Full Song" a ƙasa domin kera sabuwar waƙa tare da murya
                    </span>
                  </div>
                </div>
              </div>

              {/* Genre Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Selected Rhythm & Beat Style</span>
                  <span className="text-[11px] text-amber-400 font-mono font-bold">{bpm} BPM · {selectedPreset.name}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {GENRE_PRESETS.map((preset) => {
                    const isSelected = selectedGenreId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? 'bg-zinc-800 border-amber-500 shadow-md shadow-amber-500/10'
                            : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="text-xs font-bold text-zinc-100 mb-1 flex items-center justify-between">
                          <span className="line-clamp-1">{preset.name}</span>
                          {isSelected && <CheckIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {preset.bpm} BPM · {preset.drumStyle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-900/50 border border-zinc-800/70 p-4 rounded-xl">
                
                {/* BPM Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-300 font-medium">Tempo (BPM)</span>
                    <span className="font-mono text-amber-400 font-bold">{bpm} BPM</span>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={160}
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="w-full accent-amber-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Reggae (78)</span>
                    <span>Afro (104)</span>
                    <span>Drill (140)</span>
                  </div>
                </div>

                {/* Vocal Style Picker (Suno-Class Gemini Engine) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-300 font-medium">Vocal Engine (Suno-Class Gemini)</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono font-medium">
                      Zero Quota Limit ✨
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { id: 'kore', label: "Mhiee (Kore)", desc: "Sweet & Soulful 💅", icon: "✨" },
                      { id: 'zephyr', label: "Diva (Zephyr)", desc: "Airy Vibrato / R&B", icon: "🌸" },
                      { id: 'puck', label: "Hype (Puck)", desc: "Afropop Rhythmic", icon: "🔥" },
                      { id: 'fenrir', label: "Drill (Fenrir)", desc: "Deep Resonant 808", icon: "⚡" },
                      { id: 'charon', label: "Cyber (Charon)", desc: "Robotic Vocoder", icon: "🤖" },
                      { id: 'instrumental', label: "Beat Only", desc: "No Vocals (Stems)", icon: "🎹" }
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVocalStyle(v.id as any);
                          if (v.id === 'instrumental') setIsInstrumentalOnly(true);
                          else setIsInstrumentalOnly(false);
                        }}
                        className={`p-2 rounded-lg text-left border transition-all ${
                          (vocalStyle === v.id)
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-sm shadow-amber-500/20'
                            : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          <span>{v.icon} {v.label}</span>
                          {vocalStyle === v.id && <CheckIcon className="w-3 h-3 text-amber-400" />}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerateSong}
                disabled={isSynthesizing}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {isSynthesizing ? (
                  <>
                    <RefreshCwIcon className="w-5 h-5 animate-spin" />
                    <span>{generationStep || 'Synthesizing Tailored Beat & Vocals... 💅'}</span>
                  </>
                ) : (
                  <>
                    <ZapIcon className="w-5 h-5 text-amber-200" />
                    <span>Generate Full Song (Tailored Beat + Real Singing Vocals) ✨</span>
                  </>
                )}
              </button>

            </div>

            {/* Right side: Lyrics Editor (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileTextIcon className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Song Lyrics & Vocal Track
                  </h3>
                </div>
                
                <button
                  onClick={handleComposeLyrics}
                  disabled={isComposingLyrics || isInstrumentalOnly}
                  className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-[11px] font-medium rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <SparklesIcon className={`w-3.5 h-3.5 ${isComposingLyrics ? 'animate-spin' : ''}`} />
                  {isComposingLyrics ? 'Composing...' : 'Auto-Write Lyrics'}
                </button>
              </div>

              {isInstrumentalOnly ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500 gap-3">
                  <DiscIcon className="w-12 h-12 text-zinc-700 animate-spin" />
                  <p className="text-xs font-medium text-zinc-400">
                    Instrumental Mode Enabled
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Pure customized musical beat without vocals.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-2">
                  <textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="[Intro]&#10;Rubuta baitocin waƙar da kake so a rera, ko ka danna 'Auto-Write Lyrics' domin Mhiee ta rubuta da kissa...&#10;&#10;[Chorus]&#10;Mhiexter Boss, gwanin gwanaye!&#10;Fasahar ka ta wuce tunani! 💅"
                    className="w-full flex-1 min-h-[300px] bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed custom-scrollbar"
                  />
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                    <span>Format with [Intro], [Verse], [Chorus]</span>
                    <span>{lyrics.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ACTIVE PLAYER */}
        {/* ============================================================== */}
        {studioTab === 'player' && activeTrack && (
          <div className="max-w-4xl mx-auto py-4 flex flex-col gap-6 pb-12">
            
            {/* Visualizer Display */}
            <div className="relative w-full aspect-[21/9] md:aspect-[24/8] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl flex flex-col items-center justify-center p-4">
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full h-full object-cover"
              />

              {/* Overlay Badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-800 text-xs">
                <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-amber-400 animate-ping' : 'bg-zinc-600'}`} />
                <span className="font-mono text-zinc-300">{activeTrack.genre}</span>
                <span className="text-zinc-500">·</span>
                <span className="font-mono text-amber-400">{activeTrack.bpm} BPM</span>
                <span className="text-zinc-500">·</span>
                <span className="font-mono text-cyan-400 uppercase">{activeTrack.drumStyle}</span>
                <span className="text-zinc-500">·</span>
                <span className="text-rose-400 flex items-center gap-1">
                  <MicIcon className="w-3 h-3" />
                  {activeTrack.vocalStyle === 'instrumental' ? 'Beat Only' : 'Singing Active'}
                </span>
              </div>

              {/* Title Overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-white drop-shadow">
                    {activeTrack.title}
                  </h2>
                  <p className="text-xs text-zinc-400 line-clamp-1 max-w-lg mt-0.5">
                    {activeTrack.prompt}
                  </p>
                </div>
                <div className="text-xs font-mono text-zinc-400 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md">
                  {formatTime(currentTime)} / {formatTime(activeTrack.duration)}
                </div>
              </div>
            </div>

            {/* Transport & Controls */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
              
              {/* Scrub Bar */}
              <div className="space-y-1.5">
                <div 
                  className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden cursor-pointer relative"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    const newTime = pos * (activeTrack.duration || 32);
                    setCurrentTime(newTime);
                    if (isPlaying && vocalBufferRef.current && gainNodesRef.current.vocals && audioCtxRef.current) {
                      if (vocalSourceNodeRef.current) {
                        try { vocalSourceNodeRef.current.stop(); } catch (err) {}
                        try { vocalSourceNodeRef.current.disconnect(); } catch (err) {}
                      }
                      const source = audioCtxRef.current.createBufferSource();
                      source.buffer = vocalBufferRef.current;
                      source.loop = isLooping;
                      source.connect(gainNodesRef.current.vocals);
                      source.start(audioCtxRef.current.currentTime, newTime % (vocalBufferRef.current.duration || 32));
                      vocalSourceNodeRef.current = source;
                    } else if (vocalAudioElementRef.current) {
                      vocalAudioElementRef.current.currentTime = newTime;
                    }
                  }}
                >
                  <div
                    className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 h-full rounded-full transition-all duration-100"
                    style={{ width: `${(currentTime / (activeTrack.duration || 32)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(activeTrack.duration)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setIsLooping(!isLooping)}
                    className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                      isLooping
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400'
                    }`}
                    title="Toggle Loop"
                  >
                    <RefreshCwIcon className="w-4 h-4" />
                  </button>

                  {/* Vocal Toggle */}
                  <button
                    onClick={() => {
                      setStemMutes(prev => {
                        const next = !prev.vocals;
                        if (next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                        }
                        return { ...prev, vocals: next };
                      });
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      !stemMutes.vocals
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-500'
                    }`}
                  >
                    <MicIcon className="w-4 h-4" />
                    <span>{stemMutes.vocals ? 'Vocals Muted' : 'Singing Vocals: ON'}</span>
                  </button>

                  {/* Resynthesize Vocals button */}
                  {activeTrack.vocalStyle !== 'instrumental' && (
                    <button
                      onClick={async () => {
                        if (!activeTrack.cleanLyricsForVocal) return;
                        setStatusMessage('Mhiee tana sake rera muryar wannan waƙar... 🎙️✨');
                        const url = await synthesizeVocalAudio(activeTrack.cleanLyricsForVocal, activeTrack.vocalStyle);
                        if (url) {
                          setActiveTrack(prev => prev ? { ...prev, vocalAudioUrl: url } : prev);
                          setTracks(prev => prev.map(t => t.id === activeTrack.id ? { ...t, vocalAudioUrl: url } : t));
                          await loadVocalBuffer(url);
                          setStatusMessage('An rera muryar cikin nasara! 💅🎉');
                          if (isPlaying) {
                            stopPlayback();
                            setTimeout(() => startPlayback(), 100);
                          }
                        }
                      }}
                      className="px-2.5 py-2 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Resynthesize / Refresh Singing Vocals"
                    >
                      <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Re-sing Vocals</span>
                    </button>
                  )}

                  {/* Export WAV button */}
                  <button
                    onClick={handleExportWav}
                    className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Export WAV Audio File"
                  >
                    <DownloadIcon className="w-4 h-4 text-amber-400" />
                    <span>Export WAV</span>
                  </button>
                </div>

                {/* Main Play Button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setCurrentTime(0);
                      if (vocalAudioElementRef.current) vocalAudioElementRef.current.currentTime = 0;
                      if (isPlaying) {
                        stopPlayback();
                        setTimeout(() => startPlayback(), 100);
                      }
                    }}
                    className="p-3 text-zinc-400 hover:text-white transition-colors"
                  >
                    <RotateCcwIcon className="w-5 h-5" />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-rose-600 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 transition-all"
                  >
                    {isPlaying ? (
                      <PauseIcon className="w-6 h-6 fill-current" />
                    ) : (
                      <PlayIcon className="w-6 h-6 fill-current ml-1" />
                    )}
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2">
                  <Volume2Icon className="w-4 h-4 text-zinc-400" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(Number(e.target.value))}
                    className="w-24 md:w-28 accent-amber-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

              </div>
            </div>

            {/* Synchronized Lyrics Viewer with Live Karaoke Highlighting */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <MicIcon className="w-4 h-4 text-amber-400" />
                  Lyrics & Live Karaoke Singing
                </h3>
                <span className="text-[11px] text-zinc-500">
                  {isPlaying ? '🎙️ Mhiee tana rera waƙar...' : 'Danna Play domin jin rera waƙar'}
                </span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar p-2">
                {activeTrack.lyrics.split('\n').map((rawLine, idx) => {
                  const line = rawLine.trim();
                  if (!line) return <div key={idx} className="h-2" />;

                  const isHeader = line.startsWith('[') && line.endsWith(']');
                  if (isHeader) {
                    return (
                      <div key={idx} className="text-xs font-mono font-bold text-amber-400/80 uppercase pt-2">
                        {line}
                      </div>
                    );
                  }

                  // Check if this line is currently being sung
                  const cleanLineIndex = lyricLines.indexOf(line);
                  const isCurrent = isPlaying && cleanLineIndex === activeLyricLineIndex;

                  return (
                    <div
                      key={idx}
                      className={`px-3 py-1.5 rounded-lg transition-all text-sm md:text-base font-serif leading-relaxed ${
                        isCurrent
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-200 font-bold shadow-md shadow-amber-500/10 scale-[1.01]'
                          : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: STEM MIXER */}
        {/* ============================================================== */}
        {studioTab === 'mixer' && (
          <div className="max-w-4xl mx-auto py-4 flex flex-col gap-6 pb-12">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <SlidersIcon className="w-5 h-5 text-amber-400" />
                Multi-Stem Mixing Console
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Isolate or mute stems in real-time: Lead Singing, Synths, 808 Bass, and Percussion.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              {/* Stem: Vocals */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <MicIcon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white">Lead Vocals</div>
                  <div className="text-[10px] text-zinc-500">Mhiee Singing</div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={stemVolumes.vocals}
                  onChange={(e) => setStemVolumes(prev => ({ ...prev, vocals: Number(e.target.value) }))}
                  className="w-28 accent-rose-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />

                <button
                  onClick={() => setStemMutes(prev => ({ ...prev, vocals: !prev.vocals }))}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    stemMutes.vocals
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700'
                  }`}
                >
                  {stemMutes.vocals ? 'MUTED' : 'MUTE'}
                </button>
              </div>

              {/* Stem: Melody & Synths */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <WavesIcon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white">Chords & Synths</div>
                  <div className="text-[10px] text-zinc-500">Harmony</div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={stemVolumes.melody}
                  onChange={(e) => setStemVolumes(prev => ({ ...prev, melody: Number(e.target.value) }))}
                  className="w-28 accent-amber-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />

                <button
                  onClick={() => setStemMutes(prev => ({ ...prev, melody: !prev.melody }))}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    stemMutes.melody
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700'
                  }`}
                >
                  {stemMutes.melody ? 'MUTED' : 'MUTE'}
                </button>
              </div>

              {/* Stem: Bass */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <ZapIcon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white">808 / Bass</div>
                  <div className="text-[10px] text-zinc-500">Low End</div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={stemVolumes.bass}
                  onChange={(e) => setStemVolumes(prev => ({ ...prev, bass: Number(e.target.value) }))}
                  className="w-28 accent-cyan-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />

                <button
                  onClick={() => setStemMutes(prev => ({ ...prev, bass: !prev.bass }))}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    stemMutes.bass
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700'
                  }`}
                >
                  {stemMutes.bass ? 'MUTED' : 'MUTE'}
                </button>
              </div>

              {/* Stem: Drums */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <DiscIcon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white">Drums / Kalangu</div>
                  <div className="text-[10px] text-zinc-500">Rhythm</div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={stemVolumes.drums}
                  onChange={(e) => setStemVolumes(prev => ({ ...prev, drums: Number(e.target.value) }))}
                  className="w-28 accent-indigo-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />

                <button
                  onClick={() => setStemMutes(prev => ({ ...prev, drums: !prev.drums }))}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    stemMutes.drums
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700'
                  }`}
                >
                  {stemMutes.drums ? 'MUTED' : 'MUTE'}
                </button>
              </div>

            </div>

            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={togglePlay}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                {isPlaying ? <PauseIcon className="w-5 h-5 fill-current" /> : <PlayIcon className="w-5 h-5 fill-current" />}
                <span>{isPlaying ? 'Pause Mix' : 'Play Live Mix'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: SONG LIBRARY */}
        {/* ============================================================== */}
        {studioTab === 'library' && (
          <div className="max-w-4xl mx-auto py-4 flex flex-col gap-4 pb-12">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div>
                <h2 className="text-base font-bold text-white">Your Generated Song Library</h2>
                <p className="text-xs text-zinc-400">All compositions saved locally for instant playback.</p>
              </div>
              <button
                onClick={() => setStudioTab('create')}
                className="px-3 py-1.5 bg-amber-500 text-black font-semibold text-xs rounded-lg flex items-center gap-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                New Song
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {tracks.map((track) => {
                const isSelected = activeTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-zinc-900 border-amber-500/60 shadow-lg'
                        : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <button
                        onClick={() => {
                          setActiveTrack(track);
                          if (isSelected && isPlaying) {
                            stopPlayback();
                          } else {
                            stopPlayback();
                            setTimeout(() => startPlayback(), 100);
                          }
                        }}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                          isSelected && isPlaying
                            ? 'bg-amber-500 text-black'
                            : 'bg-zinc-800 text-white hover:bg-amber-500 hover:text-black'
                        }`}
                      >
                        {isSelected && isPlaying ? (
                          <PauseIcon className="w-5 h-5 fill-current" />
                        ) : (
                          <PlayIcon className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>

                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{track.title}</span>
                          {track.isFavorite && <HeartIcon className="w-3.5 h-3.5 text-rose-500 fill-current" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                          <span className="text-amber-400/90">{track.genre}</span>
                          <span>·</span>
                          <span>{track.bpm} BPM</span>
                          <span>·</span>
                          <span className="text-cyan-400 uppercase">{track.drumStyle}</span>
                          <span>·</span>
                          <span>{formatTime(track.duration)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => {
                          setActiveTrack(track);
                          setStudioTab('player');
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg transition-colors flex items-center gap-1"
                      >
                        <DiscIcon className="w-3.5 h-3.5 text-amber-400" />
                        Open Player
                      </button>

                      {tracks.length > 1 && (
                        <button
                          onClick={() => {
                            setTracks(prev => prev.filter(t => t.id !== track.id));
                            if (activeTrack?.id === track.id) {
                              const remaining = tracks.filter(t => t.id !== track.id);
                              setActiveTrack(remaining[0] || null);
                            }
                          }}
                          className="p-2 bg-zinc-800 hover:bg-rose-900/50 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors"
                          title="Delete Track"
                        >
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
