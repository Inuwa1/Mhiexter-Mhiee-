import React, { useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';

export default function MhieeBoard({ onClose }: { onClose: () => void }) {
  const [lines, setLines] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleMouseDown = (e: any) => {
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    
    if (!lastLine || !point) return;

    lastLine.points = lastLine.points.concat([point.x, point.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    setLines([...lines]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full h-full rounded-3xl overflow-hidden backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl flex flex-col">
        <div className="p-4 flex justify-between items-center border-b border-white/10">
          <h2 className="text-white font-sans font-medium text-lg">MhieeBoard Canvas</h2>
          <button onClick={onClose} className="text-white px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20">Close</button>
        </div>
        <div className="flex-1 w-full h-full cursor-crosshair">
          <Stage width={window.innerWidth * 0.9} height={window.innerHeight * 0.8} onMouseDown={handleMouseDown} onMousemove={handleMouseMove} onMouseup={handleMouseUp}>
            <Layer>
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke="#fff"
                  strokeWidth={5}
                  tension={0.5}
                  lineCap="round"
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
