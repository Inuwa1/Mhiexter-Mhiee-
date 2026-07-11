import express from "express";
import 'dotenv/config';
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { Readable } from "stream";
import { WebSocket as WS } from 'ws';
import ytdl from '@distube/ytdl-core';
import { Innertube } from 'youtubei.js';

let yt: any;
async function initInnertube() {
  try {
    yt = await Innertube.create();
    console.log("[Innertube] Initialized successfully");
  } catch (e) {
    console.error("[Innertube] Initialization failed:", e);
  }
}
initInnertube();

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
  } catch (e) {
    console.log("[Downloader] fbdl option not registered");
  }

  try {
    instagramGetUrl = await import('instagram-url-direct').then(m => m.default || m);
  } catch (e) {
    console.log("[Downloader] instagram-url-direct option not registered");
  }

  try {
    // Try the source file since tiktok-downloader package lacks raw root index.js
    tiktokdl = await import('tiktok-downloader/src/index.ts').then((m: any) => m.default || m);
  } catch (e) {
    try {
      tiktokdl = await import('tiktok-downloader').then(m => m.default || m);
    } catch (e2) {
      console.log("[Downloader] tiktok-downloader option not registered (using TikWM bypass)");
    }
  }

  try {
    twitterdl = await import('twitter-downloader').then(m => m.TwitterDL || m.default || m);
  } catch (e) {
    console.log("[Downloader] twitter-downloader option not registered");
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
          voice_settings: { 
            stability: 0.38, 
            similarity_boost: 0.88,
            style: 0.15,
            use_speaker_boost: true
          },
          xi_api_key: API_KEY
        }));
      });

      ws.on('message', (data: any) => {
        try {
            const response = JSON.parse(data.toString());
            if (response.audio) {
                socket.emit("tts-audio", response.audio);
            } else if (response.error || (response.detail && response.detail.status)) {
                let msg = response.error?.message || response.detail?.message || "ElevenLabs streaming error";
                if (msg.includes("detected_unusual_activity")) {
                    msg = "Haba Boss! ElevenLabs sun ce Free Tier dinsu ya cika ko kuma muna amfani da VPN. 🥺 Suna so mu sayi 'Paid Plan' tukunna.";
                }
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

      const shortenedDomains = ['vt.tiktok.com', 'vm.tiktok.com', 'fb.watch', 't.co', 'youtu.be', 'bit.ly', 'tinyurl.com', 'facebook.com/share'];
      if (shortenedDomains.some(domain => targetUrl.includes(domain))) {
        try {
          console.log(`[Downloader] Resolving shortened URL: ${targetUrl}`);
          const headRes = await fetch(targetUrl, { 
            method: 'GET',
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(15000)
          });
          targetUrl = headRes.url;
          console.log(`[Downloader] Resolved to: ${targetUrl}`);
        } catch (e: any) {
          console.warn("[Downloader] Could not resolve shortened URL:", e.message);
        }
      }

      let info: any = { url: targetUrl, platform: 'generic' };

      // 1. YouTube
      if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
        try {
          console.log(`[YouTube Info] Attempting extraction with Innertube: ${targetUrl}`);
          let yInfo: any;
          
          if (yt) {
             const video = await yt.getInfo(targetUrl);
             const details = video.basic_info;
             info = {
                title: details.title,
                description: details.short_description?.slice(0, 100) + '...',
                thumbnail: details.thumbnail?.[0]?.url,
                platform: 'youtube',
                type: 'video/mp4',
                author: details.author,
                duration: details.duration,
                hasAudio: true,
                formats: video.streaming_data?.formats?.map((f: any) => ({
                    qualityLabel: f.quality_label || f.quality,
                    container: f.mime_type?.split(';')[0]?.split('/')[1] || 'mp4',
                    url: f.url
                })) || []
             };
          } else {
             console.log("[YouTube Info] Innertube not ready, falling back to ytdl...");
             yInfo = await ytdl.getInfo(targetUrl);
             info = {
                title: yInfo.videoDetails.title,
                description: yInfo.videoDetails.description?.slice(0, 100) + '...',
                thumbnail: yInfo.videoDetails.thumbnails.pop()?.url,
                platform: 'youtube',
                type: 'video/mp4',
                author: yInfo.videoDetails.author.name,
                platform_info: 'ytdl-core',
                hasAudio: true,
                formats: yInfo.formats.filter(f => f.hasVideo && f.hasAudio).map(f => ({
                  qualityLabel: f.qualityLabel,
                  container: f.container,
                  url: f.url
                }))
             };
          }
        } catch (e: any) { 
          console.error("[YouTube Info] Error:", e.message);
          info.error = `Extraction failed: ${e.message}`; 
          
          // Last ditch effort with ytdl if Innertube failed
          if (yt && !targetUrl.includes('youtube.com/watch?v=')) {
              try {
                  console.log("[YouTube Info] retrying with ytdl-core after Innertube fail...");
                  const yInfo = await ytdl.getInfo(targetUrl);
                  info = {
                    title: yInfo.videoDetails.title,
                    thumbnail: yInfo.videoDetails.thumbnails.pop()?.url,
                    platform: 'youtube',
                    hasAudio: true
                  };
                  delete info.error;
              } catch(e2) {}
          }
        }
      }
      // 2. Facebook
      else if (targetUrl.includes('facebook.com') || targetUrl.includes('fb.watch') || targetUrl.includes('fb.com')) {
        // Normalize Facebook URL for fbdl-core
        let normalizedUrl = targetUrl
            .replace('web.facebook.com', 'www.facebook.com')
            .replace('m.facebook.com', 'www.facebook.com')
            .replace('facebook.com/reel/', 'facebook.com/watch/?v=')
            .replace('facebook.com/reels/', 'facebook.com/watch/?v=')
            .replace('facebook.com/share/v/', 'facebook.com/watch/?v=')
            .replace('facebook.com/share/r/', 'facebook.com/watch/?v=')
            .replace('facebook.com/share/p/', 'facebook.com/watch/?v=')
            .split('?')[0]; // Start fresh if it's a complicated shared URL
        
        // Re-construct the search param if we have a watch link or extracted an ID
        if (targetUrl.includes('watch/?v=')) {
           const vId = new URL(targetUrl.replace('fb.com', 'facebook.com')).searchParams.get('v');
           if (vId) normalizedUrl = `https://www.facebook.com/watch/?v=${vId}`;
        }
        
        // Remove tracking params and fix double question marks
        try {
          // If normalization stripped everything, try to salvage ID from path
          if (normalizedUrl === 'https://www.facebook.com/' || normalizedUrl === 'https://www.facebook.com') {
             const parts = targetUrl.split('/');
             const lastPart = parts.slice().reverse().find(p => /^\d+$/.test(p) || (p.length > 10 && !p.includes('.')));
             if (lastPart) normalizedUrl = `https://www.facebook.com/watch/?v=${lastPart}`;
          }

          const u = new URL(normalizedUrl.replace(/\?v=([^&/]+)\?/, '?v=$1&'));
          const paramsToDelete = ['mibextid', 'rdid', 'share_url', 'app', 'ref', 'context', 's', 'checkpoint', 'vh', 'extid', 'substory_index'];
          paramsToDelete.forEach(p => u.searchParams.delete(p));
          
          normalizedUrl = u.toString();
        } catch(e) {
            console.warn("[Facebook] Normalization salvage failed, using original:", e);
            normalizedUrl = targetUrl; // Fallback
        }

        if (fbdl) {
          try {
            console.log(`[Facebook Recon] Attempting extraction: ${normalizedUrl}`);
            const video = await fbdl.getInfo(normalizedUrl);
            info = {
              platform: 'facebook',
              title: video.title || "Facebook Video",
              thumbnail: video.thumbnail,
              formats: [
                video.sd && { qualityLabel: 'SD Quality (360p)', container: 'mp4', url: video.sd },
                video.hd && { qualityLabel: 'HD Quality (720p/1080p)', container: 'mp4', url: video.hd }
              ].filter(Boolean) as any,
              duration: video.duration,
              hasAudio: true
            };
            delete info.error;
          } catch (e: any) { 
            console.error("[Facebook Info] Error:", e.message);
            info.platform = 'facebook';
            info.title = "Facebook Video (Neural Fallback Activated)";
            // Don't set info.error yet, let generic fallback try
            info.extraction_failed = true;
          }
        }
      }
      // 3. Instagram
      else if (targetUrl.includes('instagram.com')) {
        if (instagramGetUrl) {
          try {
            console.log(`[Instagram Recon] Infiltrating IG matrix: ${targetUrl}`);
            const result = await instagramGetUrl(targetUrl);
            
            if (result && result.url_list && result.url_list.length > 0) {
                info = {
                  title: "Instagram Post/Reel Captured",
                  thumbnail: result.url_list[0], 
                  platform: 'instagram',
                  type: 'video/mp4',
                  formats: result.url_list.map((url: string, i: number) => ({
                      qualityLabel: result.url_list.length > 1 ? `Media Stream ${i + 1}` : 'Detected Stream (High)',
                      container: 'mp4',
                      url: url
                  })),
                  hasAudio: true
                };
                delete info.error;
                delete info.extraction_failed;
            } else {
                info.extraction_failed = true;
            }
          } catch (e: any) { 
            console.error("[Instagram Info] Error:", e.message);
            info.extraction_failed = true;
          }
        }
      }
      // 4. TikTok
      else if (targetUrl.includes('tiktok.com')) {
          try {
            console.log("[TikTok] Infiltrating via secondary bypass...");
            const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`, {
              signal: AbortSignal.timeout(10000)
            });
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
            info.error = `Extraction failed: ${e.message}`;
          }
      }

      // Generic Fallback
      if (info.platform === 'generic' || info.error || info.extraction_failed) {
        try {
          console.log(`[Neutral Infiltrator] Analyzing generic site: ${targetUrl}`);
          const scrapeRes = await fetch(targetUrl, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9'
            },
            signal: AbortSignal.timeout(15000)
          });
          
          if (scrapeRes.ok) {
            const html = await scrapeRes.text();
            
            // Look for basic meta tags first
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            const ogTitle = html.match(/property="og:title" content="(.*?)"/i) || html.match(/name="twitter:title" content="(.*?)"/i);
            const ogImage = html.match(/property="og:image" content="(.*?)"/i) || html.match(/name="twitter:image" content="(.*?)"/i);
            const ogVideo = html.match(/property="og:video" content="(.*?)"/i) || html.match(/property="og:video:url" content="(.*?)"/i);
            const ogDirect = html.match(/property="og:video:secure_url" content="(.*?)"/i);
            
            info.title = ogTitle?.[1] || titleMatch?.[1] || info.title || "Generic Infiltration Target";
            info.thumbnail = ogImage?.[1] || info.thumbnail;
            
            const videoUrl = ogDirect?.[1] || ogVideo?.[1];

            if (videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('.m3u8') || videoUrl.includes('fbcdn') || videoUrl.includes('googlevideo') || videoUrl.includes('cdninstagram'))) {
                info.formats = [{ qualityLabel: 'Force Capture Stream', container: videoUrl.includes('.m3u8') ? 'hls' : 'mp4', url: videoUrl }];
                info.platform = 'Neural Universal Infiltration';
                delete info.error;
                delete info.extraction_failed;
            } else {
                // Try to find JSON blobs or hidden script variables
                const blobPattern = /"browser_native_sd_url":"([^"]+)"|"browser_native_hd_url":"([^"]+)"/g;
                const matches = [...html.matchAll(blobPattern)];
                if (matches.length > 0) {
                    info.formats = matches.map(m => ({ 
                      qualityLabel: m[1] ? 'Detected SD' : 'Detected HD', 
                      container: 'mp4', 
                      url: (m[1] || m[2]).replace(/\\/g, '') 
                    }));
                    info.platform = 'Neural Data Extraction';
                    delete info.error;
                    delete info.extraction_failed;
                }

                // Try to find video tags or direct links with media extensions
                const mediaPattern = /"(https?:\/\/[^" \n]+\.(?:mp4|m3u8|webm|mov|mkv|ts|avi)(?:\?[^" \n]*)?)"/gi;
                const foundMedia = [...html.matchAll(mediaPattern)].map(m => m[1]);
                
                const videoSrcMatch = html.match(/<video[^>]*src="([^"]+)"/i) || 
                                     html.match(/<source[^>]*src="([^"]+)"/i) ||
                                     html.match(/data-video-url="([^"]+)"/i);
                
                if (videoSrcMatch?.[1]) {
                    let extractedUrl = videoSrcMatch[1];
                    if (extractedUrl.startsWith('//')) extractedUrl = 'https:' + extractedUrl;
                    else if (extractedUrl.startsWith('/')) {
                        const baseUrl = new URL(targetUrl);
                        extractedUrl = baseUrl.origin + extractedUrl;
                    }
                    info.formats = [{ qualityLabel: 'Detected Stream', container: extractedUrl.includes('.m3u8') ? 'hls' : 'mp4', url: extractedUrl }];
                    info.platform = 'Neural Deep Scan';
                    delete info.error;
                    delete info.extraction_failed;
                } else if (foundMedia.length > 0) {
                    info.formats = foundMedia.slice(0, 8).map((url, i) => ({
                        qualityLabel: `Infiltrated ${i + 1}`,
                        container: url.includes('.m3u8') ? 'hls' : 'mp4',
                        url: url
                    }));
                    info.platform = 'Imperial Recon';
                    delete info.error;
                    delete info.extraction_failed;
                } else if (process.env.GEMINI_API_KEY) {
                    console.log("[Neural Infiltrator] Invoking AI for Extreme Extraction...");
                    try {
                        const { GoogleGenAI } = await import("@google/genai");
                        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                        
                        const prompt = `INFILTRATION TASK: You are the 'Red Chip' Neural Processor. Break the encryption of this shafin matrix and find the direct video stream URL.
                        Look for: MP4, M3U8, or high-speed CDN links like fbcdn.net, akamaized.net, or googlevideo.com.
                        Site: ${targetUrl}
                        Ignore trackers, ads, and UI scripts. 
                        Return ONLY the absolute URL. If not found, return "NULL".
                        HTML Snippet (truncated): ${html.slice(0, 35000)}`;
                        
                        const result = await ai.models.generateContent({
                            model: "gemini-2.0-flash-exp",
                            contents: [{ parts: [{ text: prompt }] }]
                        });
                        
                        const extractedUrl = result.text?.trim()?.replace(/["'`]/g, '') || "";
                        
                        if (extractedUrl && extractedUrl !== "NULL" && (extractedUrl.startsWith('http') || extractedUrl.startsWith('https'))) {
                            info.formats = [{ qualityLabel: 'Neural Capture', container: (extractedUrl.includes('.m3u8') || extractedUrl.includes('.m3u')) ? 'hls' : 'mp4', url: extractedUrl }];
                            info.platform = 'Neural Infiltration (AI)';
                            delete info.error;
                            delete info.extraction_failed;
                        }
                    } catch (geminiErr) {
                        console.error("[Neural Infiltrator] AI Extraction Fail:", geminiErr);
                    }
                }
            }
          }
        } catch (e) {
          console.warn("[Neural Infiltrator] Scrape failed:", e);
        }

        if (info.platform === 'generic' || info.extraction_failed) {
          const response = await fetch(targetUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          }).catch(() => null);
          
          if (response) {
            const contentType = response.headers.get("content-type") || "";
            
            // If it's an HTML page and we found NO formats yet
            if (contentType.includes('text/html') && (!info.formats || info.formats.length === 0)) {
                if (targetUrl.includes('facebook.com') || targetUrl.includes('instagram.com')) {
                   info.error = "Haba Boss! Wannan link din yana bukatar shiga (Login) ne ko kuma shafin sirri (Private) ne. 🔒 Mhiee ta yi kokarin kutsawa amma an kulle kofofin. Amfani da link din da kowa zai iya gani mana! ✨";
                } else {
                   info.error = "Ayyah! Mhiee ba ta samu asalin bidiyon a wannan shafin ba. 🕵️‍♀️ Na yi kokarin Neural Deep Infiltration amma shafin ya ki bada hadin kai. Ko dai link din ya mutu, ko kuma an toshe bayanan.";
                }
            } else {
                const urlObj = new URL(targetUrl);
                const filename = path.basename(urlObj.pathname).split('?')[0] || "file";
                info = {
                  ...info,
                  title: info.title || filename,
                  type: info.type || contentType || 'video/mp4',
                  size: response.headers.get("content-length")
                };
                delete info.error;
                delete info.extraction_failed;
            }
          }
        }
      }

      res.json(info);
    } catch (error: any) {
      console.error("[ProxyInfo] Final catch:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scrape-web", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: "Missing or invalid url query parameter." });
    try {
      console.log(`[Scraper] Scraped request received: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch the page: HTTP status ${response.status}`);
      }
      const html = await response.text();
      
      let text = html;
      text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
      text = text.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, ' ');
      text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ');
      text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');
      text = text.replace(/<br\s*\/?>/gi, '\n');
      text = text.replace(/<\/p>|<\/div>|<\/li>/gi, '\n');
      text = text.replace(/<h[1-6]\b[^>]*>(.*?)<\/h[1-6]>/gi, '\n# $1\n');
      text = text.replace(/<[^>]+>/g, ' ');
      text = text.replace(/&nbsp;/g, ' ')
                 .replace(/&amp;/g, '&')
                 .replace(/&lt;/g, '<')
                 .replace(/&gt;/g, '>')
                 .replace(/&quot;/g, '"')
                 .replace(/&#39;/g, "'");

      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      const cleaned = lines.slice(0, 150).join('\n');

      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "Untitled Webpage";

      res.json({ url: targetUrl, title, content: cleaned });
    } catch (error: any) {
      console.error("[Scraper] Error scraping:", error.message);
      res.status(500).json({ error: `Could not scrape page: ${error.message}` });
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
        },
        signal: AbortSignal.timeout(10000)
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
      res.status(500).send(`Network error: ${error.message}`);
    }
  });

  app.get("/api/proxy-download", async (req, res) => {
    let targetUrl = req.query.url as string;
    const mode = (req.query.mode as string) || 'video';
    if (!targetUrl) return res.status(400).send("Missing URL");

    try {
      console.log(`[Downloader] Starting internal infiltration: ${targetUrl} (Mode: ${mode})`);

      const shortenedDomains = ['vt.tiktok.com', 'vm.tiktok.com', 'fb.watch', 't.co', 'youtu.be', 'bit.ly', 'tinyurl.com', 'facebook.com/share'];
      if (shortenedDomains.some(domain => targetUrl.includes(domain))) {
        try {
          const headRes = await fetch(targetUrl, { method: 'GET', redirect: 'follow' });
          targetUrl = headRes.url;
        } catch (e) {}
      }

      // Normalize Facebook URLs early
      if (targetUrl.includes('facebook.com') || targetUrl.includes('fb.watch') || targetUrl.includes('fb.com')) {
        targetUrl = targetUrl
            .replace('web.facebook.com', 'www.facebook.com')
            .replace('m.facebook.com', 'www.facebook.com')
            .replace('facebook.com/reel/', 'facebook.com/watch/?v=')
            .replace('facebook.com/reels/', 'facebook.com/watch/?v=')
            .replace('facebook.com/share/v/', 'facebook.com/watch/?v=')
            .replace('facebook.com/share/r/', 'facebook.com/watch/?v=');
        
        try {
          const u = new URL(targetUrl.replace(/\?v=([^&/]+)\?/, '?v=$1&'));
          const paramsToDelete = ['mibextid', 'rdid', 'share_url', 'app', 'ref', 'context', 's', 'checkpoint'];
          paramsToDelete.forEach(p => u.searchParams.delete(p));
          
          if (u.pathname === '/watch/' && !u.searchParams.get('v')) {
              const parts = targetUrl.split('/');
              const lastPart = parts.slice().reverse().find(p => /^\d+$/.test(p));
              if (lastPart) u.searchParams.set('v', lastPart);
          }
          
          targetUrl = u.toString();
        } catch(e) {}
      }

      const pipeFile = async (url: string, filename: string, contentType: string) => {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': url.includes('tiktok.com') ? 'https://www.tiktok.com/' : new URL(url).origin
            },
            signal: AbortSignal.timeout(30000) // Increase timeout for large downloads
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
              if (yt) {
                  console.log(`[YouTube Download] Attempting with Innertube: ${targetUrl}`);
                  const video = await yt.getInfo(targetUrl);
                  const title = video.basic_info.title?.replace(/[^\w\s]/gi, '_') || `youtube_${Date.now()}`;
                  
                  const options: any = mode === 'audio' ? { type: 'audio', quality: 'best' } : { type: 'video+audio', quality: 'best', format: 'mp4' };
                  const stream = await video.download(options);
                  
                  res.setHeader('Content-Type', mode === 'audio' ? 'audio/mpeg' : 'video/mp4');
                  res.setHeader('Content-Disposition', `attachment; filename="${title}.${mode === 'audio' ? 'mp3' : 'mp4'}"`);
                  
                  // Convert web stream to node readable
                  const nodeStream = Readable.fromWeb(stream as any);
                  return nodeStream.pipe(res);
              } else {
                  throw new Error("Innertube not initialized");
              }
            } catch (e: any) {
               console.error("[YouTube Handler] Innertube Fail:", e.message);
               try {
                  console.log("[YouTube Handler] Trying ytdl-core fallback...");
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
               } catch (e2: any) {
                  console.error("[YouTube Handler] ytdl-core Fail:", e2.message);
                  return await pipeFile(targetUrl, `youtube_mhiee_${Date.now()}.mp4`, 'video/mp4');
               }
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

  app.use(express.json()); // Enable JSON body parsing for the TTS route

  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, action, base64ImageData, mimeType } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      if (action === "edit" && base64ImageData && mimeType) {
        // According to the new SDK, editImage can be used.
        // Or we can fallback to generateContent if editImage is not easily accessible.
        const response = await ai.models.editImage({
          model: 'imagen-3.0-capability-001',
          prompt: `${prompt}. IMPORTANT: Ensure the editing looks completely natural and not like AI editing.`,
          referenceImages: [{
            base64: base64ImageData,
            mimeType: mimeType
          }],
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
          }
        });

        let base64Bytes = response.generatedImages?.[0]?.image?.imageBytes;

        if (base64Bytes) {
          res.json({ generatedImage: `data:image/jpeg;base64,${base64Bytes}` });
        } else {
          res.status(500).json({ error: "Failed to generate image bytes" });
        }

      } else {
         const mandatoryDescriptors = "Photorealistic, 8k resolution, cinematic lighting (Ray Tracing), HDR, micro-details (skin pores, water reflections, realistic textures, weave/grain), sharp focus, professional high-end photography. No digital art, no painting.";
         const finalPrompt = `${mandatoryDescriptors} - Subject: ${prompt}`;
         
         const response = await ai.models.generateImages({
           model: 'imagen-3.0-generate-002',
           prompt: finalPrompt,
           config: {
             numberOfImages: 1,
             aspectRatio: "1:1",
             outputMimeType: "image/jpeg"
           }
         });

         let base64Bytes = response.generatedImages?.[0]?.image?.imageBytes;

         if (base64Bytes) {
           res.json({ generatedImage: `data:image/jpeg;base64,${base64Bytes}` });
         } else {
           res.status(500).json({ error: "Failed to generate image bytes" });
         }
      }
    } catch (e: any) {
      console.error("[Image Generation API] Error:", e);
      res.status(500).json({ error: e.message || "Failed to generate image" });
    }
  });

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
                stability: 0.38,
                similarity_boost: 0.88,
                style: 0.15,
                use_speaker_boost: true
              }
            })
          });
    
          if (!response.ok) {
            const errText = await response.text().catch(() => "Unknown error");
            console.error("ElevenLabs API Error Response:", errText);
            try {
              const errData = JSON.parse(errText);
              const detail = errData.detail;
              let msg = detail?.message || detail?.status || detail?.code || "Vocal connection failed";
              
              if (errText.includes("detected_unusual_activity")) {
                 msg = "Haba Boss! ElevenLabs sun ce Free Tier dinsu ya cika ko kuma muna amfani da VPN. 🥺 Suna so mu sayi 'Paid Plan' tukunna.";
              } else if (errText.includes("insufficient_credits")) {
                 msg = "Ayyah Boss! Kudin ElevenLabs dinka sun kare. 🥺 Sai mun sake sakawa tukunna!";
              }

              throw new Error(`ElevenLabs error: ${msg}`);
            } catch (e: any) {
              if (e.message.includes("ElevenLabs error:")) throw e;
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("GEMINI_API_KEY available:", !!process.env.GEMINI_API_KEY);
  });
}

startServer();
