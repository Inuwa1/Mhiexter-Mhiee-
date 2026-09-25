import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import localforage from 'localforage';
import { 
  Folder, File as FileIcon, FileText, FileImage, FileCode, FileAudio, FileVideo, FileArchive,
  Download, Upload, Trash2, X, Plus, ChevronRight, HardDrive, RefreshCw, AlertCircle, Edit, Save
} from 'lucide-react';

interface FileNode {
  name: string;
  kind: 'file' | 'directory';
  handle: any;
}

export function LocalFileManager({ onClose, onNotification }: { onClose: () => void, onNotification: (msg: string) => void }) {
  const [rootHandle, setRootHandle] = useState<any>(null);
  const [currentPath, setCurrentPath] = useState<FileNode[]>([]);
  const [items, setItems] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // File editor state
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  
  const isSupported = 'showDirectoryPicker' in window;

  useEffect(() => {
    const loadSavedHandle = async () => {
      try {
        const handle = await localforage.getItem<any>('mhiee_fs_handle');
        if (handle && await verifyPermission(handle)) {
          setRootHandle(handle);
          setCurrentPath([{ name: handle.name, kind: 'directory', handle }]);
          await loadDirectory(handle);
        }
      } catch (err) {
        console.warn("Could not load saved directory handle", err);
      }
    };
    if (isSupported) {
      loadSavedHandle();
    }
  }, [isSupported]);

  const verifyPermission = async (fileHandle: any, readWrite: boolean = true) => {
    const options = { mode: readWrite ? 'readwrite' : 'read' };
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    return false;
  };

  const requestAccess = async () => {
    try {
      if (!isSupported) {
        setError("File System Access API is not supported in this browser. 🥺 Please use Chrome, Edge or Opera on Desktop.");
        return;
      }
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      setRootHandle(handle);
      setCurrentPath([{ name: handle.name, kind: 'directory', handle }]);
      await localforage.setItem('mhiee_fs_handle', handle);
      await loadDirectory(handle);
      setError(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError("Access denied or error occurred: " + err.message);
      }
    }
  };

  const loadDirectory = async (dirHandle: any) => {
    setLoading(true);
    try {
      const newItems: FileNode[] = [];
      for await (const entry of dirHandle.values()) {
        newItems.push({
          name: entry.name,
          kind: entry.kind,
          handle: entry
        });
      }
      newItems.sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name);
        return a.kind === 'directory' ? -1 : 1;
      });
      setItems(newItems);
    } catch (err: any) {
      setError("Failed to read directory: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: FileNode) => {
    if (item.kind === 'directory') {
      try {
        await loadDirectory(item.handle);
        setCurrentPath(prev => [...prev, item]);
      } catch (err) {
        onNotification("Cannot open folder. 🥺");
      }
    } else {
      openFile(item);
    }
  };

  const navigateUp = async (index: number) => {
    if (index === currentPath.length - 1) return;
    const target = currentPath[index];
    await loadDirectory(target.handle);
    setCurrentPath(prev => prev.slice(0, index + 1));
    setActiveFile(null);
  };

  const openFile = async (item: FileNode) => {
    try {
      const file = await item.handle.getFile();
      if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
         onNotification("Previewing media files is not fully supported here yet. 🙈");
         return;
      }
      
      const text = await file.text();
      setFileContent(text);
      setActiveFile(item);
      setIsEditing(false);
    } catch (err) {
      onNotification("Could not read file. 🥺");
    }
  };

  const saveFile = async () => {
    if (!activeFile) return;
    try {
      const writable = await activeFile.handle.createWritable();
      await writable.write(fileContent);
      await writable.close();
      onNotification("File saved! ✨");
      setIsEditing(false);
    } catch (err) {
      onNotification("Failed to save file. 🥺");
    }
  };

  const createNewFile = async () => {
    if (currentPath.length === 0) return;
    const currentDir = currentPath[currentPath.length - 1].handle;
    
    try {
      const handle = await (window as any).showSaveFilePicker({
        startIn: currentDir,
        suggestedName: 'new-file.txt'
      });
      
      // write empty initially
      const writable = await handle.createWritable();
      await writable.write("");
      await writable.close();
      
      onNotification("File created! 💅");
      await loadDirectory(currentDir);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
         onNotification("Failed to create file.");
      }
    }
  };

  const deleteFile = async (e: React.MouseEvent, item: FileNode) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
    
    if (currentPath.length === 0) return;
    const currentDir = currentPath[currentPath.length - 1].handle;
    
    try {
      await currentDir.removeEntry(item.name, { recursive: item.kind === 'directory' });
      onNotification(`${item.name} deleted! 🗑️`);
      await loadDirectory(currentDir);
      if (activeFile && activeFile.name === item.name) {
         setActiveFile(null);
      }
    } catch (err) {
      onNotification("Failed to delete. 🥺");
    }
  };

  const getFileIcon = (name: string, kind: string) => {
    if (kind === 'directory') return <Folder className="w-5 h-5 text-indigo-400" />;
    
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js': case 'ts': case 'jsx': case 'tsx': case 'json': case 'html': case 'css':
        return <FileCode className="w-5 h-5 text-amber-400" />;
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg': case 'webp':
        return <FileImage className="w-5 h-5 text-emerald-400" />;
      case 'mp4': case 'webm': case 'mov':
        return <FileVideo className="w-5 h-5 text-rose-400" />;
      case 'mp3': case 'wav': case 'ogg':
        return <FileAudio className="w-5 h-5 text-purple-400" />;
      case 'zip': case 'tar': case 'gz': case 'rar':
        return <FileArchive className="w-5 h-5 text-amber-600" />;
      case 'txt': case 'md': case 'csv':
        return <FileText className="w-5 h-5 text-zinc-300" />;
      default:
        return <FileIcon className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white relative">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <HardDrive size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Local Device Storage</h2>
            <p className="text-xs text-zinc-400">Manage files directly on your device</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {!rootHandle ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <HardDrive size={64} className="text-zinc-800 mb-6" />
          <h3 className="text-xl font-bold mb-2">Connect Local Folder</h3>
          <p className="text-zinc-400 mb-8 max-w-md">
            Mhiee needs your permission to read and write files directly to your device storage. This uses the secure File System Access API.
          </p>
          {error ? (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-xl flex items-center gap-3 mb-6">
              <AlertCircle size={20} />
              <span className="text-sm">{error}</span>
            </div>
          ) : null}
          <button
            onClick={requestAccess}
            disabled={!isSupported}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Folder size={18} />
            {isSupported ? "Select Folder to Manage" : "Not Supported in this Browser"}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* File Explorer */}
          <div className={`flex-1 flex flex-col border-r border-zinc-800 transition-all ${activeFile ? 'hidden md:flex md:w-1/2' : 'w-full'}`}>
            
            {/* Breadcrumb & Actions */}
            <div className="p-3 bg-zinc-900/50 flex flex-wrap items-center gap-2 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">
                {currentPath.map((node, i) => (
                  <React.Fragment key={i}>
                    <button
                      onClick={() => navigateUp(i)}
                      className={`px-2 py-1 rounded hover:bg-zinc-800 text-sm whitespace-nowrap ${i === currentPath.length - 1 ? 'text-indigo-400 font-medium' : 'text-zinc-400'}`}
                    >
                      {node.name}
                    </button>
                    {i < currentPath.length - 1 && <ChevronRight size={14} className="text-zinc-600 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={() => loadDirectory(currentPath[currentPath.length - 1].handle)}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={16} />
                </button>
                <button 
                  onClick={createNewFile}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-indigo-400 rounded transition-colors"
                  title="New File"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-zinc-500 gap-2">
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Reading...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
                  <p>Folder is empty</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <div 
                      key={i}
                      onClick={() => handleItemClick(item)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group ${
                        activeFile?.name === item.name ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-zinc-800/80 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        {getFileIcon(item.name, item.kind)}
                        <span className="truncate text-sm font-medium">{item.name}</span>
                      </div>
                      <button 
                        onClick={(e) => deleteFile(e, item)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded transition-all"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* File Editor Panel */}
          {activeFile && (
            <div className="flex-1 flex flex-col bg-zinc-900 w-full md:w-1/2">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                  {getFileIcon(activeFile.name, activeFile.kind)}
                  <span className="font-medium text-sm truncate">{activeFile.name}</span>
                  {isEditing && <span className="w-2 h-2 rounded-full bg-orange-500 ml-2"></span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isEditing ? (
                    <button 
                      onClick={saveFile}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <Save size={14} />
                      Save
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveFile(null)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors md:hidden"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden p-0 relative">
                {isEditing ? (
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    className="w-full h-full bg-transparent text-zinc-300 font-mono text-sm p-4 outline-none resize-none"
                    spellCheck="false"
                  />
                ) : (
                  <pre className="w-full h-full overflow-auto text-zinc-400 font-mono text-sm p-4 whitespace-pre-wrap select-text">
                    {fileContent}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
