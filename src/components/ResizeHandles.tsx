import React from 'react';
import type { CanvasElement } from '../types';
import { getBoundingBox } from '../utils/helpers';

interface ResizeHandlesProps {
  selectedElements: CanvasElement[];
  viewport: { x: number; y: number; scale: number };
  onResizeStart: (handle: string, e: React.MouseEvent) => void;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  selectedElements,
  viewport,
  onResizeStart,
}) => {
  if (selectedElements.length === 0) return null;

  // 如果只有一个元素且有旋转，显示旋转后的边框
  if (selectedElements.length === 1 && selectedElements[0].rotation && selectedElements[0].rotation !== 0) {
    const element = selectedElements[0];
    const rotation = element.rotation || 0;
    const cx = (element.x + element.width / 2) * viewport.scale + viewport.x;
    const cy = (element.y + element.height / 2) * viewport.scale + viewport.y;
    const width = element.width * viewport.scale;
    const height = element.height * viewport.scale;

    const handleSize = 10;
    
    // 计算四个角的位置（考虑旋转）
    const angle = (rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const corners = [
      { dx: -width / 2, dy: -height / 2, pos: 'tl', cursor: 'nwse-resize' },
      { dx: width / 2, dy: -height / 2, pos: 'tr', cursor: 'nesw-resize' },
      { dx: width / 2, dy: height / 2, pos: 'br', cursor: 'nwse-resize' },
      { dx: -width / 2, dy: height / 2, pos: 'bl', cursor: 'nesw-resize' },
    ];
    
    const edges = [
      { dx: 0, dy: -height / 2, pos: 't', cursor: 'ns-resize' },
      { dx: width / 2, dy: 0, pos: 'r', cursor: 'ew-resize' },
      { dx: 0, dy: height / 2, pos: 'b', cursor: 'ns-resize' },
      { dx: -width / 2, dy: 0, pos: 'l', cursor: 'ew-resize' },
    ];
    
    const rotatedCorners = corners.map(c => ({
      ...c,
      x: cx + c.dx * cos - c.dy * sin - handleSize / 2,
      y: cy + c.dx * sin + c.dy * cos - handleSize / 2,
    }));
    
    const rotatedEdges = edges.map(e => ({
      ...e,
      x: cx + e.dx * cos - e.dy * sin - handleSize / 2,
      y: cy + e.dx * sin + e.dy * cos - handleSize / 2,
    }));
    
    // 计算边框路径
    const borderPath = corners.map(c => {
      const x = cx + c.dx * cos - c.dy * sin;
      const y = cy + c.dx * sin + c.dy * cos;
      return `${x},${y}`;
    }).join(' ');

    return (
      <React.Fragment>
        {/* 旋转后的边框 */}
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <polygon
            points={borderPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
        </svg>
        
        {/* 角点句柄 */}
        {rotatedCorners.map((handle) => (
          <div
            key={handle.pos}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(handle.pos, e);
            }}
            style={{
              position: 'absolute',
              left: handle.x,
              top: handle.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'white',
              border: '2px solid #3b82f6',
              borderRadius: '3px',
              cursor: handle.cursor,
              zIndex: 1001,
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              transition: 'transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        ))}
        
        {/* 边中点句柄 */}
        {rotatedEdges.map((handle) => (
          <div
            key={handle.pos}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(handle.pos, e);
            }}
            style={{
              position: 'absolute',
              left: handle.x,
              top: handle.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'white',
              border: '2px solid #3b82f6',
              borderRadius: '3px',
              cursor: handle.cursor,
              zIndex: 1001,
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              transition: 'transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        ))}
      </React.Fragment>
    );
  }

  // 多个元素或未旋转的元素，使用bounding box
  const bbox = getBoundingBox(selectedElements);
  const left = bbox.x * viewport.scale + viewport.x;
  const top = bbox.y * viewport.scale + viewport.y;
  const width = bbox.width * viewport.scale;
  const height = bbox.height * viewport.scale;

  const handleSize = 10;
  const handles = [
    { pos: 'tl', x: left - handleSize / 2, y: top - handleSize / 2, cursor: 'nwse-resize' },
    { pos: 'tr', x: left + width - handleSize / 2, y: top - handleSize / 2, cursor: 'nesw-resize' },
    { pos: 'bl', x: left - handleSize / 2, y: top + height - handleSize / 2, cursor: 'nesw-resize' },
    { pos: 'br', x: left + width - handleSize / 2, y: top + height - handleSize / 2, cursor: 'nwse-resize' },
    { pos: 't', x: left + width / 2 - handleSize / 2, y: top - handleSize / 2, cursor: 'ns-resize' },
    { pos: 'b', x: left + width / 2 - handleSize / 2, y: top + height - handleSize / 2, cursor: 'ns-resize' },
    { pos: 'l', x: left - handleSize / 2, y: top + height / 2 - handleSize / 2, cursor: 'ew-resize' },
    { pos: 'r', x: left + width - handleSize / 2, y: top + height / 2 - handleSize / 2, cursor: 'ew-resize' },
  ];

  return (
    <React.Fragment>
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          border: '2px solid #3b82f6',
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />
      
      {handles.map((handle) => (
        <div
          key={handle.pos}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(handle.pos, e);
          }}
          style={{
            position: 'absolute',
            left: handle.x,
            top: handle.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: 'white',
            border: '2px solid #3b82f6',
            borderRadius: '3px',
            cursor: handle.cursor,
            zIndex: 1001,
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            transition: 'transform 0.1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        />
      ))}
    </React.Fragment>
  );
};
