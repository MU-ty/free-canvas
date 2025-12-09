import React from 'react';
import type { CanvasElement } from '../types';
import { getAllSnapPoints, SNAP_RADIUS, type SnapPoint } from '../utils/arrowSnap';

interface SnapCirclesRendererProps {
  elements: CanvasElement[];
  viewport: { x: number; y: number; scale: number };
  activeArrowId?: string;
  highlightedPoints?: SnapPoint[];
  showAll?: boolean;
}

/**
 * 渲染元素的吸附圈
 * - 当拖动箭头端点时显示所有可用的吸附点
 * - 当接近某个吸附点时高亮显示
 */
export const SnapCirclesRenderer: React.FC<SnapCirclesRendererProps> = ({
  elements,
  viewport,
  activeArrowId,
  highlightedPoints = [],
  showAll = false,
}) => {
  // 获取所有吸附点（排除当前箭头）
  const allSnapPoints = getAllSnapPoints(elements, activeArrowId);

  // 将画布坐标转换为屏幕坐标
  const toScreen = (x: number, y: number) => ({
    x: x * viewport.scale + viewport.x,
    y: y * viewport.scale + viewport.y,
  });

  // 检查点是否被高亮
  const isHighlighted = (point: SnapPoint) => {
    return highlightedPoints.some(
      (hp) => hp.x === point.x && hp.y === point.y && hp.elementId === point.elementId
    );
  };

  const circleRadius = SNAP_RADIUS * viewport.scale;

  return (
    <>
      {allSnapPoints.map((point, index) => {
        const screenPos = toScreen(point.x, point.y);
        const highlighted = isHighlighted(point);

        // 如果不是显示全部模式，且不是高亮点，则不渲染
        if (!showAll && !highlighted) {
          return null;
        }

        return (
          <div
            key={`${point.elementId}-${point.position}-${index}`}
            style={{
              position: 'absolute',
              left: screenPos.x - circleRadius,
              top: screenPos.y - circleRadius,
              width: circleRadius * 2,
              height: circleRadius * 2,
              borderRadius: '50%',
              border: highlighted
                ? '2px solid #10b981'
                : '1px dashed #94a3b8',
              backgroundColor: highlighted
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(148, 163, 184, 0.1)',
              pointerEvents: 'none',
              transition: 'all 0.15s ease',
              zIndex: highlighted ? 999 : 998,
            }}
          />
        );
      })}
    </>
  );
};

export default SnapCirclesRenderer;
