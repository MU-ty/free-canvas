import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { CanvasElement } from '../types';
import { getBoundingBox } from '../utils/helpers';

interface MiniMapProps {
  elements: CanvasElement[];
  viewport: { x: number; y: number; scale: number };
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange: (updates: { x?: number; y?: number; scale?: number }) => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  elements,
  viewport,
  canvasWidth,
  canvasHeight,
  onViewportChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const minimapSize = 200;
  const padding = 10;

  // 计算内容的边界框
  const contentBBox = elements.length > 0 ? getBoundingBox(elements) : null;
  
  // 计算适配 minimap 的缩放比例
  const getMinimapScale = () => {
    if (!contentBBox) return 1;
    
    const availableWidth = minimapSize - padding * 2;
    const availableHeight = minimapSize - padding * 2;
    
    const contentWidth = contentBBox.width;
    const contentHeight = contentBBox.height;
    
    // 加入画布视口大小的考量
    const totalWidth = Math.max(contentWidth, canvasWidth / viewport.scale);
    const totalHeight = Math.max(contentHeight, canvasHeight / viewport.scale);
    
    const scaleX = totalWidth > 0 ? availableWidth / totalWidth : 1;
    const scaleY = totalHeight > 0 ? availableHeight / totalHeight : 1;
    
    return Math.min(scaleX, scaleY, 1); // 最大不超过 1:1
  };

  const minimapScale = getMinimapScale();

  // 绘制 minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, minimapSize, minimapSize);

    // 绘制边框
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, minimapSize, minimapSize);

    if (!contentBBox) return;

    // 计算内容在 minimap 上的位置
    const contentStartX = padding - contentBBox.x * minimapScale;
    const contentStartY = padding - contentBBox.y * minimapScale;

    // 绘制所有元素
    elements.forEach((element) => {
      const x = contentStartX + element.x * minimapScale;
      const y = contentStartY + element.y * minimapScale;
      const width = element.width * minimapScale;
      const height = element.height * minimapScale;

      // 按元素类型用不同颜色表示
      let color = '#3b82f6';
      if (element.type === 'text') {
        color = '#8b5cf6';
      } else if (element.type === 'image') {
        color = '#ec4899';
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x, y, width, height);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
    });

    // 绘制当前视口框
    const viewportX = contentStartX - viewport.x * minimapScale / viewport.scale;
    const viewportY = contentStartY - viewport.y * minimapScale / viewport.scale;
    const viewportWidth = (canvasWidth / viewport.scale) * minimapScale;
    const viewportHeight = (canvasHeight / viewport.scale) * minimapScale;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);

    // 填充视口框为半透明红色
    ctx.fillStyle = '#ef4444';
    ctx.globalAlpha = 0.1;
    ctx.fillRect(viewportX, viewportY, viewportWidth, viewportHeight);
    ctx.globalAlpha = 1;
  }, [elements, viewport, minimapScale, canvasWidth, canvasHeight, contentBBox]);

  // 处理 minimap 点击
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (!contentBBox) return;

      // 转换坐标到画布坐标
      const contentStartX = padding - contentBBox.x * minimapScale;
      const contentStartY = padding - contentBBox.y * minimapScale;

      const canvasClickX = (clickX - contentStartX) / minimapScale;
      const canvasClickY = (clickY - contentStartY) / minimapScale;

      // 计算新的视口位置，使点击点居中
      const newViewportX = canvasClickX * viewport.scale - canvasWidth / 2;
      const newViewportY = canvasClickY * viewport.scale - canvasHeight / 2;

      onViewportChange({
        x: newViewportX,
        y: newViewportY,
      });
    },
    [contentBBox, minimapScale, viewport.scale, canvasWidth, canvasHeight, onViewportChange]
  );

  // 处理视口框拖拽
  const handleMouseDown = useCallback(
    () => {
      setIsDragging(true);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !canvasRef.current || !contentBBox) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const moveX = e.clientX - rect.left;
      const moveY = e.clientY - rect.top;

      // 转换坐标到画布坐标
      const contentStartX = padding - contentBBox.x * minimapScale;
      const contentStartY = padding - contentBBox.y * minimapScale;

      const canvasMoveX = (moveX - contentStartX) / minimapScale;
      const canvasMoveY = (moveY - contentStartY) / minimapScale;

      // 计算新的视口位置
      const newViewportX = canvasMoveX * viewport.scale - canvasWidth / 2;
      const newViewportY = canvasMoveY * viewport.scale - canvasHeight / 2;

      onViewportChange({
        x: newViewportX,
        y: newViewportY,
      });
    },
    [isDragging, contentBBox, minimapScale, viewport.scale, canvasWidth, canvasHeight, onViewportChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: minimapSize,
        height: minimapSize,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        zIndex: 999,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <canvas
        ref={canvasRef}
        width={minimapSize}
        height={minimapSize}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      />
    </div>
  );
};
