import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloudOff, Cloud, RefreshCw, Upload, Download, CheckCircle, XCircle, Trash2, FileText } from 'lucide-react';
import { get, set as idbSet, del } from 'idb-keyval';
import { generateAndDownloadFile } from '../lib/fileUtils';

interface SyncTask {
  id: string;
  type: 'upload' | 'download';
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  filename: string;
  fileData?: string | Blob;
  mimeType?: string;
  url?: string;
  timestamp: number;
}

export default function SyncManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [tasks, setTasks] = useState<SyncTask[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadTasks();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && !isSyncing) {
      processPendingTasks();
    }
  }, [isOnline, tasks, isSyncing]);

  const loadTasks = async () => {
    const stored = await get('mhiee-sync-tasks');
    if (stored) {
      setTasks(stored);
    }
  };

  const saveTasks = async (newTasks: SyncTask[]) => {
    setTasks(newTasks);
    await idbSet('mhiee-sync-tasks', newTasks);
  };

  const processPendingTasks = async () => {
    const pending = tasks.filter(t => t.status === 'pending' || t.status === 'failed');
    if (pending.length === 0) return;

    setIsSyncing(true);

    const updatedTasks = [...tasks];

    for (const task of pending) {
      if (!navigator.onLine) break;

      const idx = updatedTasks.findIndex(t => t.id === task.id);
      if (idx !== -1) {
        updatedTasks[idx] = { ...updatedTasks[idx], status: 'syncing' };
        await saveTasks([...updatedTasks]);
      }

      try {
        if (task.type === 'download' && task.url) {
          // Simulate fetch or execute actual fetch
          const res = await fetch(task.url);
          const blob = await res.blob();
          generateAndDownloadFile(task.filename, blob, task.mimeType);
        } else if (task.type === 'upload' && task.fileData) {
          // Simulate upload delay
          await new Promise(r => setTimeout(r, 1500));
          // Real logic would upload via API here
        }

        const successIdx = updatedTasks.findIndex(t => t.id === task.id);
        if (successIdx !== -1) {
          updatedTasks[successIdx] = { ...updatedTasks[successIdx], status: 'completed' };
        }
      } catch (err) {
        console.error('Sync failed for task', task.id, err);
        const failIdx = updatedTasks.findIndex(t => t.id === task.id);
        if (failIdx !== -1) {
          updatedTasks[failIdx] = { ...updatedTasks[failIdx], status: 'failed' };
        }
      }
    }

    await saveTasks([...updatedTasks]);
    setIsSyncing(false);
  };

  const clearCompleted = async () => {
    const active = tasks.filter(t => t.status !== 'completed');
    await saveTasks(active);
  };

  const handleManualAddUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result as string;
      const newTask: SyncTask = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'upload',
        status: 'pending',
        filename: file.name,
        fileData: data,
        mimeType: file.type,
        timestamp: Date.now()
      };
      await saveTasks([newTask, ...tasks]);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden p-6 max-w-4xl mx-auto text-white">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <RefreshCw className={`w-8 h-8 ${isSyncing ? 'animate-spin text-blue-400' : 'text-gray-400'}`} />
          <div>
            <h2 className="text-2xl font-semibold">Sync Manager</h2>
            <p className="text-sm text-gray-400 flex items-center mt-1">
              {isOnline ? (
                <><Cloud className="w-4 h-4 mr-1 text-green-400" /> Online - Sync Active</>
              ) : (
                <><CloudOff className="w-4 h-4 mr-1 text-red-400" /> Offline - Waiting for connection</>
              )}
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center space-x-2 cursor-pointer transition-colors text-sm font-medium">
            <Upload className="w-4 h-4" />
            <span>Queue Upload</span>
            <input type="file" className="hidden" onChange={handleManualAddUpload} />
          </label>
          <button onClick={clearCompleted} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium">
            Clear Completed
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        <AnimatePresence>
          {tasks.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-48 text-gray-400">
              <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
              <p>All tasks are synchronized.</p>
            </motion.div>
          ) : (
            tasks.map(task => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${task.type === 'upload' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                    {task.type === 'upload' ? <Upload className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-200 flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span>{task.filename}</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(task.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {task.status === 'pending' && <span className="text-xs bg-gray-500/20 text-gray-300 px-2 py-1 rounded-full border border-gray-500/30">Pending</span>}
                  {task.status === 'syncing' && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full border border-blue-500/30 flex items-center"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Syncing</span>}
                  {task.status === 'completed' && <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Done</span>}
                  {task.status === 'failed' && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full border border-red-500/30 flex items-center"><XCircle className="w-3 h-3 mr-1" /> Failed</span>}
                  
                  <button 
                    onClick={() => saveTasks(tasks.filter(t => t.id !== task.id))}
                    className="p-2 hover:bg-red-500/20 hover:text-red-400 text-gray-500 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
