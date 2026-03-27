import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { Share2, Download, Upload, CheckCircle, XCircle, Loader2, Copy, Camera } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

const CHUNK_SIZE = 16384; // 16KB chunks for WebRTC DataChannel

export default function FileShare() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomIdState] = useState('');
  const roomIdRef = useRef('');

  const setRoomId = (id: string) => {
    setRoomIdState(id);
    roomIdRef.current = id;
  };
  const [connected, setConnected] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [status, setStatus] = useState<string>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  
  // File transfer state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transferProgress, setTransferProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { exact: "environment" } } 
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      // Fallback to any camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(stream);
        setIsCameraActive(true);
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
        }
      } catch (err2) {
        alert("Could not access camera.");
      }
    }
  };

  const captureCamera = () => {
    if (cameraVideoRef.current && canvasRef.current) {
      const video = cameraVideoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      
      // Convert dataUrl to File
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "camera-photo.png", { type: "image/png" });
          setSelectedFile(file);
          setTransferComplete(false);
          setTransferProgress(0);
        });
      
      stopCamera();
    }
  };
  const [incomingFileMeta, setIncomingFileMetaState] = useState<{ name: string; size: number; type: string } | null>(null);
  const incomingFileMetaRef = useRef<{ name: string; size: number; type: string } | null>(null);

  const setIncomingFileMeta = (meta: { name: string; size: number; type: string } | null) => {
    setIncomingFileMetaState(meta);
    incomingFileMetaRef.current = meta;
  };
  const [transferComplete, setTransferComplete] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const receiveBufferRef = useRef<ArrayBuffer[]>([]);
  const receivedSizeRef = useRef(0);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isRemoteDescriptionSetRef = useRef(false);

  useEffect(() => {
    // Connect to the signaling server
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setStatus('Connected to signaling server');
    });

    newSocket.on('room-created', (id) => {
      setIsCreator(true);
      setRoomId(id);
      setStatus(`Room created. Waiting for peer to join...`);
    });

    newSocket.on('room-joined', (id) => {
      setIsCreator(false);
      setRoomId(id);
      setStatus('Joined room. Connecting to peer...');
      // The joiner initiates the WebRTC offer
      initiateConnection(newSocket, id);
    });

    newSocket.on('room-full', () => {
      setError('Room is full. Only 2 devices allowed per room.');
      setStatus('Disconnected');
    });

    newSocket.on('peer-joined', (peerId) => {
      setStatus('Peer joined! Waiting for connection...');
    });

    newSocket.on('offer', async (data) => {
      setStatus('Received offer, creating answer...');
      await handleOffer(newSocket, data.offer, data.sender);
    });

    newSocket.on('answer', async (data) => {
      setStatus('Received answer, establishing connection...');
      await handleAnswer(data.answer);
    });

    newSocket.on('ice-candidate', async (data) => {
      await handleIceCandidate(data.candidate);
    });

    return () => {
      newSocket.disconnect();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const setupPeerConnection = (socketInstance: Socket, targetRoom: string) => {
    isRemoteDescriptionSetRef.current = false;
    pendingCandidatesRef.current = [];
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketInstance.emit('ice-candidate', { roomId: targetRoom, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnected(true);
        setStatus('Connected to peer! Ready to transfer.');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnected(false);
        setStatus('Peer disconnected.');
        setError('Connection lost.');
      }
    };

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      setupDataChannel(receiveChannel);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';
    
    channel.onopen = () => {
      console.log('Data channel open');
    };

    channel.onclose = () => {
      console.log('Data channel closed');
    };

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'meta') {
          setIncomingFileMeta({ name: msg.name, size: msg.size, type: msg.fileType });
          receiveBufferRef.current = [];
          receivedSizeRef.current = 0;
          setIsTransferring(true);
          setTransferProgress(0);
          setTransferComplete(false);
          setStatus(`Receiving file: ${msg.name}...`);
          startTimeRef.current = Date.now();
          setEstimatedTime(null);
        } else if (msg.type === 'eof') {
          // File transfer complete
          const meta = incomingFileMetaRef.current;
          const blob = new Blob(receiveBufferRef.current, { type: meta?.type || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          // Trigger download
          const a = document.createElement('a');
          a.href = url;
          a.download = meta?.name || 'downloaded-file';
          a.click();
          
          receiveBufferRef.current = [];
          setIsTransferring(false);
          setTransferProgress(100);
          setTransferComplete(true);
          setStatus('File received successfully!');
          
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
      } else {
        // Receiving binary chunk
        receiveBufferRef.current.push(event.data);
        receivedSizeRef.current += event.data.byteLength;
        
        const meta = incomingFileMetaRef.current;
        if (meta) {
          const progress = (receivedSizeRef.current / meta.size) * 100;
          setTransferProgress(progress);
          
          // Calculate time remaining
          if (startTimeRef.current && receivedSizeRef.current > 0) {
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            const bytesPerSecond = receivedSizeRef.current / elapsed;
            const remainingBytes = meta.size - receivedSizeRef.current;
            const secondsRemaining = remainingBytes / bytesPerSecond;
            
            const minutes = Math.floor(secondsRemaining / 60);
            const seconds = Math.floor(secondsRemaining % 60);
            setEstimatedTime(`${minutes}m ${seconds}s remaining`);
          }
        }
      }
    };

    dataChannelRef.current = channel;
  };

  const initiateConnection = async (socketInstance: Socket, targetRoom: string) => {
    const pc = setupPeerConnection(socketInstance, targetRoom);
    
    // Create data channel before creating offer
    const dc = pc.createDataChannel('file-transfer', {
      ordered: true
    });
    setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketInstance.emit('offer', { roomId: targetRoom, offer });
  };

  const handleOffer = async (socketInstance: Socket, offer: RTCSessionDescriptionInit, senderId: string) => {
    const currentRoomId = roomIdRef.current;
    const pc = setupPeerConnection(socketInstance, currentRoomId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    isRemoteDescriptionSetRef.current = true;
    
    // Process pending candidates
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding pending ice candidate', e);
      }
    }
    pendingCandidatesRef.current = [];
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketInstance.emit('answer', { roomId: currentRoomId, answer });
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      isRemoteDescriptionSetRef.current = true;
      
      // Process pending candidates
      for (const candidate of pendingCandidatesRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding pending ice candidate', e);
        }
      }
      pendingCandidatesRef.current = [];
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!isRemoteDescriptionSetRef.current) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding received ice candidate', e);
      }
    }
  };

  const createRoom = () => {
    if (!socket) return;
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setError(null);
    socket.emit('join-room', newRoomId);
  };

  const joinRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!socket || !roomId.trim()) return;
    setError(null);
    socket.emit('join-room', roomId.trim().toUpperCase());
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setTransferComplete(false);
      setTransferProgress(0);
    }
  };

  const sendFile = () => {
    if (!selectedFile) return;
    if (!dataChannelRef.current) {
      setError('Connection not fully established. Please wait.');
      return;
    }
    if (dataChannelRef.current.readyState !== 'open') {
      setError(`Data channel is not open (state: ${dataChannelRef.current.readyState}). Please wait or reconnect.`);
      return;
    }

    const dc = dataChannelRef.current;
    setIsTransferring(true);
    setTransferProgress(0);
    setEstimatedTime(null);
    startTimeRef.current = Date.now();
    setStatus(`Sending file: ${selectedFile.name}...`);

    // Send metadata
    dc.send(JSON.stringify({ 
      type: 'meta', 
      name: selectedFile.name, 
      size: selectedFile.size, 
      fileType: selectedFile.type 
    }));

    const reader = new FileReader();
    let offset = 0;

    const readSlice = (o: number) => {
      const slice = selectedFile.slice(o, o + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      if (!e.target || !e.target.result) return;
      
      try {
        dc.send(e.target.result as ArrayBuffer);
        offset += (e.target.result as ArrayBuffer).byteLength;
        const progress = (offset / selectedFile.size) * 100;
        setTransferProgress(progress);
        
        // Calculate time remaining
        if (startTimeRef.current && offset > 0) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const bytesPerSecond = offset / elapsed;
          const remainingBytes = selectedFile.size - offset;
          const secondsRemaining = remainingBytes / bytesPerSecond;
          
          const minutes = Math.floor(secondsRemaining / 60);
          const seconds = Math.floor(secondsRemaining % 60);
          setEstimatedTime(`${minutes}m ${seconds}s remaining`);
        }

        if (offset < selectedFile.size) {
          // Check buffer to avoid overflowing
          if (dc.bufferedAmount > 1024 * 1024 * 5) { // 5MB buffer limit
            dc.onbufferedamountlow = () => {
              dc.onbufferedamountlow = null;
              readSlice(offset);
            };
          } else {
            readSlice(offset);
          }
        } else {
          // Done sending
          dc.send(JSON.stringify({ type: 'eof' }));
          setIsTransferring(false);
          setTransferComplete(true);
          setStatus('File sent successfully!');
        }
      } catch (err) {
        console.error('Error sending data:', err);
        setError('Transfer failed. Connection may have dropped.');
        setIsTransferring(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading file.');
      setIsTransferring(false);
    };

    // Start reading
    readSlice(0);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-500/20 p-2 rounded-xl">
          <Share2 className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Local File Share</h2>
          <p className="text-xs text-zinc-400">High-speed P2P transfer (2.4GHz/5GHz)</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 flex items-start gap-2">
          <XCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Connection Setup */}
      {!connected && (
        <div className="space-y-4">
          {!isCreator && !roomId ? (
            <>
              <button 
                onClick={createRoom}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-indigo-500/20"
              >
                Create Room
              </button>
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink-0 mx-4 text-zinc-500 text-sm">or</span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

              <form onSubmit={joinRoom} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter Room Code" 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 uppercase"
                  maxLength={6}
                />
                <button 
                  type="submit"
                  disabled={!roomId.trim()}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium transition"
                >
                  Join
                </button>
              </form>
            </>
          ) : (
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-zinc-400 text-sm mb-2">Your Room Code</p>
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-4xl font-mono font-bold text-white tracking-widest">{roomId}</span>
                <button onClick={copyRoomId} className="text-zinc-500 hover:text-white transition" title="Copy code">
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 text-indigo-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for peer to connect...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transfer UI */}
      {connected && (
        <div className="space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Connected to peer securely.
          </div>

          <div className="border-2 border-dashed border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors hover:border-indigo-500/50">
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              onChange={handleFileSelect}
              disabled={isTransferring}
            />
            <label 
              htmlFor="file-upload"
              className={`cursor-pointer flex flex-col items-center ${isTransferring ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Upload className="w-10 h-10 text-zinc-500 mb-3" />
              <span className="text-white font-medium mb-1">
                {selectedFile ? selectedFile.name : 'Select a file to send'}
              </span>
              <span className="text-zinc-500 text-sm">
                {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Any file type, any size'}
              </span>
            </label>
            
            <button
              onClick={startCamera}
              className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1"
              disabled={isTransferring}
            >
              <Camera className="w-4 h-4" />
              Use Camera
            </button>
            
            {selectedFile && !isTransferring && !transferComplete && (
              <button 
                onClick={sendFile}
                className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-6 rounded-lg font-medium transition w-full"
              >
                Send File
              </button>
            )}
          </div>

          {/* Camera Preview Modal */}
          <AnimatePresence>
            {isCameraActive && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
                <div className="relative w-full max-w-lg bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
                  <video ref={cameraVideoRef} autoPlay playsInline className="w-full aspect-video bg-black" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="p-4 flex justify-center gap-4">
                    <button onClick={stopCamera} className="px-4 py-2 bg-zinc-800 text-white rounded-lg">Cancel</button>
                    <button onClick={captureCamera} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Capture</button>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>

          {(isTransferring || transferComplete) && (
            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-300 truncate pr-4">
                  {incomingFileMeta ? incomingFileMeta.name : selectedFile?.name}
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-indigo-400 font-mono">{Math.round(transferProgress)}%</span>
                  {estimatedTime && <span className="text-xs text-zinc-500">{estimatedTime}</span>}
                </div>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${transferProgress}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
                {isTransferring ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> {status}</>
                ) : (
                  <><CheckCircle className="w-3 h-3 text-emerald-500" /> {status}</>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
