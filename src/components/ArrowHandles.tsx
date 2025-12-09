import React, { useRef, useState } from 'react';
import type { ShapeElement, CanvasElement, ArrowBinding } from '../types';
import { snapArrowPoint, type SnapPoint } from '../utils/arrowSnap';

interface ArrowHandlesProps {
  element: ShapeElement;
  viewport: { x: number; y: number; scale: number };
  elements: CanvasElement[];
  onUpdateArrowPoint: (point: 'start' | 'end', x: number, y: number, binding?: ArrowBinding) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onSnapChange?: (highlightedPoints: SnapPoint[]) => void;
}

export const ArrowHandles: React.FC<ArrowHandlesProps> = ({
  element,
  viewport,
  elements,
  onUpdateArrowPoint,
  onDragStart,
  onDragEnd,
  onSnapChange,
}) => {
  const [draggingPoint, setDraggingPoint] = useState<'start' | 'end' | null>(null);

  if (element.type !== 'arrow' || !element.arrowStart || !element.arrowEnd) {
    return null;
  }

  // 计算起点和终点在屏幕上的位置
  const startScreenX = (element.x + element.arrowStart.x) * viewport.scale + viewport.x;
  const startScreenY = (element.y + element.arrowStart.y) * viewport.scale + viewport.y;
  const endScreenX = (element.x + element.arrowEnd.x) * viewport.scale + viewport.x;
  const endScreenY = (element.y + element.arrowEnd.y) * viewport.scale + viewport.y;

  // 控制点大小
  const handleSize = 18;
  // 点击区域大小
  const hitAreaSize = 32;

  const handleMouseDown = (point: 'start' | 'end') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    setDraggingPoint(point);
    onDragStart?.();
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      
      // 直接使用鼠标位置转换为画布绝对坐标
      const canvasX = (moveEvent.clientX - viewport.x) / viewport.scale;
      const canvasY = (moveEvent.clientY - viewport.y) / viewport.scale;
      
      // 尝试吸附
      const snapResult = snapArrowPoint(canvasX, canvasY, elements, element.id);
      
      // 更新高亮的吸附点
      if (snapResult.snapped && snapResult.snapPoint) {
        onSnapChange?.([snapResult.snapPoint]);
      } else {
        onSnapChange?.([]);
      }
      
      // 直接传递绝对坐标
      onUpdateArrowPoint(point, snapResult.x, snapResult.y, snapResult.binding);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setDraggingPoint(null);
      onDragEnd?.();
      onSnapChange?.([]);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const commonHitAreaStyle: React.CSSProperties = {
    position: 'absolute',
    width: hitAreaSize,
    height: hitAreaSize,
    cursor: 'crosshair',
    zIndex: 1001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
  };

  const getHandleStyle = (color: string, isDragging: boolean): React.CSSProperties => ({
    width: isDragging ? handleSize + 4 : handleSize,
    height: isDragging ? handleSize + 4 : handleSize,
    backgroundColor: color,
    border: '3px solid white',
    borderRadius: '50%',
    boxShadow: isDragging 
      ? `0 0 0 3px ${color}40, 0 4px 12px rgba(0,0,0,0.4)` 
      : '0 2px 8px rgba(0,0,0,0.3)',
    pointerEvents: 'none' as const,
    transition: 'all 0.1s ease',
  });

  return (
    <>
      {/* 起点控制点 */}
      <div
        onMouseDown={handleMouseDown('start')}
        style={{
          ...commonHitAreaStyle,
          left: startScreenX - hitAreaSize / 2,
          top: startScreenY - hitAreaSize / 2,
          backgroundColor: draggingPoint === 'start' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
        }}
        title="拖动调整箭头起点（绿色）"
      >
        <div style={getHandleStyle('#10b981', draggingPoint === 'start')} />
      </div>
      
      {/* 终点控制点 */}
      <div
        onMouseDown={handleMouseDown('end')}
        style={{
          ...commonHitAreaStyle,
          left: endScreenX - hitAreaSize / 2,
          top: endScreenY - hitAreaSize / 2,
          backgroundColor: draggingPoint === 'end' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
        }}
        title="拖动调整箭头终点（红色）"
      >
        <div style={getHandleStyle('#ef4444', draggingPoint === 'end')} />
      </div>
    </>
  );
};
