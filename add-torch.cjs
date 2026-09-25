const fs = require('fs');
let code = fs.readFileSync('src/components/MhieeBrowser.tsx', 'utf8');

// 1. Add isTorchActive state
if (!code.includes('const [isTorchActive')) {
    code = code.replace(
      'const [isCameraActive, setIsCameraActive] = useState(false);',
      'const [isCameraActive, setIsCameraActive] = useState(false);\n  const [isTorchActive, setIsTorchActive] = useState(false);'
    );
}

// 2. Add toggleTorch function below flipCamera
const toggleTorchFunc = `
  const toggleTorch = async () => {
    if (cameraStream) {
      const videoTrack = cameraStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities?.();
          if (capabilities && capabilities.torch) {
            await videoTrack.applyConstraints({
              advanced: [{ torch: !isTorchActive }]
            } as any);
            setIsTorchActive(!isTorchActive);
          } else {
            showNotification("Torchlight is not supported on this device/camera.");
          }
        } catch (error) {
          console.error("Error toggling torch:", error);
          showNotification("Could not toggle torchlight.");
        }
      }
    }
  };
`;
if (!code.includes('const toggleTorch')) {
    code = code.replace(
      '  const flipCamera = () => {',
      toggleTorchFunc + '\n  const flipCamera = () => {'
    );
}

// 3. Reset torch state when stopping camera
if (!code.includes('setIsTorchActive(false);')) {
    code = code.replace(
      'setIsCameraActive(false);\n  };',
      'setIsCameraActive(false);\n    setIsTorchActive(false);\n  };'
    );
}

// 4. Add the Torch button to the UI
const flipBtnStr = `<button onClick={flipCamera} className="p-3 bg-zinc-900/80 text-white rounded-full backdrop-blur-sm border border-zinc-700/50 hover:bg-zinc-800 transition-colors">
                  <FlipHorizontal size={24} />
                </button>`;
                
const torchBtnStr = `<button onClick={toggleTorch} className={\`p-3 \${isTorchActive ? 'bg-yellow-500/80' : 'bg-zinc-900/80'} text-white rounded-full backdrop-blur-sm border border-zinc-700/50 hover:bg-zinc-800 transition-colors\`}>
                  {isTorchActive ? <FlashlightOff size={24} /> : <Flashlight size={24} />}
                </button>`;

if (!code.includes('<Flashlight size={24} />')) {
    code = code.replace(
      flipBtnStr,
      torchBtnStr + '\n                ' + flipBtnStr
    );
}

fs.writeFileSync('src/components/MhieeBrowser.tsx', code);
