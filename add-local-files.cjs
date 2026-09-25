const fs = require('fs');
let code = fs.readFileSync('src/components/MhieeBrowser.tsx', 'utf8');

// 1. Inject import
if (!code.includes('import { LocalFileManager }')) {
  code = code.replace(
    "import { ThoughtChainDisplay } from './ThoughtChainDisplay';",
    "import { ThoughtChainDisplay } from './ThoughtChainDisplay';\nimport { LocalFileManager } from './LocalFileManager';"
  );
}

// 2. Inject Upload Menu Button
const uploadFolderStr = `<button
                            type="button"
                            onClick={() => { triggerFolderPicker(); setShowUploadMenu(false); }}
                            className="p-2.5 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 rounded-xl transition-all flex items-center gap-3 group"
                          >
                            <div className="p-1.5 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                              <Folder className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-medium">Upload Folder</span>
                          </button>`;

const deviceStorageStr = `                          <button
                            type="button"
                            onClick={() => { setActiveFolder('files'); setShowUploadMenu(false); }}
                            className="p-2.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-xl transition-all flex items-center gap-3 group"
                          >
                            <div className="p-1.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                              <HardDrive className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-medium">Device Storage</span>
                          </button>`;

if (!code.includes('Device Storage</span>')) {
  code = code.replace(
    uploadFolderStr,
    deviceStorageStr + '\n                          ' + uploadFolderStr
  );
}

// 3. Inject Panel
const historyPanelStr = `        {/* History Panel */}
        <AnimatePresence>
          {activeFolder === 'history' && (`;

const filesPanelStr = `        {/* File Storage Panel */}
        <AnimatePresence>
          {activeFolder === 'files' && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '80vw', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-zinc-950 border-l border-emerald-500/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col relative z-50 h-full"
            >
              <LocalFileManager 
                onClose={() => setActiveFolder(null)} 
                onNotification={showNotification} 
              />
            </motion.div>
          )}
        </AnimatePresence>
`;

if (!code.includes('activeFolder === \'files\'')) {
  code = code.replace(
    historyPanelStr,
    filesPanelStr + '\n' + historyPanelStr
  );
}

fs.writeFileSync('src/components/MhieeBrowser.tsx', code);
