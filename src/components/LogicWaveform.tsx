import React, { useEffect, useRef } from 'react';

interface LogicWaveformProps {
  history: [number, number][]; // [timeMs, voltage]
}

export const LogicWaveform: React.FC<LogicWaveformProps> = ({ history }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#13161f';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines
    ctx.strokeStyle = '#262b3c';
    ctx.lineWidth = 1;

    // Horizontal Voltage lines (0V, 2.5V, 5V)
    const y0 = height - 20;
    const y5 = 20;
    const yMid = (y0 + y5) / 2;

    ctx.beginPath();
    ctx.moveTo(35, y0);
    ctx.lineTo(width, y0);
    ctx.moveTo(35, yMid);
    ctx.lineTo(width, yMid);
    ctx.moveTo(35, y5);
    ctx.lineTo(width, y5);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText('5.0V', 5, y5 + 4);
    ctx.fillText('2.5V', 5, yMid + 4);
    ctx.fillText('0.0V', 5, y0 + 4);

    if (history.length < 2) return;

    // Render waveform line in purple #8b5cf6
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const tEnd = history[history.length - 1][0];
    const tStart = Math.max(0, tEnd - 5000); // 5-second window
    const tRange = Math.max(100, tEnd - tStart);

    history.forEach(([t, v], idx) => {
      const x = 40 + ((t - tStart) / tRange) * (width - 50);
      const y = y0 - (v / 5.0) * (y0 - y5);
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }, [history]);

  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-2">
      <div className="flex justify-between w-full px-2 text-[11px] text-[#94a3b8] mb-1">
        <span className="font-semibold text-[#a78bfa] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#8b5cf6]"></span> Pin 13 Built-in LED Waveform (0V - 5V)
        </span>
        <span className="font-mono text-[#64748b]">5s Window @ 60 FPS</span>
      </div>
      <canvas
        ref={canvasRef}
        width={700}
        height={130}
        className="w-full h-[130px] rounded-[6.4px] border border-[#262b3c]"
      />
    </div>
  );
};
