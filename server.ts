import express from "express";
import 'dotenv/config';
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { WebSocket as WS } from 'ws';
import ytdl from '@distube/ytdl-core';

// Dynamically import CommonJS modules if needed
let fbdl: any;
let instagramGetUrl: any;
let tiktokdl: any;
let twitterdl: any;

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  try {
    fbdl = await import('fbdl-core').then(m => m.default || m);
    instagramGetUrl = await import('instagram-url-direct').then(m => m.default || m);
    tiktokdl = await import('tiktok-downloader').then(m => m.default || m);
    twitterdl = await import('twitter-downloader').then(m => m.TwitterDL || m.default || m);
  } catch (e) {
    console.warn("Downloader libraries failed to load:", e);
  }
  
  // Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const elStreams = new Map<string, WS>();

  const PORT = 3000;

  // Request logging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // WebRTC Signaling Logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
      const room = io.sockets.adapter.rooms.get(roomId);
      const numClients = room ? room.size : 0;

      if (numClients === 0) {
        socket.join(roomId);
        socket.emit("room-created", roomId);
      } else if (numClients === 1) {
        socket.join(roomId);
        socket.emit("room-joined", roomId);
        // Notify the creator that someone joined
        socket.to(roomId).emit("peer-joined", socket.id);
      } else {
        socket.emit("room-full", roomId);
      }
    });

    socket.on("offer", (data) => {
      socket.to(data.roomId).emit("offer", { offer: data.offer, sender: socket.id });
    });

    socket.on("answer", (data) => {
      socket.to(data.roomId).emit("answer", { answer: data.answer, sender: socket.id });
    });

    socket.on("ice-candidate", (data) => {
      socket.to(data.roomId).emit("ice-candidate", { candidate: data.candidate, sender: socket.id });
    });

    // ElevenLabs WebSocket Proxy
    socket.on("start-tts-stream", (data?: { voiceId?: string, apiKey?: string }) => {
      if (elStreams.has(socket.id)) return;

      const VOICE_ID = data?.voiceId || process.env.ELEVENLABS_VOICE_ID || "akzGyDzJs0Ssy2J6GAi6";
      const API_KEY = data?.apiKey || process.env.ELEVENLABS_API_KEY;
      if (!API_KEY) {
          console.error("ElevenLabs API Key missing in environment or user settings");
          return socket.emit("tts-error", "ElevenLabs API Key missing. Please provide it in Settings! ✨");
      }

      const ws = new WS(`wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input?model_id=eleven_multilingual_v2`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          text: " ",
          voice_settings: { stability: 0.4, similarity_boost: 0.8 },
          xi_api_key: API_KEY
        }));
      });

      ws.on('message', (data: any) => {
        try {
            const response = JSON.parse(data.toString());
            if (response.audio) {
                socket.emit("tts-audio", response.audio);
            } else if (response.error || (response.detail && response.detail.status)) {
                const msg = response.error?.message || response.detail?.message || "ElevenLabs streaming error";
                socket.emit("tts-error", msg);
            }
        } catch (e) {
            // Some messages might be binary or something else
        }
      });

      ws.on('error', (err) => {
          console.error("ElevenLabs WS Error:", err);
          socket.emit("tts-error", err.message);
      });
      ws.on('close', () => elStreams.delete(socket.id));

      elStreams.set(socket.id, ws);
    });

    socket.on("send-tts-chunk", (chunk: string) => {
      const ws = elStreams.get(socket.id);
      if (ws && ws.readyState === WS.OPEN) {
        ws.send(JSON.stringify({
          text: chunk,
          try_trigger_generation: true
        }));
      }
    });

    socket.on("stop-tts-stream", () => {
        const ws = elStreams.get(socket.id);
        if (ws) {
            if (ws.readyState === WS.OPEN) ws.send(JSON.stringify({ text: "" })); 
            ws.close();
            elStreams.delete(socket.id);
        }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      const ws = elStreams.get(socket.id);
      if (ws) ws.close();
      elStreams.delete(socket.id);
    });
  });

  // API route for configuration
  app.get("/api/config", (req, res) => {
    console.log("Received request for /api/config");
    const key = process.env.GEMINI_API_KEY;
    
    res.json({
      GEMINI_API_KEY: key || "MISSING_KEY",
      ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || "akzGyGyDzJs0Ssy2J6GAi6",
    });
  });

  app.get("/api/proxy-info", async (req, res) => {
    let targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: "Missing URL" });

    try {
      console.log(`[Info] Analyzing: ${targetUrl}`);

      // 0. Handle Shortened URLs (Redirect Follower)
      // Comprehensive list of shortened social media domains
      const shortenedDomains = ['vt.tiktok.com', 'vm.tiktok.com', 'fb.watch', 't.co', 'youtu.be', 'bit.ly', 'tinyurl.com'];
      if (shortenedDomains.some(domain => targetUrl.includes(domain))) {
        try {
          console.log(`[Downloader] Resolving shortened URL: ${targetUrl}`);
          const headRes = await fetch(targetUrl, { 
            method: 'GET', // Sometimes HEAD doesn't trigger redirects on all platforms
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1' }
          });
          targetUrl = headRes.url;
          console.log(`[Downloader] Resolved to: ${targetUrl}`);
        } catch (e) {
          console.warn("[Downloader] Could not resolve shortened URL:", e);
        }
      }

      let info: any = { url: targetUrl, platform: 'generic' };

      // 1. YouTube
      if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
        try {
          const yInfo = await ytdl.getInfo(targetUrl);
          info = {
            title: yInfo.videoDetails.title,
            description: yInfo.videoDetails.description?.slice(0, 100) + '...',
            thumbnail: yInfo.videoDetails.thumbnails.pop()?.url,
            platform: 'youtube',
            type: 'video/mp4',
            author: yInfo.videoDetails.author.name,
            size: null,
            hasAudio: true,
            formats: yInfo.formats.filter(f => f.hasVideo && f.hasAudio).map(f => ({
              qualityLabel: f.qualityLabel,
              container: f.container,
              url: f.url
            }))
          };
        } catch (e: any) { 
          console.error("[YouTube Info] Error:", e.message);
          info.error = "Extraction failed"; 
        }
      }
      // 2. Facebook
      else if (targetUrl.includes('facebook.com') || targetUrl.includes('fb.watch')) {
        if (fbdl) {
          try {
            const video = await fbdl.getInfo(targetUrl);
            info = {
              title: video.title || "Facebook Video",
              thumbnail: video.thumbnail,
              platform: 'facebook',
              type: 'video/mp4',
              duration: video.duration,
              hasAudio: true
            };
          } catch (e: any) { 
            console.error("[Facebook Info] Error:", e.message);
            info.error = "Extraction failed";
          }
        }
      }
      // 3. Instagram
      else if (targetUrl.includes('instagram.com')) {
        if (instagramGetUrl) {
          try {
            const result = await instagramGetUrl(targetUrl);
            info = {
              title: "Instagram Post",
              thumbnail: result.url_list?.[0], 
              platform: 'instagram',
              type: 'video/mp4',
              hasAudio: true
            };
          } catch (e: any) { 
            console.error("[Instagram Info] Error:", e.message);
            info.error = "Extraction failed";
          }
        }
      }
      // 4. TikTok
      else if (targetUrl.includes('tiktok.com')) {
          try {
            console.log("[TikTok] Infiltrating via secondary bypass...");
            // Use tikwm API for more reliable extraction (non-watermark)
            const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`);
            const tikData = await tikRes.json();
            
            if (tikData.code === 0 && tikData.data) {
                info = {
                  title: tikData.data.title || "TikTok Video",
                  thumbnail: tikData.data.cover,
                  platform: 'tiktok',
                  type: 'video/mp4',
                  author: tikData.data.author?.nickname,
                  size: tikData.data.size,
                  hasAudio: !!tikData.data.music
                };
            } else if (tiktokdl) {
                // Fallback to library
                const result = await tiktokdl(targetUrl);
                info = {
                  title: result.result?.description || "TikTok Video",
                  thumbnail: result.result?.cover,
                  platform: 'tiktok',
                  type: 'video/mp4',
                  author: result.result?.author?.nickname,
                  hasAudio: true
                };
            }
          } catch (e: any) { 
            console.error("[TikTok Info] Error:", e.message);
            info.error = "Extraction failed";
          }
      }

      // Generic Fallback
      if (info.platform === 'generic') {
        const response = await fetch(targetUrl, { method: 'HEAD' });
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const filename = path.basename(new URL(targetUrl).pathname) || "file";
        info = {
          title: filename,
          type: contentType,
          platform: 'generic',
          size: response.headers.get("content-length")
        };
      }

      res.json(info);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/image-proxy", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("Missing URL");
    
    try {
      console.log(`[ImageProxy] Fetching: ${imageUrl}`);
      const response = await fetch(imageUrl, {
        headers: {
          'Accept': 'image/*, */*'
        }
      });
      
      if (!response.ok) {
          const errBody = await response.text().catch(() => "No error body");
          console.error(`[ImageProxy] External fetch failed (${response.status}):`, errBody.slice(0, 200));
          throw new Error(`External source returned ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type") || "image/jpeg";
      
      if (contentType.includes("text/html")) {
          const text = await response.text();
          console.error(`[ImageProxy] Received HTML instead of image. Content start: ${text.slice(0, 500)}`);
          throw new Error("External source returned HTML instead of an image. It might be a rate limit or a blocked prompt.");
      }

      const arrayBuffer = await response.arrayBuffer();
      
      res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error("[ImageProxy] Error:", error.message);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/proxy-download", async (req, res) => {
    let targetUrl = req.query.url as string;
    const mode = (req.query.mode as string) || 'video';
    if (!targetUrl) return res.status(400).send("Missing URL");

    try {
      console.log(`[Downloader] Starting internal infiltration: ${targetUrl} (Mode: ${mode})`);

      const shortenedDomains = ['vt.tiktok.com', 'vm.tiktok.com', 'fb.watch', 't.co', 'youtu.be', 'bit.ly', 'tinyurl.com'];
      if (shortenedDomains.some(domain => targetUrl.includes(domain))) {
        try {
          const headRes = await fetch(targetUrl, { method: 'GET', redirect: 'follow' });
          targetUrl = headRes.url;
        } catch (e) {}
      }

      const pipeFile = async (url: string, filename: string, contentType: string) => {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': url.includes('tiktok.com') ? 'https://www.tiktok.com/' : new URL(url).origin
            }
          });
          
          if (!response.ok) throw new Error(`External source failed with status ${response.status}`);
          
          const actualType = response.headers.get('content-type');
          if (actualType?.includes('html')) {
            return res.status(400).send("Wannan link din shafin yanar gizo ne (HTML), ba bidiyo/audio ba. 🥺 Saka asalin direct link din mana!");
          }

          res.setHeader('Content-Type', contentType || actualType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          if (response.body) {
             const reader = response.body.getReader();
             while (true) {
               const { done, value } = await reader.read();
               if (done) break;
               if (res.writableEnded) break;
               res.write(value);
             }
             if (!res.writableEnded) res.end();
          } else {
             throw new Error("Source provided no content body.");
          }
        } catch (e: any) {
          console.error(`[PipeFile] Error: ${e.message}`);
          if (!res.headersSent) {
            res.status(500).send(`Forwarding error: ${e.message}`);
          }
        }
      };

      if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
         // Validate it's a real video link, not a search result
         const isVideoUrl = targetUrl.includes('watch?v=') || targetUrl.includes('youtu.be/') || targetUrl.includes('shorts/');
         
         if (isVideoUrl) {
            try {
              const info = await ytdl.getInfo(targetUrl);
              const title = info.videoDetails.title.replace(/[^\w\s]/gi, '_');
              if (mode === 'audio') {
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
                return ytdl(targetUrl, { filter: 'audioonly', quality: 'highestaudio' }).pipe(res);
              } else {
                const format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: f => f.container === 'mp4' && f.hasVideo && f.hasAudio });
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
                return ytdl(targetUrl, { format }).pipe(res);
              }
            } catch (e: any) {
               console.error("[YouTube Handler] Error:", e.message);
               // If ytdl fails, try fallback pipeFile
               return await pipeFile(targetUrl, `youtube_mhiee_${Date.now()}.mp4`, 'video/mp4');
            }
         } else {
            console.log("[Downloader] Detected non-video YouTube link, falling back to infiltration...");
         }
      }

      if (targetUrl.includes('tiktok.com')) {
          const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`);
          const tikData = await tikRes.json();
          let fileUrl = (tikData.code === 0 && tikData.data) ? (mode === 'audio' ? tikData.data.music : (tikData.data.play || tikData.data.hdplay)) : null;
          if (!fileUrl && tiktokdl) {
              const result = await tiktokdl(targetUrl);
              fileUrl = mode === 'audio' ? result.result?.music?.[0] : (result.result?.video?.[0] || result.url);
          }
          if (fileUrl) {
              return await pipeFile(fileUrl, `tiktok_mhiee_${Date.now()}.${mode === 'audio' ? 'mp3' : 'mp4'}`, mode === 'audio' ? 'audio/mpeg' : 'video/mp4');
          }
      }

      if (targetUrl.includes('facebook.com') || targetUrl.includes('fb.watch')) {
          if (fbdl) {
            const video = await fbdl.getInfo(targetUrl);
            const dUrl = video.links['High Quality'] || video.links['Low Quality'];
            if (dUrl) return await pipeFile(dUrl, `fb_mhiee_${Date.now()}.mp4`, 'video/mp4');
          }
      }

      if (targetUrl.includes('instagram.com')) {
          if (instagramGetUrl) {
            const result = await instagramGetUrl(targetUrl);
            const dUrl = result.url_list?.[0];
            if (dUrl) return await pipeFile(dUrl, `ig_mhiee_${Date.now()}.mp4`, 'video/mp4');
          }
      }

      if (targetUrl.includes('twitter.com') || targetUrl.includes('x.com')) {
          if (twitterdl) {
            const result = await twitterdl(targetUrl);
            const dUrl = result.result?.[0]?.url || result.url?.[0]?.url;
            if (dUrl) return await pipeFile(dUrl, `x_mhiee_${Date.now()}.mp4`, 'video/mp4');
          }
      }

      // Generic fallback for any http link
      if (targetUrl.startsWith('http')) {
          const ext = mode === 'audio' ? 'mp3' : 'mp4';
          const mime = mode === 'audio' ? 'audio/mpeg' : 'video/mp4';
          return await pipeFile(targetUrl, `mhiee_file_${Date.now()}.${ext}`, mime);
      }

      res.status(404).send("Ba a iya kwaso asalin file din ba, Boss. 🥺 Link din ya ki bada hadin kai.");
    } catch (error: any) {
      console.error("[Proxy Download] Error:", error.message);
      res.status(500).send(`Ayyah, na kasa dako shi internally: ${error.message}`);
    }
  });
;

  app.use(express.json()); // Enable JSON body parsing for the TTS route

  app.post("/api/tts", async (req, res) => {
    const { text, voiceId, apiKey } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });

    const VOICE_ID = voiceId || process.env.ELEVENLABS_VOICE_ID || "akzGyDzJs0Ssy2J6GAi6";
    const API_KEY = apiKey || process.env.ELEVENLABS_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: "ELEVENLABS_API_KEY is not configured on the server or provided by user" });
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        console.error("ElevenLabs API Error Response:", errText);
        try {
          const errData = JSON.parse(errText);
          throw new Error(`ElevenLabs error: ${errData.detail?.status || "Vocal connection failed"}`);
        } catch (e) {
          throw new Error(`Vocal connection failed (${response.status})`);
        }
      }

      const audioBuffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength
      });
      res.send(Buffer.from(audioBuffer));
    } catch (error: any) {
      console.error("TTS Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("GEMINI_API_KEY available:", !!process.env.GEMINI_API_KEY);
  });
}

startServer();
