import React, { useEffect, useRef } from 'react';

interface LogicWaveformProps {
  history: [number, number][]; // [timeMs, voltage]
}

export const LogicWaveform: React.FC<LogicWaveformProps> = ({ history }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI (Retina / Windows scaling 125%, 150%) to prevent blurriness
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, rect.width);
    const height = Math.max(80, rect.height);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Flat Dark Background
    ctx.fillStyle = '#0c0d10';
    ctx.fillRect(0, 0, width, height);

    // Grid coordinates
    const leftGutter = 44;
    const rightMargin = 16;
    const topMargin = 16;
    const bottomMargin = 22;

    const y0 = height - bottomMargin;
    const y5 = topMargin;
    const yMid = Math.round((y0 + y5) / 2);

    // Draw Subtle Grid Lines
    ctx.strokeStyle = '#222329';
    ctx.lineWidth = 1;

    // Horizontal Voltage lines (0.0V, 2.5V, 5.0V)
    ctx.beginPath();
    ctx.moveTo(leftGutter, y5);
    ctx.lineTo(width - rightMargin, y5);
    ctx.moveTo(leftGutter, yMid);
    ctx.lineTo(width - rightMargin, yMid);
    ctx.moveTo(leftGutter, y0);
    ctx.lineTo(width - rightMargin, y0);
    ctx.stroke();

    // Time Vertical Grid Lines (5 division marks)
    const plotWidth = width - leftGutter - rightMargin;
    const divisions = 5;
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = '#1a1b20';
    ctx.beginPath();
    for (let i = 1; i < divisions; i++) {
      const gx = Math.round(leftGutter + (plotWidth / divisions) * i);
      ctx.moveTo(gx, y5);
      ctx.lineTo(gx, y0);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Voltage Labels
    ctx.fillStyle = '#71717a';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('5.0V', leftGutter - 6, y5);
    ctx.fillText('2.5V', leftGutter - 6, yMid);
    ctx.fillText('0.0V', leftGutter - 6, y0);

    // If history is empty, draw idle 0V flatline
    if (history.length < 2) {
      ctx.strokeStyle = '#10b981'; // Crisp emerald trace
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftGutter, y0);
      ctx.lineTo(width - rightMargin, y0);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Render Digital Square Waveform
    const tEnd = history[history.length - 1][0];
    const tStart = Math.max(0, tEnd - 5000); // 5-second sliding window
    const tRange = Math.max(100, tEnd - tStart);

    ctx.strokeStyle = '#10b981'; // Crisp high-contrast logic analyzer emerald
    ctx.lineWidth = 2;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.beginPath();

    let prevY = y0;
    let started = false;

    for (let i = 0; i < history.length; i++) {
      const [t, v] = history[i];
      if (t < tStart && i < history.length - 1 && history[i + 1][0] < tStart) {
        continue;
      }

      const clampedT = Math.max(tStart, t);
      const x = leftGutter + ((clampedT - tStart) / tRange) * plotWidth;
      const y = Math.round(y0 - (Math.min(5.0, Math.max(0.0, v)) / 5.0) * (y0 - y5));

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        // Crisp orthogonal digital transition (step)
        ctx.lineTo(x, prevY);
        ctx.lineTo(x, y);
      }
      prevY = y;
    }

    ctx.stroke();
    ctx.restore();
  }, [history]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-2 select-none">
      <div className="flex items-center justify-between px-1 pb-1.5 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-zinc-200 text-xs">Pin 13 Built-in LED Waveform</span>
          <span className="text-[10px] text-zinc-500 font-mono">(0.0V - 5.0V Digital Logic)</span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">5.0s Window • 60 FPS</span>
      </div>
      <div ref={containerRef} className="flex-1 w-full min-h-[90px] rounded-md border border-zinc-800 overflow-hidden bg-[#0c0d10]">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
};
