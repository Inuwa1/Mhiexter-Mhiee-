import React, { useState } from 'react';
import { Globe, ArrowLeft, ArrowRight, RefreshCw, Home, Loader2 } from 'lucide-react';

export default function MhiexterBrowser() {
  const [url, setUrl] = useState('https://www.google.com');
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(false);

  const navigateTo = (newUrl: string) => {
    setIsLoading(true);
    setUrl(newUrl);
    setInputUrl(newUrl);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-white">
      <div className="flex items-center gap-2 p-2 bg-zinc-800 border-b border-zinc-700">
        <button className="p-2 hover:bg-zinc-700 rounded-lg"><ArrowLeft className="w-4 h-4" /></button>
        <button className="p-2 hover:bg-zinc-700 rounded-lg"><ArrowRight className="w-4 h-4" /></button>
        <button onClick={() => navigateTo(url)} className="p-2 hover:bg-zinc-700 rounded-lg"><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
        <button onClick={() => navigateTo('https://www.google.com')} className="p-2 hover:bg-zinc-700 rounded-lg"><Home className="w-4 h-4" /></button>
        <input 
          type="text" 
          value={inputUrl} 
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigateTo(inputUrl)}
          className="flex-1 p-2 bg-zinc-950 rounded-lg border border-zinc-700"
        />
        <button onClick={() => navigateTo(inputUrl)} className="p-2 bg-indigo-600 rounded-lg">Go</button>
      </div>
      <div className="relative flex-1 w-full h-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}
        <iframe 
          src={url} 
          className="flex-1 w-full h-full border-none" 
          title="Mhiexter Browser" 
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}
