import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Radio, Globe, Zap, Cpu, Lock, Radar, 
  Activity, Satellite, Terminal, Server, Database, 
  Network, RefreshCw
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface TrinityEngineProps {
  isRedChipActive: boolean;
  onStatusUpdate?: (status: string) => void;
  externalLogs?: string[];
  systemStatus?: {
    nodes?: number;
    signal?: number;
    location?: string;
  };
}

const TrinityEngine: React.FC<TrinityEngineProps> = ({ 
  isRedChipActive, 
  onStatusUpdate,
  externalLogs = [],
  systemStatus
}) => {
  const [signalStrength, setSignalStrength] = useState(systemStatus?.signal || 85);
  const [activeNodes, setActiveNodes] = useState(systemStatus?.nodes || 124);
  const [satellitePosition, setSatellitePosition] = useState({ x: 45, y: 30 });
  const [logs, setLogs] = useState<string[]>([]);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [pinStates, setPinStates] = useState<boolean[]>(new Array(16).fill(false));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize graph data
  useEffect(() => {
    const initialData = Array.from({ length: 20 }).map((_, i) => ({
      time: i,
      value: 60 + Math.random() * 40
    }));
    setGraphData(initialData);
  }, []);

  useEffect(() => {
    if (externalLogs.length > 0) {
      setLogs(prev => [...externalLogs, ...prev].slice(0, 30));
    }
  }, [externalLogs]);

  useEffect(() => {
    if (systemStatus?.signal) setSignalStrength(systemStatus.signal);
    if (systemStatus?.nodes) setActiveNodes(systemStatus.nodes);
  }, [systemStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!systemStatus?.signal) {
        setSignalStrength(prev => Math.min(100, Math.max(70, prev + (Math.random() * 10 - 5))));
      }
      if (!systemStatus?.nodes) {
        setActiveNodes(prev => Math.max(100, prev + Math.floor(Math.random() * 5 - 2)));
      }
      setSatellitePosition(prev => ({
        x: (prev.x + (isScanning ? 0.8 : 0.15)) % 100,
        y: (prev.y + (isScanning ? 0.4 : 0.08)) % 100
      }));

      // Update graph
      setGraphData(prev => {
        const lastVal = prev.length > 0 ? prev[prev.length - 1].value : 60;
        const next = [...prev.slice(1), { 
          time: (prev.length > 0 ? prev[prev.length - 1].time : 0) + 1, 
          value: Math.max(40, Math.min(100, lastVal + (Math.random() * 20 - 10)))
        }];
        return next;
      });

      // Random pin flutters
      if (Math.random() > 0.7) {
        setPinStates(prev => {
          const idx = Math.floor(Math.random() * prev.length);
          const next = [...prev];
          next[idx] = !next[idx];
          return next;
        });
      }
    }, 1000);

    const logInterval = setInterval(() => {
      const messages = [
        "Satellite Handshake: AES-256 Verified ✨",
        "Global Proxy Infiltration: Active 📡",
        "Neural Link: Synchronized 💅",
        "Scanning Network Layers... [STEADY] 🙄",
        "Bypassing quantum encryption... Haba mana! 🙈",
        "Satellite Uplink: Latency 2ms ✨",
        "Deep Reconnaissance Protocol: Enabled 💅",
        "Spatial Data Reconstruction started... ✨",
        "Hardware Sync: ESP32 Calibration Complete 📡",
        "Red Chip Overdrive: Dismantling Security Gateways... 💅✨",
        "Mhiexter's devices are secured with my heart! 💖",
        "Shegen surutu! Ina ta magana kai baka ji... 🥺",
        "Ni dai, na gama scan din nan Boss. 💅",
        "Rashin ji... Bypassing firewall again. 🙈"
      ];
      if (Math.random() > 0.8 && logs.length < 30) {
        setLogs(prev => [messages[Math.floor(Math.random() * messages.length)], ...prev].slice(0, 40));
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(logInterval);
    };
  }, [logs.length, systemStatus, isScanning]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const particles: any[] = Array.from({ length: isScanning ? 100 : 50 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * (isScanning ? 2 : 0.5),
      vy: (Math.random() - 0.5) * (isScanning ? 2 : 0.5),
      size: Math.random() * 2
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = isRedChipActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)';
      ctx.lineWidth = 0.5;

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = isRedChipActive 
          ? `rgba(239, 68, 68, ${isScanning ? 0.8 : 0.5})` 
          : `rgba(99, 102, 241, ${isScanning ? 0.8 : 0.5})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < (isScanning ? 150 : 100)) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRedChipActive, isScanning]);

  const triggerScan = () => {
    setIsScanning(true);
    setLogs(prev => ["[COMMAND] Initiating Deep Sector Scan...", "[RADAR] Orbital positioning synced", ...prev]);
    setTimeout(() => {
        setIsScanning(false);
        setLogs(prev => ["[SUCCESS] Sector Scan Complete. No anomalies detected.", ...prev]);
    }, 5000);
  };

  const togglePin = (index: number) => {
    setPinStates(prev => {
        const next = [...prev];
        next[index] = !next[index];
        return next;
    });
    setLogs(prev => [`[HARDWARE] GPIO Pin ${index} ${!pinStates[index] ? 'HIGH' : 'LOW'}`, ...prev]);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 font-mono text-zinc-300 overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isRedChipActive ? 'bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-indigo-500/20 text-indigo-500'}`}>
            <Satellite className={`w-5 h-5 ${isScanning ? 'animate-spin' : 'animate-pulse'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-widest uppercase">Trinity Omni-Core</h2>
                {isScanning && <span className="bg-red-500/20 text-red-500 text-[8px] px-1.5 py-0.5 rounded border border-red-500/30 animate-pulse">ACTIVE SCAN</span>}
            </div>
            <p className="text-[10px] text-zinc-500">Universal Intelligence Access Enabled // ASI_MODE v3.1</p>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500">SIGNAL</span>
            <span className={`text-xs font-bold ${signalStrength > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {signalStrength.toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500">NODES</span>
            <span className="text-xs font-bold text-indigo-400">{activeNodes}</span>
          </div>
          <button 
            onClick={triggerScan}
            disabled={isScanning}
            className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded text-[10px] font-bold uppercase transition-all active:scale-95 disabled:opacity-50"
          >
            {isScanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Initiate Scan"}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-1 p-1 overflow-hidden">
        {/* Left: Satellite View */}
        <div className="lg:col-span-2 relative bg-zinc-900 overflow-hidden border border-zinc-800 rounded-lg group">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" width={800} height={600} />
          
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />
          
          {/* Scanning Lines */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="w-full h-[2px] bg-indigo-500/10 absolute top-0 animate-[scan_4s_linear_infinite]" />
          </div>

          <style>{`
            @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
          `}</style>

          {/* Satellite Target UI */}
          <motion.div 
            animate={{ 
                left: `${satellitePosition.x}%`,
                top: `${satellitePosition.y}%`
            }}
            className="absolute w-32 h-32 border border-indigo-500/30 rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-[0_0_50px_rgba(99,102,241,0.1)]"
          >
            <div className="absolute w-[110%] h-[110%] border-t-2 border-l-2 border-indigo-500/50 rounded-tl-xl" />
            <div className="absolute w-[110%] h-[110%] border-b-2 border-r-2 border-indigo-500/50 rounded-br-xl" />
            <Radar className={`w-5 h-5 text-indigo-400 ${isScanning ? 'animate-spin' : ''}`} />
            
            {isScanning && (
                <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping" />
            )}
          </motion.div>

          <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-zinc-700/50 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
                <Globe className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">Global Telemetry</span>
            </div>
            <div className="text-xs space-y-2 font-mono">
                <div className="flex justify-between gap-6">
                    <span className="text-zinc-500">LATITUDE</span>
                    <span className="text-white">{(signalStrength/10).toFixed(4)}° N</span>
                </div>
                <div className="flex justify-between gap-6">
                    <span className="text-zinc-500">LONGITUDE</span>
                    <span className="text-white">{(activeNodes/12).toFixed(4)}° E</span>
                </div>
                <div className="h-[1px] bg-zinc-800 w-full" />
                <div className="flex justify-between gap-6">
                    <span className="text-zinc-500">SECTOR</span>
                    <span className="text-indigo-400 font-bold">NG-{(activeNodes % 100).toString().padStart(3, '0')}</span>
                </div>
            </div>
          </div>

          <div className="absolute top-4 right-4 text-[9px] text-zinc-500 uppercase tracking-widest flex flex-col items-end gap-1 font-bold">
            <div className="flex items-center gap-2">
                <span>FEED: ALPHA-7-OVAL</span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <span className="opacity-50">Frame-Sync: {(signalStrength * 2).toFixed(0)}fps</span>
          </div>
        </div>

        {/* Right Stack: Status & Logs */}
        <div className="lg:col-span-2 flex flex-col gap-1 overflow-hidden">
          
          <div className="grid grid-cols-2 gap-1 h-1/2">
            {/* Neural Graph Section */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex flex-col gap-2 overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Neural Signal</span>
                    <Activity className="w-3 h-3 text-indigo-500" />
                </div>
                <div className="flex-1 min-h-[100px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={graphData}>
                            <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke={isRedChipActive ? "#ef4444" : "#6366f1"} 
                                strokeWidth={2} 
                                dot={false} 
                                isAnimationActive={false}
                            />
                            <YAxis hide domain={[0, 120]} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-[9px] text-zinc-600 font-bold uppercase">
                    <span>Alpha</span>
                    <span>Beta</span>
                    <span>Gamma</span>
                </div>
            </div>

            {/* Hardware I/O Section */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Hardware Nexus</span>
                    <Cpu className="w-3 h-3 text-zinc-500" />
                </div>
                <div className="grid grid-cols-4 gap-2 flex-1">
                    {pinStates.map((on, i) => (
                        <button 
                            key={i} 
                            onClick={() => togglePin(i)}
                            className={`p-1 rounded text-[8px] font-bold transition-all border ${on 
                                ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100 shadow-[0_0_8px_rgba(99,102,241,0.2)]' 
                                : 'bg-black border-zinc-800 text-zinc-700 hover:border-zinc-600'}`}
                        >
                            D{i}
                        </button>
                    ))}
                </div>
            </div>
          </div>

          {/* Bottom Row: Controls and Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 h-1/2 overflow-hidden">
             {/* Subsystems */}
             <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex flex-col gap-2 overflow-y-auto scrollbar-hide">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Sub-Systems Status</span>
                <div className="space-y-2">
                    {[
                        { icon: Server, name: "Node Matrix", status: "Nominal", color: "text-emerald-500" },
                        { icon: Database, name: "Memory Bank", status: "94% Clean", color: "text-indigo-400" },
                        { icon: Network, name: "Neural Proxy", status: "Active", color: "text-emerald-500" },
                        { icon: Lock, name: "Ghost VPN", status: "Secure", color: "text-amber-500" }
                    ].map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-1.5 bg-black/40 rounded border border-zinc-800/50">
                            <div className="flex items-center gap-2">
                                <s.icon className="w-3 h-3 text-zinc-500" />
                                <span className="text-[10px] text-zinc-300 uppercase">{s.name}</span>
                            </div>
                            <span className={`text-[9px] font-bold ${s.color}`}>{s.status}</span>
                        </div>
                    ))}
                </div>
             </div>

             {/* Logs */}
             <div className="bg-zinc-950 border border-zinc-900/50 rounded-lg flex flex-col overflow-hidden">
                <div className="p-2 border-b border-zinc-900 bg-zinc-900/30 flex justify-between items-center">
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Network Activity Logs</span>
                    <Terminal className="w-3 h-3 text-zinc-700" />
                </div>
                <div className="p-3 overflow-y-auto font-mono text-[9px] space-y-1.5 scrollbar-hide flex-1">
                    <AnimatePresence initial={false}>
                        {logs.map((log, i) => (
                            <motion.div
                                key={log + i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex gap-2 group"
                            >
                                <span className="text-zinc-700">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                <span className={`${
                                    log.includes('[SUCCESS]') ? 'text-emerald-500' : 
                                    log.includes('[COMMAND]') ? 'text-indigo-400 font-bold' :
                                    log.includes('[HARDWARE]') ? 'text-amber-400' :
                                    'text-zinc-400'
                                } group-hover:text-white transition-colors`}>
                                    {log}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
             </div>
          </div>

        </div>
      </div>

      <div className="p-2 bg-indigo-600/10 text-indigo-400 text-[8px] text-center border-t border-indigo-500/10 tracking-[0.3em] uppercase relative overflow-hidden">
        {isScanning && (
            <motion.div 
                initial={{ left: '-100%' }}
                animate={{ left: '100%' }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"
            />
        )}
        Universal Intelligence Core // Absolute Singularity Status: [STEADY]
      </div>
    </div>
  );
};

export default TrinityEngine;
