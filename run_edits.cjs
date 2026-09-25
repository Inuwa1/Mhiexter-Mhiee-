const fs = require('fs');
let content = fs.readFileSync('src/components/MhieeBrowser.tsx', 'utf-8');

// 1. State changes
content = content.replace(
  `  const [isTyping, setIsTyping] = useState(false);\n  const [showUploadMenu, setShowUploadMenu] = useState(false);`,
  `  const [isTyping, setIsTyping] = useState(false);\n  const isAbortedRef = useRef<boolean>(false);\n  const [isAutoScroll, setIsAutoScroll] = useState(true);\n\n  const handleStopGeneration = () => {\n    isAbortedRef.current = true;\n    setIsTyping(false);\n  };\n  const [showUploadMenu, setShowUploadMenu] = useState(false);`
);

// 2. sendMessage changes
content = content.replace(
  `  const sendMessage = async (text: string, filesToUse: SelectionFile[] = [], audioToUse: string[] = []) => {\n    console.log("SENDING MESSAGE - DEBUG:", { text, filesCount: filesToUse.length, audioCount: audioToUse.length, replyTo: !!replyTo });`,
  `  const sendMessage = async (text: string, filesToUse: SelectionFile[] = [], audioToUse: string[] = []) => {\n    console.log("SENDING MESSAGE - DEBUG:", { text, filesCount: filesToUse.length, audioCount: audioToUse.length, replyTo: !!replyTo });\n    isAbortedRef.current = false;\n    setIsAutoScroll(true);`
);

// 3. regenerateMessage
content = content.replace(
  `  const handleSend = async (e?: React.FormEvent) => {`,
  `  const regenerateMessage = (index: number) => {\n    const userMsgIndex = index - 1;\n    if (userMsgIndex < 0) return;\n    const userMsg = messages[userMsgIndex];\n    if (userMsg.role !== 'user') return;\n    \n    const filesToUse: SelectionFile[] = [];\n    if (userMsg.images) {\n      userMsg.images.forEach(img => filesToUse.push({ id: Math.random().toString(), name: 'image.png', type: 'image/png', size: 0, data: img }));\n    }\n    if (userMsg.videos) {\n      userMsg.videos.forEach(vid => filesToUse.push({ id: Math.random().toString(), name: 'video.mp4', type: 'video/mp4', size: 0, data: vid }));\n    }\n    if (userMsg.files) {\n      userMsg.files.forEach(f => filesToUse.push({ id: Math.random().toString(), name: f.name, type: f.type, size: 0, data: f.data, textContent: f.textContent }));\n    }\n    \n    setMessages(prev => prev.slice(0, userMsgIndex));\n    sendMessage(userMsg.text, filesToUse, []);\n  };\n\n  const handleSend = async (e?: React.FormEvent) => {`
);

// 4. break on abort
content = content.replace(/for await \(const chunk of responseStream\) {/g, 'for await (const chunk of responseStream) {\n          if (isAbortedRef.current) break;');
content = content.replace(/for await \(const chunk of funcStream\) {/g, 'for await (const chunk of funcStream) {\n                 if (isAbortedRef.current) break;');

// 5. auto scroll scrollable div
content = content.replace(
  `<div \n            onDragOver={handleDragOver}\n            onDragLeave={handleDragLeave}\n            onDrop={handleDrop}\n            className={\`flex-1 overflow-y-auto p-4 md:p-8 space-y-6 relative \${isDragging ? 'bg-indigo-950/20' : ''}\`}\n          >`,
  `<div \n            onDragOver={handleDragOver}\n            onDragLeave={handleDragLeave}\n            onDrop={handleDrop}\n            onScroll={(e) => {\n              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;\n              const isBottom = scrollHeight - scrollTop - clientHeight < 50;\n              setIsAutoScroll(isBottom);\n            }}\n            className={\`flex-1 overflow-y-auto p-4 md:p-8 space-y-6 relative \${isDragging ? 'bg-indigo-950/20' : ''}\`}\n          >`
);

// 6. auto scroll useEffect
content = content.replace(
  `  useEffect(() => {\n    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });\n  }, [messages, isTyping]);`,
  `  useEffect(() => {\n    if (isAutoScroll) {\n      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });\n    }\n  }, [messages, isTyping, isAutoScroll]);`
);

// 7. drag logic & selection
content = content.replace(
  `                  drag="x"\n                  dragConstraints={{ left: 0, right: 100 }}\n                  dragElastic={0.2}\n                  onDragEnd={(_, info) => {\n                    if (info.offset.x > 50) {\n                      setReplyTo(msg);\n                      showNotification(\`Replying to \${msg.role === 'user' ? 'Boss' : 'Mhiee'}... ✨\`);\n                    }\n                  }}\n                  className={\`flex group/msg relative \${msg.role === 'user' ? 'justify-end' : 'justify-start'}\`}`,
  `                  drag={msg.role === 'user' ? "x" : false}\n                  dragConstraints={{ left: 0, right: 100 }}\n                  dragElastic={0.2}\n                  onDragEnd={(_, info) => {\n                    if (info.offset.x > 50) {\n                      setReplyTo(msg);\n                      showNotification(\`Replying to \${msg.role === 'user' ? 'Boss' : 'Mhiee'}... ✨\`);\n                    }\n                  }}\n                  style={{ userSelect: msg.role === 'user' ? 'none' : 'auto' }}\n                  className={\`flex group/msg relative \${msg.role === 'user' ? 'justify-end' : 'justify-start'} \${msg.role !== 'user' ? 'select-text' : ''}\`}`
);

// 8. new buttons
content = content.replace(
  `                            <button \n                              onClick={() => copyToClipboard(msg.text || '')}\n                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md border border-zinc-700 shadow-sm transition-colors"\n                              title="Copy to clipboard"\n                            >\n                              <Copy className="w-3.5 h-3.5" />\n                            </button>\n                          </div>`,
  `                            <button \n                              onClick={() => copyToClipboard(msg.text || '')}\n                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md border border-zinc-700 shadow-sm transition-colors"\n                              title="Copy to clipboard"\n                            >\n                              <Copy className="w-3.5 h-3.5" />\n                            </button>\n                            <button \n                              onClick={() => regenerateMessage(idx)}\n                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md border border-zinc-700 shadow-sm transition-colors"\n                              title="Regenerate response"\n                            >\n                              <RefreshCw className="w-3.5 h-3.5" />\n                            </button>\n                            <button \n                              onClick={() => {\n                                setReplyTo(msg);\n                                showNotification('Replying to Mhiee... ✨');\n                              }}\n                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md border border-zinc-700 shadow-sm transition-colors"\n                              title="Reply"\n                            >\n                              <MessageCircle className="w-3.5 h-3.5" />\n                            </button>\n                          </div>`
);

// 9. Send button -> Stop Generation
content = content.replace(
  `              {/* Send Button moved outside */}\n              <button\n                type="button"\n                onClick={() => sendMessage(input, selectedFiles)}\n                disabled={isTyping || (!input.trim() && selectedFiles.length === 0)}\n                className="p-5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center shadow-lg"\n                aria-label="Send message"\n              >\n                {isTyping ? (\n                  <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />\n                ) : (\n                  <Send className="w-7 h-7" />\n                )}\n              </button>`,
  `              {/* Send Button moved outside */}\n              {isTyping ? (\n                <button\n                  type="button"\n                  onClick={handleStopGeneration}\n                  className="p-5 bg-red-600 text-white rounded-2xl hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center shadow-lg group relative"\n                  aria-label="Stop generation"\n                >\n                  <StopCircle className="w-7 h-7" />\n                  <span className="absolute -top-8 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Stop</span>\n                </button>\n              ) : (\n                <button\n                  type="button"\n                  onClick={() => sendMessage(input, selectedFiles)}\n                  disabled={!input.trim() && selectedFiles.length === 0}\n                  className="p-5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center shadow-lg"\n                  aria-label="Send message"\n                >\n                  <Send className="w-7 h-7" />\n                </button>\n              )}`
);

fs.writeFileSync('src/components/MhieeBrowser.tsx', content);
console.log('Done patching.');
