import React, { useEffect, useRef } from 'react';
import type { GuideLine } from '../utils/guideLines';
import { canvasToScreen } from '../utils/helpers';

interface GuideLineRendererProps {
  guidelines: GuideLine[];
  viewport: { x: number; y: number; scale: number };
  canvasWidth: number;
  canvasHeight: number;
}

export const GuideLineRenderer: React.FC<GuideLineRendererProps> = ({
  guidelines,
  viewport,
  canvasWidth,
  canvasHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 绘制辅助线
    guidelines.forEach((line) => {
      if (line.type === 'vertical') {
        const screenPos = canvasToScreen(line.position, 0, viewport);
        const screenStart = canvasToScreen(line.position, line.start, viewport);
        const screenEnd = canvasToScreen(line.position, line.end, viewport);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // 虚线
        ctx.beginPath();
        ctx.moveTo(screenPos.x, screenStart.y);
        ctx.lineTo(screenPos.x, screenEnd.y);
        ctx.stroke();
        ctx.setLineDash([]); // 恢复实线
      } else {
        const screenPos = canvasToScreen(0, line.position, viewport);
        const screenStart = canvasToScreen(line.start, line.position, viewport);
        const screenEnd = canvasToScreen(line.end, line.position, viewport);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // 虚线
        ctx.beginPath();
        ctx.moveTo(screenStart.x, screenPos.y);
        ctx.lineTo(screenEnd.x, screenPos.y);
        ctx.stroke();
        ctx.setLineDash([]); // 恢复实线
      }
    });
  }, [guidelines, viewport, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 500,
      }}
    />
  );
};
