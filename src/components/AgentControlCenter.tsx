import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, Zap, Sparkles, CheckCircle2, Clock, Play, Loader2, RefreshCw, AlertCircle,
  FileText, Download, Copy, Trash2, Bell, Shield, ChevronRight, CornerDownRight, Database, HelpCircle
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { decomposeGoal, executeAgentPipeline } from '../services/agentEngine';
import { fetchTaskPlans, deleteTaskPlan } from '../services/taskPlannerService';
import { fetchReminders, deleteReminder } from '../services/reminderService';
import { TaskPlan, TaskNode, Reminder } from '../types';
import { generateAndDownloadFile } from '../lib/fileUtils';

interface AgentControlCenterProps {
  onNotification: (msg: string) => void;
  onReadAloud: (text: string) => void;
  onClose: () => void;
}

export default function AgentControlCenter({ onNotification, onReadAloud, onClose }: AgentControlCenterProps) {
  const { user } = useAuth();
  const [goal, setGoal] = useState('');
  const [plans, setPlans] = useState<TaskPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TaskPlan | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadInitialData = async () => {
    if (!user) return;
    try {
      const dbPlans = await fetchTaskPlans(user.uid);
      setPlans(dbPlans || []);
      
      const dbReminders = await fetchReminders(user.uid);
      setReminders(dbReminders || []);
    } catch (e) {
      console.error("Error loading agent desk data:", e);
    }
  };

  const handleDecomposeAndRun = async (inputGoal: string) => {
    if (!user) return;
    const apiKey = (window as any).GEMINI_API_KEY || localStorage.getItem('geminiApiKey');
    if (!apiKey) {
      onNotification("Haba Boss, please save your Gemini API Key in Settings first! 🙄💅");
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setSelectedReport(null);
    setLogs(prev => [...prev, `[INITIATING] Connecting database links & configuring AGI subgrids...`]);

    try {
      // 1. Goal Decomposition & Task Planning
      setLogs(prev => [...prev, `[PLANNING] Decomposing mecha goal with advanced AGI reasoning...`]);
      const newPlan = await decomposeGoal(apiKey, user.uid, inputGoal);
      setActivePlan(newPlan);
      setPlans(prev => [newPlan, ...prev]);
      
      onNotification("Autonomous plan generated! Executing stages... 📡✨");
      onReadAloud("Mhiexter Boss, na yi nasarar tsara wannan shirin. Ina fara aiwatarwa yanzu! ✨");

      // 2. Execution Loop
      const reportMarkdown = await executeAgentPipeline(
        apiKey,
        user.uid,
        newPlan,
        (updatedPlan) => {
          setActivePlan(updatedPlan);
          setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
        },
        (logMsg, isThought) => {
          setLogs(prev => [...prev, logMsg]);
        }
      );

      // 3. Complete Deliverables
      setSelectedReport(reportMarkdown);
      onNotification("Empire Autonomous Mission Completed successfully! 🏆✨");
      onReadAloud("Excellent! Na kammala duk ayyukan shirin cikin nasara, kuma na ajiye maka sakamakon a Empire Vault.");
      loadInitialData();
    } catch (err: any) {
      setLogs(prev => [...prev, `[FATAL] Pipeline crash: ${err.message || err}`]);
      onNotification(`Ayyah Boss, crash occurred: ${err.message || err}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyReport = () => {
    if (selectedReport) {
      navigator.clipboard.writeText(selectedReport);
      onNotification("Report copied cleanly to clipboard! 📋✨");
    }
  };

  const handleDownloadReport = () => {
    if (!selectedReport) return;
    generateAndDownloadFile(`mhiee_autonomous_report_${Date.now()}.md`, selectedReport, 'text/markdown');
    onNotification("Downloaded markdown report files! 💾");
  };

  const handleDeletePlan = async (planId: string) => {
    if (!user) return;
    try {
      await deleteTaskPlan(user.uid, planId);
      setPlans(prev => prev.filter(p => p.id !== planId));
      if (activePlan?.id === planId) {
        setActivePlan(null);
        setSelectedReport(null);
      }
      onNotification("Target plan records wiped securely.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteReminder = async (remId: string) => {
    if (!user) return;
    try {
      await deleteReminder(user.uid, remId);
      setReminders(prev => prev.filter(r => r.id !== remId));
      onNotification("Reminder wiped from mecha scheduler. 🚨");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 overflow-y-auto text-zinc-100 font-sans custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-teal-400">
              Mhiee Agent Deck
            </h1>
            <p className="text-[10px] text-zinc-500 tracking-wider">AUTONOMOUS MULTI-STEP MECHATRONIC CORE // V3.1</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Input Pane & Quick Tasks */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-zinc-900/60 backdrop-blur-md rounded-3xl p-5 border border-white/5 shadow-xl">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Sparkles size={14} /> Incept Mission Goal
            </h2>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="E.g., Find the best laptop under ₦500,000, compare 5 options, save the report, and remind me next week..."
              className="w-full h-32 px-4 py-3 bg-zinc-950 text-xs text-zinc-300 rounded-2xl border border-zinc-805/80 focus:outline-none focus:border-indigo-500/50 resize-none placeholder-zinc-600 transition-colors leading-relaxed"
            />
            <button
              onClick={() => handleDecomposeAndRun(goal)}
              disabled={isRunning || !goal.trim()}
              className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 active:scale-98"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> In Orbit Execution...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Run Autonomous Plan
                </>
              )}
            </button>
          </div>

          {/* Quick templates */}
          <div className="bg-zinc-900/60 backdrop-blur-md rounded-3xl p-5 border border-white/5 shadow-xl">
            <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3">Pre-Configured Missions</h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setGoal("Find the best laptop under ₦500,000, compare 5 options, save the report, and remind me in 10 seconds.")}
                className="text-left w-full p-3 bg-zinc-950/80 hover:bg-zinc-900 rounded-xl text-[11px] text-zinc-400 transition-all border border-transparent hover:border-indigo-500/20 hover:text-white"
              >
                🎓 Laptop Search under ₦500k & Compare
              </button>
              <button
                onClick={() => setGoal("Verify mechatronics sensor choices for human stabilization PID feedback loops, summarize findings, and add memory.")}
                className="text-left w-full p-3 bg-zinc-950/80 hover:bg-zinc-900 rounded-xl text-[11px] text-zinc-400 transition-all border border-transparent hover:border-indigo-500/20 hover:text-white"
              >
                🦾 PID Sensor Fusion Guidelines
              </button>
              <button
                onClick={() => setGoal("Find cheap Raspberry Pi 5 alternatives in Nigeria, map prices, and set reminder in 5 minutes.")}
                className="text-left w-full p-3 bg-zinc-950/80 hover:bg-zinc-900 rounded-xl text-[11px] text-zinc-400 transition-all border border-transparent hover:border-indigo-500/20 hover:text-white"
              >
                📡 Raspberry Pi 5 Alternatives
              </button>
            </div>
          </div>
        </div>

        {/* Center Task execution and Logs */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Active plan execution */}
          {activePlan && (
            <div className="bg-zinc-900/60 backdrop-blur-md rounded-3xl p-5 border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase text-indigo-300">Active Decomposed Plan</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-md">Goal: {activePlan.request}</p>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                  activePlan.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  activePlan.status === 'running' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse' :
                  activePlan.status === 'failed' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  {activePlan.status}
                </div>
              </div>

              {/* Steps progression */}
              <div className="flex flex-col gap-3">
                {activePlan.tasks.map((task, idx) => (
                  <div key={task.id} className="bg-zinc-950/80 rounded-2xl p-4 border border-zinc-850 transition-all hover:bg-zinc-950 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <div className="mt-0.5 shrink-0">
                          {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          {task.status === 'in_progress' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                          {task.status === 'pending' && <Clock className="w-4 h-4 text-zinc-600" />}
                          {task.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-100">{idx+1}. {task.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full font-mono">{task.tool}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{task.description}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0 font-mono">{task.duration}</span>
                    </div>

                    {/* Step Output / Reflection Detail with Metacognitive view */}
                    {task.toolOutput && (
                      <div className="mt-2 ml-7 pl-3 border-l border-indigo-500/20 flex flex-col gap-1.5 bg-zinc-900/30 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Database size={10} className="text-teal-400" /> Deliverable Output
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-300 leading-relaxed font-mono line-clamp-4">{task.toolOutput}</p>
                        
                        {task.reflection && (
                          <div className="mt-2 text-[10px] bg-indigo-500/5 text-indigo-300 p-2.5 rounded-lg border border-indigo-500/10 flex flex-col gap-1">
                            <span className="font-bold flex items-center gap-1 uppercase tracking-widest text-[9px]">
                              🧠 Metacognitive Reflection & Safeguard
                            </span>
                            <p className="italic leading-relaxed">{task.reflection}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-time working consoles */}
          {logs.length > 0 && (
            <div className="bg-zinc-900/60 backdrop-blur-md rounded-3xl p-5 border border-white/5 shadow-xl flex flex-col h-60">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Shield size={12} /> AGI Pulse Terminal
              </h3>
              <div className="flex-1 bg-zinc-950 p-4 rounded-2xl font-mono text-[10px] text-zinc-400 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                {logs.map((log, lIdx) => (
                  <div key={lIdx} className="leading-relaxed">
                    <span className="text-indigo-500 shrink-0">&gt;</span> <span className={`${log.startsWith('[ERROR]') || log.startsWith('[FATAL]') ? 'text-red-400 font-bold' : log.includes('[REFLECTION_OK]') ? 'text-emerald-400' : log.startsWith('[AGENT]') ? 'text-indigo-400 font-bold' : 'text-zinc-400'}`}>{log}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Generated markdown output pane */}
          {selectedReport && (
            <div className="bg-zinc-900/60 backdrop-blur-md rounded-3xl p-5 border border-white/5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <h3 className="text-xs font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText size={14} /> Mission Audit deliverable
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    title="Copy Report"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    title="Download Report"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
              <div className="bg-zinc-950 p-6 rounded-2xl font-sans text-xs text-zinc-300 overflow-y-auto max-h-[500px] border border-white/5 leading-relaxed custom-scrollbar markdown-preview">
                {selectedReport.split('\n').map((line, sIdx) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={sIdx} className="text-lg font-black text-white uppercase tracking-wider mb-2 mt-4 border-b border-zinc-800 pb-1">{line.replace('# ', '')}</h1>;
                  } else if (line.startsWith('## ')) {
                    return <h2 key={sIdx} className="text-sm font-bold text-indigo-300 mt-4 mb-2">{line.replace('## ', '')}</h2>;
                  } else if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <div key={sIdx} className="pl-4 flex gap-2 text-zinc-400 my-1"><CornerDownRight className="w-3.5 h-3.5 mt-0.5 text-teal-500 shrink-0" /> {line.substring(2)}</div>;
                  } else if (line.trim().startsWith('|')) {
                    return <p key={sIdx} className="font-mono text-[10px] bg-zinc-900/30 p-1 px-2.5 my-0.5 border border-white/5 text-zinc-400">{line}</p>;
                  }
                  return <p key={sIdx} className="my-2">{line}</p>;
                })}
              </div>
            </div>
          )}

          {/* Reminders section */}
          <div className="bg-zinc-900/60 backdrop-blur-md rounded-3xl p-5 border border-white/5 shadow-xl">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-1.5 border-b border-zinc-800/80 pb-3">
              <Bell size={14} className="text-amber-400 animate-swing" /> Active Mechatronic Reminders
            </h3>
            {reminders.length === 0 ? (
              <p className="text-[11px] text-zinc-500 italic py-4 text-center">No mechatronic reminders currently registered. Initialize a plan to add some!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reminders.map((rem) => (
                  <div key={rem.id} className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-850 flex flex-col justify-between hover:bg-zinc-950 transition-all group">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-zinc-200 truncate pr-4">{rem.title}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          rem.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-zinc-800 text-zinc-500'
                        }`}>
                          {rem.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-normal mb-3 line-clamp-2">{rem.description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-900/60 text-[9px] text-zinc-500 font-mono">
                      <span>Trigger: {new Date(rem.remindAt).toLocaleDateString()} {new Date(rem.remindAt).toLocaleTimeString()}</span>
                      <button
                        onClick={() => handleDeleteReminder(rem.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 bg-red-950/20 text-red-400 rounded-lg border border-red-900/20 hover:bg-red-950/40 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Missions historical queue */}
          <div className="bg-zinc-900/60 backdrop-blur-md rounded-3xl p-5 border border-white/5 shadow-xl">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 border-b border-zinc-800/80 pb-3">
              Mission Registry Logs
            </h3>
            {plans.length === 0 ? (
              <p className="text-[11px] text-zinc-500 italic py-4 text-center">No past mechatronic mission records mapped in this cluster.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {plans.map((pl) => (
                  <div key={pl.id} className="flex items-center justify-between p-3.5 bg-zinc-950/80 hover:bg-zinc-950 rounded-2xl border border-zinc-850 hover:border-indigo-500/10 transition-colors group">
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        pl.status === 'completed' ? 'bg-emerald-500' :
                        pl.status === 'running' ? 'bg-indigo-500 animate-ping' :
                        pl.status === 'failed' ? 'bg-red-500' :
                        'bg-zinc-600'
                      }`} />
                      <div className="flex-1 min-w-0 pr-4">
                        <span className="text-xs font-bold text-zinc-200 truncate block group-hover:text-indigo-400 transition-colors">{pl.request}</span>
                        <span className="text-[9px] text-zinc-500 mt-0.5 block font-mono">ID: {pl.id} • {new Date(pl.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setActivePlan(pl);
                          const lastCompletedTask = [...pl.tasks].reverse().find(t => t.status === 'completed' && t.toolOutput);
                          if (lastCompletedTask) {
                            setSelectedReport(lastCompletedTask.toolOutput || null);
                          } else {
                            setSelectedReport(null);
                          }
                          setLogs([`[REGISTRY] Loaded history plan for ID ${pl.id}`, `[REGISTRY] Checked execution results. Status: ${pl.status}.`]);
                        }}
                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        title="Inspect Mission Details"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(pl.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-950/30 rounded-lg text-red-400 transition-colors"
                        title="Delete Plan Registry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
