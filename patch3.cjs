const fs = require('fs');
let content = fs.readFileSync('src/components/MhieeBrowser.tsx', 'utf-8');

// 1. Add folderInputRef
content = content.replace(
    'const fileInputRef = useRef<HTMLInputElement>(null);',
    `const fileInputRef = useRef<HTMLInputElement>(null);\n  const folderInputRef = useRef<HTMLInputElement>(null);\n  const triggerFolderPicker = () => {\n    if (folderInputRef.current) {\n      folderInputRef.current.click();\n    }\n  };`
);

// 2. Add button
const targetMenu = `<button
                            type="button"
                            onClick={() => { triggerPicker('audio/*'); setShowUploadMenu(false); }}
                            className="p-2.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-xl transition-all flex items-center gap-3 group"
                          >
                            <div className="p-1.5 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                              <Volume2 className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-medium">Audio Base</span>
                          </button>`;

const replacementMenu = targetMenu + `\n                          <button
                            type="button"
                            onClick={() => { triggerFolderPicker(); setShowUploadMenu(false); }}
                            className="p-2.5 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 rounded-xl transition-all flex items-center gap-3 group"
                          >
                            <div className="p-1.5 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                              <Folder className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-medium">Upload Folder</span>
                          </button>`;

content = content.replace(targetMenu, replacementMenu);

// 3. Add hidden input
const targetInput = `<input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="*/*"
                    className="hidden"
                  />`;

const replacementInput = targetInput + `\n                  <input
                    type="file"
                    multiple
                    webkitdirectory=""
                    directory=""
                    ref={folderInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />`;
content = content.replace(targetInput, replacementInput);

fs.writeFileSync('src/components/MhieeBrowser.tsx', content, 'utf-8');
console.log('Successfully patched for folder upload UI');
