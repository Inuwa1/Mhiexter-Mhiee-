export const regenerateLogic = `
  const regenerateMessage = (index: number) => {
    const userMsgIndex = index - 1;
    if (userMsgIndex < 0) return;
    const userMsg = messages[userMsgIndex];
    if (userMsg.role !== 'user') return;
    
    const filesToUse: SelectionFile[] = [];
    if (userMsg.images) {
      userMsg.images.forEach(img => filesToUse.push({ id: Math.random().toString(), name: 'image.png', type: 'image/png', size: 0, data: img }));
    }
    if (userMsg.videos) {
      userMsg.videos.forEach(vid => filesToUse.push({ id: Math.random().toString(), name: 'video.mp4', type: 'video/mp4', size: 0, data: vid }));
    }
    if (userMsg.files) {
      userMsg.files.forEach(f => filesToUse.push({ id: Math.random().toString(), name: f.name, type: f.type, size: 0, data: f.data, textContent: f.textContent }));
    }
    
    setMessages(prev => prev.slice(0, userMsgIndex));
    sendMessage(userMsg.text, filesToUse, []);
  };
`;
