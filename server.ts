import express from "express";
import 'dotenv/config';
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import path from "path";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  
  // Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

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

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // Optional: notify rooms that peer left
    });
  });

  // API route for configuration
  app.get("/api/config", (req, res) => {
    console.log("Received request for /api/config");
    const key = process.env.GEMINI_API_KEY;
    
    res.json({
      GEMINI_API_KEY: key || "MISSING_KEY",
    });
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
